// 1 リポジトリぶんの統計をまとめて作る
import { env } from 'void/env';
import { kv } from 'void/kv';
import { HTTPException } from 'hono/http-exception';
import type { RepoStats, StatsResponse } from '../lib/types';
import { analyze, medianHours } from './analyze';
import { GitHub, fetchBlame, fetchCommits, fetchRepo, fetchSourceFiles } from './github';
import { fetchNpm, packageNameOf } from './npm';
import { acquireLock, finishLock, releaseLock } from './lock';
import { recordView, saveRepo } from './repos';

const DAY = 86_400_000;
const CACHE_VERSION = 'v3';

export const cacheKey = (owner: string, name: string) =>
  `stats:${CACHE_VERSION}:${owner}/${name}`.toLowerCase();

function countSince(dates: string[] | undefined, since: number, limit: number) {
  if (!dates) return { count: null, capped: false };
  const count = dates.filter((d) => new Date(d).getTime() >= since).length;
  return { count, capped: count >= limit };
}

export async function buildStats(gh: GitHub, owner: string, name: string): Promise<RepoStats> {
  const startedAt = Date.now();

  const repo = await fetchRepo(gh, owner, name);
  const branch = repo.defaultBranchRef!;
  const sha = branch.target.oid;
  const [ownerLogin, repoName] = repo.nameWithOwner.split('/');

  const [history, sourceFiles, npm] = await Promise.all([
    fetchCommits(gh, ownerLogin, repoName, env.MAX_COMMITS),
    fetchSourceFiles(gh, ownerLogin, repoName, sha),
    (async () => {
      const pkg = packageNameOf(repo.packageJson?.text);
      return pkg ? fetchNpm(pkg, repo.nameWithOwner).catch(() => null) : null;
    })(),
  ]);

  const targets = sourceFiles.slice(0, env.MAX_BLAME_FILES);
  const { files: blame, failures: blameFailures } = await fetchBlame(gh, ownerLogin, repoName, sha, targets.map((f) => f.path));

  const result = analyze(history.commits, blame);
  const totalBytes = sourceFiles.reduce((s, f) => s + f.size, 0);
  const blamedPaths = new Set(blame.map((b) => b.path));
  const blamedBytes = targets.filter((f) => blamedPaths.has(f.path)).reduce((s, f) => s + f.size, 0);

  const monthAgo = Date.now() - 30 * DAY;
  const stars = countSince(repo.stargazers?.edges.map((e) => e.starredAt), monthAgo, 100);
  const forks = countSince(repo.forks?.nodes.map((f) => f.createdAt), monthAgo, 100);
  const langTotal = repo.languages?.totalSize || 1;

  return {
    repo: {
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.nameWithOwner,
      url: repo.url,
      description: repo.description,
      homepage: repo.homepageUrl || null,
      ownerAvatarUrl: repo.owner.avatarUrl,
      isPrivate: repo.isPrivate,
      isFork: repo.isFork,
      isArchived: repo.isArchived,
      stars: repo.stargazerCount,
      forks: repo.forkCount,
      watchers: repo.watchers?.totalCount ?? null,
      createdAt: repo.createdAt,
      pushedAt: repo.pushedAt,
      license: repo.licenseInfo?.spdxId ?? repo.licenseInfo?.name ?? null,
      topics: (repo.repositoryTopics?.nodes ?? []).map((n) => n.topic.name),
      primaryLanguage: repo.primaryLanguage,
      languages: (repo.languages?.edges ?? []).map((e) => ({
        name: e.node.name,
        color: e.node.color,
        share: e.size / langTotal,
      })),
      defaultBranch: branch.name,
      headSha: sha,
    },
    growth: {
      stars30d: stars.count,
      stars30dCapped: stars.capped,
      forks30d: forks.count,
      forks30dCapped: forks.capped,
    },
    health: {
      openIssues: repo.openIssues?.totalCount ?? null,
      closedIssues: repo.closedIssues?.totalCount ?? null,
      openPRs: repo.openPRs?.totalCount ?? null,
      mergedPRs: repo.mergedPRs?.totalCount ?? null,
      prMergeMedianHours: medianHours((repo.recentMerged?.nodes ?? []).map((n) => ({ from: n.createdAt, to: n.mergedAt }))),
      issueCloseMedianHours: medianHours((repo.recentClosed?.nodes ?? []).map((n) => ({ from: n.createdAt, to: n.closedAt }))),
      releases: repo.releases?.totalCount ?? null,
      latestRelease: repo.releases?.nodes[0]
        ? { tag: repo.releases.nodes[0].tagName, publishedAt: repo.releases.nodes[0].publishedAt }
        : null,
    },
    npm,
    totals: {
      ...result.totals,
      commits: branch.target.history.totalCount,
      analyzedCommits: history.commits.length,
      files: sourceFiles.length,
      blamedFiles: blame.length,
      blameCoverage: totalBytes ? blamedBytes / totalBytes : 0,
    },
    contributors: result.contributors,
    ai: result.ai,
    heatmap: result.heatmap,
    monthly: result.monthly,
    files: result.files,
    meta: {
      analyzedAt: new Date().toISOString(),
      refreshableAt: new Date(Date.now() + env.REFRESH_INTERVAL * 1000).toISOString(),
      durationMs: Date.now() - startedAt,
      commitsTruncated: history.truncated,
      warnings: blameFailures.length > 0 && blame.length === 0 ? [`blame を取得できませんでした: ${blameFailures[0]}`] : [],
      cached: false,
    },
  };
}

/** GraphQL の残りポイントが少なければ、分析を始めずに断る */
async function ensureRateLimit(gh: GitHub) {
  const limit = await gh.graphqlRateLimit();
  if (limit.remaining >= env.RATE_LIMIT_RESERVE) return;
  const reset = new Date(limit.reset * 1000).toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  });
  throw new HTTPException(503, { message: `混み合っているため、新しい分析を受け付けられません。${reset} ごろに回復します` });
}

export async function getStats(owner: string, name: string, refresh = false): Promise<StatsResponse> {
  const key = cacheKey(owner, name);
  const cached = await kv.get<RepoStats>(key);
  const ready = (stats: RepoStats): StatsResponse => ({ status: 'ready', stats });

  // 再分析は、前回の分析から REFRESH_INTERVAL 経つまで受け付けない
  if (cached && (!refresh || Date.now() < new Date(cached.meta.refreshableAt).getTime())) {
    await recordView(cached.repo.fullName).catch((e) => console.error('recordView failed', e));
    return ready({ ...cached, meta: { ...cached.meta, cached: true } });
  }

  // ほかのリクエストが分析中なら、新しく始めずに待ってもらう
  const lockId = `${owner}/${name}`.toLowerCase();
  if (!(await acquireLock(lockId))) {
    return cached ? ready({ ...cached, meta: { ...cached.meta, cached: true } }) : { status: 'pending' };
  }

  try {
    const gh = new GitHub(env.GITHUB_TOKEN);
    await ensureRateLimit(gh);
    const stats = await buildStats(gh, owner, name);
    await kv.put(key, stats, { ttl: env.CACHE_TTL });
    await finishLock(lockId);
    await saveRepo(stats).catch((e) => console.error('saveRepo failed', e));
    return ready(stats);
  } catch (e) {
    await releaseLock(lockId).catch((err) => console.error('releaseLock failed', err));
    throw e;
  }
}

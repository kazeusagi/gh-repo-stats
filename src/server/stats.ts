// 1 リポジトリぶんの統計をまとめて作る
import { env } from 'void/env';
import { kv } from 'void/kv';
import type { RepoStats } from '../lib/types';
import { analyze, medianHours } from './analyze';
import { GitHub, fetchBlame, fetchCommits, fetchRepo, fetchSourceFiles } from './github';
import { fetchNpm, packageNameOf } from './npm';

const DAY = 86_400_000;
const CACHE_VERSION = 'v1';

export const cacheKey = (owner: string, name: string) =>
  `stats:${CACHE_VERSION}:${owner}/${name}`.toLowerCase();

function countSince(dates: string[], since: number, limit: number) {
  const count = dates.filter((d) => new Date(d).getTime() >= since).length;
  return { count, capped: count >= limit };
}

export async function buildStats(owner: string, name: string): Promise<RepoStats> {
  const startedAt = Date.now();
  const gh = new GitHub(env.GITHUB_TOKEN);

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
  const blame = await fetchBlame(gh, ownerLogin, repoName, sha, targets.map((f) => f.path));

  const result = analyze(history.commits, blame);
  const totalBytes = sourceFiles.reduce((s, f) => s + f.size, 0);
  const blamedPaths = new Set(blame.map((b) => b.path));
  const blamedBytes = targets.filter((f) => blamedPaths.has(f.path)).reduce((s, f) => s + f.size, 0);

  const monthAgo = Date.now() - 30 * DAY;
  const stars = countSince((repo.stargazers?.edges ?? []).map((e) => e.starredAt), monthAgo, 100);
  const forks = countSince((repo.forks?.nodes ?? []).map((f) => f.createdAt), monthAgo, 100);
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
      watchers: repo.watchers?.totalCount ?? 0,
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
      openIssues: repo.openIssues?.totalCount ?? 0,
      closedIssues: repo.closedIssues?.totalCount ?? 0,
      openPRs: repo.openPRs?.totalCount ?? 0,
      mergedPRs: repo.mergedPRs?.totalCount ?? 0,
      prMergeMedianHours: medianHours((repo.recentMerged?.nodes ?? []).map((n) => ({ from: n.createdAt, to: n.mergedAt }))),
      issueCloseMedianHours: medianHours((repo.recentClosed?.nodes ?? []).map((n) => ({ from: n.createdAt, to: n.closedAt }))),
      releases: repo.releases?.totalCount ?? 0,
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
      durationMs: Date.now() - startedAt,
      commitsTruncated: history.truncated,
      cached: false,
    },
  };
}

export async function getStats(owner: string, name: string, refresh = false) {
  const key = cacheKey(owner, name);
  if (!refresh) {
    const cached = await kv.get<RepoStats>(key);
    if (cached) return { ...cached, meta: { ...cached.meta, cached: true } };
  }
  const stats = await buildStats(owner, name);
  await kv.put(key, stats, { ttl: env.CACHE_TTL });
  return stats;
}

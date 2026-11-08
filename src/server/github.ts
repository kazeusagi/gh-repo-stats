// GitHub API（GraphQL / REST）からのデータ取得
import { HTTPException } from 'hono/http-exception';
import type { BlameFile, RawAuthor, RawCommit } from './analyze';

const API = 'https://api.github.com';

export class GitHub {
  constructor(private token: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gh-repo-stats',
    };
  }

  async graphql<T>(query: string, variables: Record<string, unknown>) {
    const res = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401) throw new HTTPException(500, { message: 'GITHUB_TOKEN が無効です' });
    if (!res.ok) throw new HTTPException(502, { message: `GitHub API エラー (${res.status})` });
    const json = (await res.json()) as { data?: T; errors?: { type?: string; message: string }[] };
    if (json.errors?.some((e) => e.type === 'NOT_FOUND')) {
      throw new HTTPException(404, { message: 'リポジトリが見つかりません' });
    }
    if (json.errors?.some((e) => e.type === 'RATE_LIMITED')) {
      throw new HTTPException(429, { message: 'GitHub API のレート制限に達しました' });
    }
    // blame の一部失敗などは部分的なデータのまま返す
    if (!json.data) throw new HTTPException(502, { message: json.errors?.[0]?.message ?? 'GitHub API エラー' });
    return { data: json.data, errors: json.errors ?? [] };
  }

  async rest<T>(path: string) {
    const res = await fetch(`${API}${path}`, { headers: this.headers() });
    if (!res.ok) throw new HTTPException(502, { message: `GitHub API エラー (${res.status})` });
    return (await res.json()) as T;
  }
}

// ---------- リポジトリ情報 ----------

const REPO_QUERY = /* GraphQL */ `
  query ($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      name
      nameWithOwner
      url
      description
      homepageUrl
      isPrivate
      isFork
      isArchived
      stargazerCount
      forkCount
      createdAt
      pushedAt
      owner { login avatarUrl }
      watchers { totalCount }
      licenseInfo { spdxId name }
      primaryLanguage { name color }
      languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
        totalSize
        edges { size node { name color } }
      }
      repositoryTopics(first: 20) { nodes { topic { name } } }
      defaultBranchRef {
        name
        target { ... on Commit { oid history { totalCount } } }
      }
      openIssues: issues(states: OPEN) { totalCount }
      closedIssues: issues(states: CLOSED) { totalCount }
      openPRs: pullRequests(states: OPEN) { totalCount }
      mergedPRs: pullRequests(states: MERGED) { totalCount }
      recentMerged: pullRequests(states: MERGED, last: 50) { nodes { createdAt mergedAt } }
      recentClosed: issues(states: CLOSED, last: 50) { nodes { createdAt closedAt } }
      releases(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
        totalCount
        nodes { tagName publishedAt }
      }
      stargazers(first: 100, orderBy: { field: STARRED_AT, direction: DESC }) { edges { starredAt } }
      forks(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { createdAt } }
      packageJson: object(expression: "HEAD:package.json") { ... on Blob { text } }
    }
  }
`;

export type RepoInfo = {
  name: string;
  nameWithOwner: string;
  url: string;
  description: string | null;
  homepageUrl: string | null;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  stargazerCount: number;
  forkCount: number;
  createdAt: string;
  pushedAt: string | null;
  owner: { login: string; avatarUrl: string };
  watchers: { totalCount: number };
  licenseInfo: { spdxId: string | null; name: string } | null;
  primaryLanguage: { name: string; color: string | null } | null;
  languages: { totalSize: number; edges: { size: number; node: { name: string; color: string | null } }[] };
  repositoryTopics: { nodes: { topic: { name: string } }[] };
  defaultBranchRef: { name: string; target: { oid: string; history: { totalCount: number } } } | null;
  openIssues: { totalCount: number };
  closedIssues: { totalCount: number };
  openPRs: { totalCount: number };
  mergedPRs: { totalCount: number };
  recentMerged: { nodes: { createdAt: string; mergedAt: string | null }[] };
  recentClosed: { nodes: { createdAt: string; closedAt: string | null }[] };
  releases: { totalCount: number; nodes: { tagName: string; publishedAt: string | null }[] };
  stargazers: { edges: { starredAt: string }[] };
  forks: { nodes: { createdAt: string }[] };
  packageJson: { text: string | null } | null;
};

export async function fetchRepo(gh: GitHub, owner: string, name: string) {
  const { data } = await gh.graphql<{ repository: RepoInfo | null }>(REPO_QUERY, { owner, name });
  if (!data.repository) throw new HTTPException(404, { message: 'リポジトリが見つかりません' });
  if (!data.repository.defaultBranchRef) throw new HTTPException(422, { message: 'コミットがありません' });
  return data.repository;
}

// ---------- コミット履歴 ----------

const AUTHOR_FIELDS = `author { name email avatarUrl user { login } }`;

const HISTORY_QUERY = /* GraphQL */ `
  query ($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes { oid authoredDate message additions deletions ${AUTHOR_FIELDS} }
            }
          }
        }
      }
    }
  }
`;

type GqlAuthor = { name: string | null; email: string | null; avatarUrl: string | null; user: { login: string } | null };
type GqlCommit = { oid: string; authoredDate: string; message: string; author: GqlAuthor | null };

const toAuthor = (a: GqlAuthor | null): RawAuthor => ({
  name: a?.name ?? '',
  email: a?.email ?? '',
  login: a?.user?.login ?? null,
  avatarUrl: a?.user ? a.avatarUrl : null,
});

const toCommit = (c: GqlCommit) => ({
  oid: c.oid,
  date: c.authoredDate,
  message: c.message,
  author: toAuthor(c.author),
});

export async function fetchCommits(gh: GitHub, owner: string, name: string, max: number) {
  const commits: RawCommit[] = [];
  let cursor: string | null = null;
  let truncated = false;

  type History = {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    nodes: (GqlCommit & { additions: number; deletions: number })[];
  };
  type Page = { repository: { defaultBranchRef: { target: { history: History } } } };

  while (true) {
    const page: { data: Page } = await gh.graphql<Page>(HISTORY_QUERY, { owner, name, cursor });
    const history: History = page.data.repository.defaultBranchRef.target.history;
    for (const c of history.nodes) {
      commits.push({ ...toCommit(c), additions: c.additions, deletions: c.deletions });
    }
    if (!history.pageInfo.hasNextPage) break;
    if (commits.length >= max) {
      truncated = true;
      break;
    }
    cursor = history.pageInfo.endCursor;
  }
  return { commits, truncated };
}

// ---------- ファイル一覧と blame ----------

const SKIP_PATH =
  /(^|\/)(node_modules|vendor|dist|build|out|coverage|\.yarn|\.next|__snapshots__)\/|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|composer\.lock|Gemfile\.lock)$|\.min\.(js|css)$|\.map$/i;
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|avif|ico|icns|bmp|tiff?|psd|svg|woff2?|ttf|otf|eot|mp[34]|mov|webm|wav|ogg|flac|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|exe|dll|so|dylib|a|o|wasm|bin|dat|db|sqlite|pyc|class)$/i;

export type TreeFile = { path: string; size: number };

export async function fetchSourceFiles(gh: GitHub, owner: string, name: string, sha: string) {
  type Tree = { tree: { path: string; type: string; size?: number }[]; truncated: boolean };
  const tree = await gh.rest<Tree>(`/repos/${owner}/${name}/git/trees/${sha}?recursive=1`);
  return tree.tree
    .filter((e) => e.type === 'blob' && (e.size ?? 0) > 0 && (e.size ?? 0) < 1_000_000)
    .filter((e) => !SKIP_PATH.test(e.path) && !BINARY_EXT.test(e.path))
    .map((e) => ({ path: e.path, size: e.size ?? 0 }))
    .sort((a, b) => b.size - a.size);
}

const BLAME_BATCH = 8;

type GqlBlame = {
  ranges: { startingLine: number; endingLine: number; commit: GqlCommit }[];
};

function blameQuery(count: number) {
  const vars = Array.from({ length: count }, (_, i) => `$p${i}: String!`).join(', ');
  const fields = Array.from(
    { length: count },
    (_, i) => `f${i}: blame(path: $p${i}) { ranges { startingLine endingLine commit { oid authoredDate message ${AUTHOR_FIELDS} } } }`,
  ).join('\n');
  return `query ($owner: String!, $name: String!, $sha: GitObjectID!, ${vars}) {
    repository(owner: $owner, name: $name) {
      object(oid: $sha) { ... on Commit { ${fields} } }
    }
  }`;
}

async function blameBatch(gh: GitHub, owner: string, name: string, sha: string, paths: string[]) {
  const variables: Record<string, string> = { owner, name, sha };
  paths.forEach((p, i) => (variables[`p${i}`] = p));
  const { data } = await gh.graphql<{ repository: { object: Record<string, GqlBlame | null> } }>(
    blameQuery(paths.length),
    variables,
  );
  const object = data.repository.object;
  return paths.flatMap((path, i): BlameFile[] => {
    const blame = object?.[`f${i}`];
    if (!blame) return [];
    return [{
      path,
      ranges: blame.ranges.map((r) => ({
        lines: r.endingLine - r.startingLine + 1,
        commit: toCommit(r.commit),
      })),
    }];
  });
}

export async function fetchBlame(
  gh: GitHub, owner: string, name: string, sha: string, paths: string[], concurrency = 4,
) {
  const batches: string[][] = [];
  for (let i = 0; i < paths.length; i += BLAME_BATCH) batches.push(paths.slice(i, i + BLAME_BATCH));

  const results: BlameFile[] = [];
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        results.push(...(await blameBatch(gh, owner, name, sha, batch)));
      } catch (e) {
        if (e instanceof HTTPException && e.status === 429) throw e;
        // 巨大ファイルなどで失敗したバッチは飛ばす
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

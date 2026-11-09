// サーバーとクライアントで共有する型

export const PERIODS = ['all', '365', '90', '30'] as const;
export type Period = (typeof PERIODS)[number];

export type Metrics = {
  lines: number; // 現存行数（git blame）
  commits: number;
  add: number;
  del: number;
  // そのうち AI 共著のぶん
  aiLines: number;
  aiCommits: number;
  aiAdd: number;
  aiDel: number;
};

export type ContributorKind = 'human' | 'ai' | 'bot';

export type Contributor = {
  id: string;
  name: string;
  login: string | null;
  avatarUrl: string | null;
  kind: ContributorKind;
  firstAt: string | null;
  lastAt: string | null;
  periods: Record<Period, Metrics>;
};

export type AiTool = {
  id: string;
  name: string;
  lines: number;
  commits: number;
};

export type FileOwnership = {
  path: string;
  lines: number;
  owner: { id: string; name: string; kind: ContributorKind };
  share: number; // 0-1
  lastUpdated: string | null;
};

export type NpmStats = {
  name: string;
  url: string;
  version: string;
  license: string | null;
  weekly: number;
  monthly: number;
  weeklySeries: number[]; // 直近 12 週
  versions: number;
  unpackedSize: number | null;
  dependencies: number;
};

export type RepoStats = {
  repo: {
    owner: string;
    name: string;
    fullName: string;
    url: string;
    description: string | null;
    homepage: string | null;
    ownerAvatarUrl: string;
    isPrivate: boolean;
    isFork: boolean;
    isArchived: boolean;
    stars: number;
    forks: number;
    watchers: number | null;
    createdAt: string;
    pushedAt: string | null;
    license: string | null;
    topics: string[];
    primaryLanguage: { name: string; color: string | null } | null;
    languages: { name: string; color: string | null; share: number }[];
    defaultBranch: string;
    headSha: string;
  };
  growth: {
    // 取得できなかった項目は null
    stars30d: number | null;
    stars30dCapped: boolean; // 取得上限に達したので「以上」
    forks30d: number | null;
    forks30dCapped: boolean;
  };
  health: {
    openIssues: number | null;
    closedIssues: number | null;
    openPRs: number | null;
    mergedPRs: number | null;
    prMergeMedianHours: number | null;
    issueCloseMedianHours: number | null;
    releases: number | null;
    latestRelease: { tag: string; publishedAt: string | null } | null;
  };
  npm: NpmStats | null;
  totals: {
    commits: number;
    analyzedCommits: number;
    contributors: number;
    activeContributors90d: number;
    files: number;
    blamedFiles: number;
    blameCoverage: number; // 分析したファイルのバイト比 0-1
    lines: number;
    weeklyAvgCommits: number;
    busFactor: number;
  };
  contributors: Contributor[];
  ai: {
    lines: number;
    commits: number;
    firstSeen: string | null;
    tools: AiTool[];
  };
  heatmap: { start: string; days: number[] }; // start から 1 日ずつ
  monthly: { month: string; human: number; ai: number }[];
  files: FileOwnership[];
  meta: {
    analyzedAt: string;
    refreshableAt: string; // この時刻を過ぎたら再分析できる
    durationMs: number;
    commitsTruncated: boolean;
    warnings: string[];
    cached: boolean;
  };
};

/** API の応答。ほかの人が分析中なら pending */
export type StatsResponse = { status: 'ready'; stats: RepoStats } | { status: 'pending' };

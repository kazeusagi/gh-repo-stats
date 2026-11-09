// 取得したコミット履歴と blame を集計する（外部アクセスなしの純粋な処理）
import {
  type AiTool,
  type Contributor,
  type ContributorKind,
  type FileOwnership,
  type Metrics,
  PERIODS,
  type Period,
} from '../lib/types';
import { aiAuthor, aiCoAuthor, isBotName, toolName } from './ai';

export type RawAuthor = {
  name: string;
  email: string;
  login: string | null;
  avatarUrl: string | null;
};

export type RawCommit = {
  oid: string;
  date: string;
  message: string;
  additions: number;
  deletions: number;
  author: RawAuthor;
};

export type BlameRange = {
  lines: number;
  commit: Omit<RawCommit, 'additions' | 'deletions'>;
};

export type BlameFile = { path: string; ranges: BlameRange[] };

type Actor = { id: string; name: string; login: string | null; avatarUrl: string | null; kind: ContributorKind };

const DAY = 86_400_000;

const emptyMetrics = (): Metrics => ({
  lines: 0, commits: 0, add: 0, del: 0, aiLines: 0, aiCommits: 0, aiAdd: 0, aiDel: 0,
});

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function medianHours(pairs: { from: string; to: string | null }[]) {
  const hours = pairs
    .filter((p) => p.to)
    .map((p) => (new Date(p.to!).getTime() - new Date(p.from).getTime()) / 3_600_000);
  return median(hours);
}

export function analyze(commits: RawCommit[], blame: BlameFile[], now = Date.now()) {
  // --- 同一人物の判定: メールから GitHub ログインを引けるようにする ---
  const emailToLogin = new Map<string, string>();
  const allAuthors = [
    ...commits.map((c) => c.author),
    ...blame.flatMap((f) => f.ranges.map((r) => r.commit.author)),
  ];
  for (const a of allAuthors) {
    if (a.login && a.email) emailToLogin.set(a.email.toLowerCase(), a.login);
  }

  function actorOf(a: RawAuthor): Actor {
    const tool = aiAuthor(a.name, a.email);
    if (tool) return { id: `ai:${tool}`, name: toolName(tool), login: null, avatarUrl: null, kind: 'ai' };
    if (isBotName(a.name, a.email)) {
      const name = a.login ?? a.name;
      return { id: `bot:${name.toLowerCase()}`, name, login: a.login, avatarUrl: a.avatarUrl, kind: 'bot' };
    }
    const login = a.login ?? emailToLogin.get(a.email.toLowerCase()) ?? null;
    const id = login ? `gh:${login.toLowerCase()}` : `email:${(a.email || a.name).toLowerCase()}`;
    return { id, name: a.name || login || a.email, login, avatarUrl: a.avatarUrl, kind: 'human' };
  }

  // --- 期間の判定 ---
  const cutoffs: Record<Period, number> = {
    all: 0,
    '365': now - 365 * DAY,
    '90': now - 90 * DAY,
    '30': now - 30 * DAY,
  };
  const periodsOf = (date: string) => {
    const t = new Date(date).getTime();
    return PERIODS.filter((p) => t >= cutoffs[p]);
  };

  // --- コントリビューター ---
  const people = new Map<string, Contributor>();

  function touch(actor: Actor, date: string) {
    let c = people.get(actor.id);
    if (!c) {
      c = {
        ...actor,
        firstAt: date,
        lastAt: date,
        periods: Object.fromEntries(PERIODS.map((p) => [p, emptyMetrics()])) as Record<Period, Metrics>,
      };
      people.set(actor.id, c);
    }
    if (!c.avatarUrl && actor.avatarUrl) c.avatarUrl = actor.avatarUrl;
    if (!c.login && actor.login) c.login = actor.login;
    if (date < c.firstAt!) c.firstAt = date;
    if (date > c.lastAt!) {
      c.lastAt = date;
      if (actor.kind === 'human') c.name = actor.name; // 最新の表示名を使う
    }
    return c;
  }

  const aiActor = (tool: string): Actor => ({
    id: `ai:${tool}`, name: toolName(tool), login: null, avatarUrl: null, kind: 'ai',
  });

  type Delta = { lines?: number; commits?: number; add?: number; del?: number };

  /** 作者に加算し、AI 共著なら AI 側にも「共著ぶん」として加算する */
  function credit(author: RawAuthor, message: string, date: string, d: Delta) {
    const actor = actorOf(author);
    const coTool = actor.kind === 'ai' ? null : aiCoAuthor(message, author.name);
    const owner = touch(actor, date);
    const helper = coTool ? touch(aiActor(coTool), date) : null;

    for (const p of periodsOf(date)) {
      const m = owner.periods[p];
      m.lines += d.lines ?? 0;
      m.commits += d.commits ?? 0;
      m.add += d.add ?? 0;
      m.del += d.del ?? 0;
      for (const target of helper ? [m, helper.periods[p]] : []) {
        target.aiLines += d.lines ?? 0;
        target.aiCommits += d.commits ?? 0;
        target.aiAdd += d.add ?? 0;
        target.aiDel += d.del ?? 0;
      }
    }
    return { actor, tool: actor.kind === 'ai' ? actor.id.slice(3) : coTool };
  }

  // --- AI の集計 ---
  const tools = new Map<string, AiTool>();
  let aiFirstSeen: string | null = null;
  const toolEntry = (id: string) => {
    let t = tools.get(id);
    if (!t) tools.set(id, (t = { id, name: toolName(id), lines: 0, commits: 0 }));
    return t;
  };

  // --- ヒートマップ（直近 53 週・日曜始まり） ---
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - 364 * DAY);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const heatDays = new Array(Math.round((today.getTime() - start.getTime()) / DAY) + 1).fill(0);

  // --- 月別（直近 12 か月） ---
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const monthly = new Map(months.map((m) => [m, { month: m, human: 0, ai: 0 }]));

  let firstCommit = Infinity;
  let lastCommit = 0;

  for (const c of commits) {
    const { tool } = credit(c.author, c.message, c.date, {
      commits: 1, add: c.additions, del: c.deletions,
    });
    const t = new Date(c.date).getTime();
    firstCommit = Math.min(firstCommit, t);
    lastCommit = Math.max(lastCommit, t);

    if (tool) {
      toolEntry(tool).commits++;
      if (!aiFirstSeen || c.date < aiFirstSeen) aiFirstSeen = c.date;
    }
    const dayIndex = Math.floor((t - start.getTime()) / DAY);
    if (dayIndex >= 0 && dayIndex < heatDays.length) heatDays[dayIndex]++;
    const bucket = monthly.get(c.date.slice(0, 7));
    if (bucket) tool ? bucket.ai++ : bucket.human++;
  }

  // --- blame（現存行数・ファイル別オーナー） ---
  const files: FileOwnership[] = [];
  let totalLines = 0;

  for (const f of blame) {
    const owners = new Map<string, { actor: Actor; lines: number }>();
    let fileLines = 0;
    let lastUpdated: string | null = null;

    for (const r of f.ranges) {
      const { actor, tool } = credit(r.commit.author, r.commit.message, r.commit.date, { lines: r.lines });
      if (tool) toolEntry(tool).lines += r.lines;
      fileLines += r.lines;
      if (!lastUpdated || r.commit.date > lastUpdated) lastUpdated = r.commit.date;
      const o = owners.get(actor.id) ?? { actor, lines: 0 };
      o.lines += r.lines;
      owners.set(actor.id, o);
    }
    if (fileLines === 0) continue;
    totalLines += fileLines;
    const top = [...owners.values()].sort((a, b) => b.lines - a.lines)[0];
    files.push({
      path: f.path,
      lines: fileLines,
      owner: { id: top.actor.id, name: top.actor.name, kind: top.actor.kind },
      share: top.lines / fileLines,
      lastUpdated,
    });
  }

  const contributors = [...people.values()].sort(
    (a, b) => b.periods.all.lines - a.periods.all.lines || b.periods.all.commits - a.periods.all.commits,
  );

  // --- Bus factor: 現存コードの 50% を占める最少人数（bot 除外） ---
  const owners = contributors.filter((c) => c.kind !== 'bot').map((c) => c.periods.all.lines);
  const ownedTotal = owners.reduce((s, n) => s + n, 0);
  let busFactor = 0;
  for (let acc = 0; acc < ownedTotal / 2; busFactor++) acc += owners[busFactor];

  const humans = contributors.filter((c) => c.kind === 'human');
  const aiLines = [...tools.values()].reduce((s, t) => s + t.lines, 0);
  const aiCommits = [...tools.values()].reduce((s, t) => s + t.commits, 0);
  const weeks = Math.max(1, (lastCommit - firstCommit) / (7 * DAY));

  return {
    contributors,
    files: files.sort((a, b) => b.lines - a.lines).slice(0, 10),
    ai: {
      lines: aiLines,
      commits: aiCommits,
      firstSeen: aiFirstSeen,
      tools: [...tools.values()].sort((a, b) => b.lines - a.lines || b.commits - a.commits),
    },
    heatmap: { start: start.toISOString().slice(0, 10), days: heatDays },
    monthly: [...monthly.values()],
    totals: {
      contributors: humans.length,
      activeContributors90d: humans.filter((c) => c.periods['90'].commits > 0).length,
      lines: totalLines,
      weeklyAvgCommits: commits.length ? Math.round((commits.length / weeks) * 10) / 10 : 0,
      busFactor,
    },
  };
}

import { describe, expect, it } from 'vitest';
import { aiAuthor, aiCoAuthor } from './ai';
import { type RawAuthor, type RawCommit, analyze } from './analyze';

const NOW = Date.parse('2026-11-09T00:00:00Z');

const alice: RawAuthor = { name: 'Alice', email: 'alice@example.com', login: 'alice', avatarUrl: null };
const aliceNoLogin: RawAuthor = { name: 'Alice W', email: 'alice@example.com', login: null, avatarUrl: null };
const bob: RawAuthor = { name: 'Bob', email: 'bob@example.com', login: null, avatarUrl: null };
const dependabot: RawAuthor = { name: 'dependabot[bot]', email: '49699333+dependabot[bot]@users.noreply.github.com', login: null, avatarUrl: null };
const copilotAgent: RawAuthor = { name: 'copilot-swe-agent[bot]', email: '198982749+Copilot@users.noreply.github.com', login: null, avatarUrl: null };

const CLAUDE_TRAILER = 'feat: x\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

function commit(oid: string, author: RawAuthor, date: string, message = 'fix', add = 10, del = 2): RawCommit {
  return { oid, author, date, message, additions: add, deletions: del };
}

describe('ai', () => {
  it('Co-Authored-By から AI ツールを判定する', () => {
    expect(aiCoAuthor(CLAUDE_TRAILER)).toBe('claude');
    expect(aiCoAuthor('x\n\nCo-authored-by: Cursor Agent <cursoragent@cursor.com>')).toBe('cursor');
    expect(aiCoAuthor('x\n\nCo-authored-by: Taro <taro@example.com>')).toBeNull();
    expect(aiCoAuthor('🤖 Generated with [Claude Code](https://claude.com/claude-code)')).toBe('claude');
    expect(aiCoAuthor('x', 'Taro (aider)')).toBe('aider');
  });

  it('bot 作者のうち AI エージェントだけを AI とみなす', () => {
    expect(aiAuthor(copilotAgent.name, copilotAgent.email)).toBe('copilot');
    expect(aiAuthor(dependabot.name, dependabot.email)).toBeNull();
    expect(aiAuthor('Alice', 'alice@example.com')).toBeNull();
  });
});

describe('analyze', () => {
  const commits = [
    commit('c1', alice, '2024-01-10T00:00:00Z'),
    commit('c2', aliceNoLogin, '2026-10-20T00:00:00Z', CLAUDE_TRAILER, 100, 0),
    commit('c3', bob, '2026-11-01T00:00:00Z'),
    commit('c4', dependabot, '2026-11-02T00:00:00Z', 'bump', 1, 1),
    commit('c5', copilotAgent, '2026-11-03T00:00:00Z', 'agent', 50, 5),
  ];
  const meta = (c: RawCommit) => ({ oid: c.oid, author: c.author, date: c.date, message: c.message });
  const blame = [
    {
      path: 'src/a.ts',
      ranges: [
        { lines: 60, commit: meta(commits[0]) },
        { lines: 30, commit: meta(commits[1]) },
        { lines: 10, commit: meta(commits[2]) },
      ],
    },
    { path: 'src/b.ts', ranges: [{ lines: 20, commit: meta(commits[4]) }] },
  ];

  const result = analyze(commits, blame, NOW);
  const byId = (id: string) => result.contributors.find((c) => c.id === id)!;

  it('同じメールの別名コミットを 1 人にまとめる', () => {
    const a = byId('gh:alice');
    expect(a.periods.all.commits).toBe(2);
    expect(a.periods.all.lines).toBe(90);
    expect(result.contributors.filter((c) => c.kind === 'human')).toHaveLength(2);
  });

  it('AI 共著のぶんを作者と AI の両方に記録する', () => {
    const a = byId('gh:alice');
    expect(a.periods.all.aiLines).toBe(30);
    expect(a.periods.all.aiCommits).toBe(1);
    const claude = byId('ai:claude');
    expect(claude.periods.all.lines).toBe(0);
    expect(claude.periods.all.aiLines).toBe(30);
  });

  it('AI エージェントが作者のコミットは AI 自身の実績になる', () => {
    const copilot = byId('ai:copilot');
    expect(copilot.periods.all.lines).toBe(20);
    expect(copilot.periods.all.commits).toBe(1);
  });

  it('期間で絞り込める', () => {
    expect(byId('gh:alice').periods['30'].commits).toBe(1);
    expect(byId('gh:alice').periods['30'].lines).toBe(30);
  });

  it('AI 比率・ツール別・Bus factor を集計する', () => {
    expect(result.totals.lines).toBe(120);
    expect(result.ai.lines).toBe(50);
    expect(result.ai.commits).toBe(2);
    expect(result.ai.tools.map((t) => t.id)).toEqual(['claude', 'copilot']);
    expect(result.totals.busFactor).toBe(1);
    expect(result.totals.contributors).toBe(2);
  });

  it('ファイルの主な作者と割合を出す', () => {
    const a = result.files.find((f) => f.path === 'src/a.ts')!;
    expect(a.owner.id).toBe('gh:alice');
    expect(a.share).toBeCloseTo(0.9);
  });

  it('ヒートマップと月別を作る', () => {
    expect(result.heatmap.days.reduce((s, n) => s + n, 0)).toBe(4);
    expect(new Date(result.heatmap.start).getUTCDay()).toBe(0);
    const nov = result.monthly.find((m) => m.month === '2026-11')!;
    expect(nov).toEqual({ month: '2026-11', human: 2, ai: 1 });
    expect(result.monthly).toHaveLength(12);
  });
});

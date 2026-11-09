import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
const puts: { key: string; ttl?: number }[] = [];

vi.mock('void/env', () => ({
  env: { GITHUB_TOKEN: 't', MAX_COMMITS: 100, MAX_BLAME_FILES: 10, CACHE_TTL: 30 * 86400, REFRESH_INTERVAL: 86400 },
}));
vi.mock('void/kv', () => ({
  kv: {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: unknown, opts?: { ttl?: number }) => {
      store.set(key, value);
      puts.push({ key, ttl: opts?.ttl });
    },
  },
}));
const recordView = vi.fn(async () => {});
vi.mock('./repos', () => ({ recordView, saveRepo: vi.fn(async () => {}) }));
// GitHub への問い合わせが起きたら「再分析した」とみなす
const fetchRepo = vi.fn(async () => {
  throw new Error('rebuilt');
});
vi.mock('./github', () => ({ GitHub: class {}, fetchRepo, fetchCommits: vi.fn(), fetchSourceFiles: vi.fn(), fetchBlame: vi.fn() }));

const { cacheKey, getStats } = await import('./stats');

const HOUR = 3_600_000;

function cache(analyzedHoursAgo: number) {
  const analyzedAt = Date.now() - analyzedHoursAgo * HOUR;
  store.set(cacheKey('o', 'r'), {
    repo: { fullName: 'o/r' },
    meta: { analyzedAt: new Date(analyzedAt).toISOString(), refreshableAt: new Date(analyzedAt + 24 * HOUR).toISOString() },
  });
}

beforeEach(() => {
  store.clear();
  puts.length = 0;
  vi.clearAllMocks();
});

describe('getStats', () => {
  it('キャッシュがあればそれを返し、ビュー数を数える', async () => {
    cache(1);
    const stats = await getStats('O', 'R');
    expect(stats.meta.cached).toBe(true);
    expect(recordView).toHaveBeenCalledWith('o/r');
    expect(fetchRepo).not.toHaveBeenCalled();
  });

  it('分析から 1 日経っていなければ、更新を頼まれてもキャッシュを返す', async () => {
    cache(23);
    const stats = await getStats('o', 'r', true);
    expect(stats.meta.cached).toBe(true);
    expect(fetchRepo).not.toHaveBeenCalled();
  });

  it('1 日経っていれば、更新の依頼で分析し直す', async () => {
    cache(25);
    await expect(getStats('o', 'r', true)).rejects.toThrow('rebuilt');
    expect(fetchRepo).toHaveBeenCalled();
  });

  it('1 日経っていても、依頼がなければキャッシュを返す', async () => {
    cache(25);
    const stats = await getStats('o', 'r');
    expect(stats.meta.cached).toBe(true);
  });
});

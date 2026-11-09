import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('void/env', () => ({
  env: {
    GITHUB_TOKEN: 't',
    MAX_COMMITS: 100,
    MAX_BLAME_FILES: 10,
    CACHE_TTL: 30 * 86400,
    REFRESH_INTERVAL: 86400,
    RATE_LIMIT_RESERVE: 300,
  },
}));
vi.mock('void/kv', () => ({
  kv: {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: unknown) => void store.set(key, value),
  },
}));

const recordView = vi.fn(async () => {});
vi.mock('./repos', () => ({ recordView, saveRepo: vi.fn(async () => {}) }));

const lock = { acquired: true };
const releaseLock = vi.fn(async () => {});
vi.mock('./lock', () => ({
  acquireLock: vi.fn(async () => lock.acquired),
  finishLock: vi.fn(async () => {}),
  releaseLock,
}));

// GitHub への問い合わせが起きたら「分析を始めた」とみなす
const rate = { remaining: 5000 };
const fetchRepo = vi.fn(async () => {
  throw new Error('rebuilt');
});
vi.mock('./github', () => ({
  GitHub: class {
    graphqlRateLimit = async () => ({ limit: 5000, remaining: rate.remaining, reset: 1_762_675_200 });
  },
  fetchRepo,
  fetchCommits: vi.fn(),
  fetchSourceFiles: vi.fn(),
  fetchBlame: vi.fn(),
}));

const { cacheKey, getStats } = await import('./stats');

const HOUR = 3_600_000;

function cache(analyzedHoursAgo: number) {
  const analyzedAt = Date.now() - analyzedHoursAgo * HOUR;
  store.set(cacheKey('o', 'r'), {
    repo: { fullName: 'o/r' },
    meta: {
      analyzedAt: new Date(analyzedAt).toISOString(),
      refreshableAt: new Date(analyzedAt + 24 * HOUR).toISOString(),
    },
  });
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  lock.acquired = true;
  rate.remaining = 5000;
});

describe('getStats', () => {
  it('キャッシュがあればそれを返し、ビュー数を数える', async () => {
    cache(1);
    const res = await getStats('O', 'R');
    expect(res.status === 'ready' && res.stats.meta.cached).toBe(true);
    expect(recordView).toHaveBeenCalledWith('o/r');
    expect(fetchRepo).not.toHaveBeenCalled();
  });

  it('分析から 1 日経っていなければ、更新を頼まれてもキャッシュを返す', async () => {
    cache(23);
    const res = await getStats('o', 'r', true);
    expect(res.status).toBe('ready');
    expect(fetchRepo).not.toHaveBeenCalled();
  });

  it('1 日経っていれば、更新の依頼で分析し直す。失敗したらロックを外す', async () => {
    cache(25);
    await expect(getStats('o', 'r', true)).rejects.toThrow('rebuilt');
    expect(fetchRepo).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith('o/r');
  });

  it('ほかで分析中なら、結果がなければ pending を返す', async () => {
    lock.acquired = false;
    expect(await getStats('o', 'r')).toEqual({ status: 'pending' });
    expect(fetchRepo).not.toHaveBeenCalled();
  });

  it('ほかで再分析中なら、今の結果を返す', async () => {
    cache(25);
    lock.acquired = false;
    const res = await getStats('o', 'r', true);
    expect(res.status).toBe('ready');
    expect(fetchRepo).not.toHaveBeenCalled();
  });

  it('GitHub の残りポイントが少なければ、分析を始めずに断る', async () => {
    rate.remaining = 120;
    await expect(getStats('o', 'r')).rejects.toThrow('混み合っているため');
    expect(fetchRepo).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith('o/r');
  });
});

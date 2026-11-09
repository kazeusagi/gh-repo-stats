import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHub, fetchRepo } from './github';

const core = {
  name: 'next.js',
  nameWithOwner: 'vercel/next.js',
  defaultBranchRef: { name: 'canary', target: { oid: 'abc', history: { totalCount: 10 } } },
};

const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('fetchRepo', () => {
  it('読めない項目があっても、残りの項目で続行する', async () => {
    const denied = { message: 'Resource not accessible by personal access token', path: ['repository', 'openIssues'] };
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const { query } = JSON.parse(init.body as string) as { query: string };
      if (query.includes('nameWithOwner') && query.includes('watchers')) {
        return reply({ data: { repository: null }, errors: [denied] }); // 全項目まとめて
      }
      if (query.includes('nameWithOwner')) return reply({ data: { repository: core } });
      if (query.includes('issues(')) return reply({ data: { repository: null }, errors: [denied] });
      if (query.includes('watchers')) return reply({ data: { repository: { watchers: { totalCount: 5 } } } });
      return reply({ data: { repository: {} } });
    });

    const repo = await fetchRepo(new GitHub('t'), 'vercel', 'next.js');
    expect(repo.nameWithOwner).toBe('vercel/next.js');
    expect(repo.watchers?.totalCount).toBe(5);
    expect(repo.openIssues).toBeUndefined();
  });

  it('基本情報が読めないときは GitHub のエラー文と場所を返す', async () => {
    const denied = { message: 'Resource not accessible by personal access token', path: ['repository', 'owner'] };
    vi.stubGlobal('fetch', async () => reply({ data: { repository: null }, errors: [denied] }));
    await expect(fetchRepo(new GitHub('t'), 'vercel', 'next.js')).rejects.toThrow(
      'Resource not accessible by personal access token（repository.owner）',
    );
  });
});

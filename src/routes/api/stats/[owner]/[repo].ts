import { HTTPException } from 'hono/http-exception';
import { defineHandler } from 'void';
import { getStats } from '@/server/stats';

const NAME = /^[\w.-]{1,100}$/;

export const GET = defineHandler(async (c) => {
  const owner = c.req.param('owner') ?? '';
  const repo = c.req.param('repo') ?? '';
  if (!NAME.test(owner) || !NAME.test(repo)) {
    throw new HTTPException(400, { message: 'リポジトリ名が正しくありません' });
  }
  return getStats(owner, repo, c.req.query('refresh') === '1');
});

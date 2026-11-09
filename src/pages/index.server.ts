import { defineHandler, type InferProps } from 'void';
import { listRepos } from '@/server/repos';

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  // DB が使えなくてもトップ画面は表示する
  const repos = await listRepos().catch((e) => {
    console.error('listRepos failed', e);
    return [];
  });
  return { repos };
});

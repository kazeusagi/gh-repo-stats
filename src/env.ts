import { defineEnv, number, string } from 'void/env';

export default defineEnv({
  // GraphQL API に必要（public_repo 読み取り権限があれば OK）
  GITHUB_TOKEN: string(),
  // 取得するコミットの上限（100 件で 1 リクエスト）
  MAX_COMMITS: number().default(3000),
  // git blame をかけるファイル数の上限（サイズの大きい順。8 件で 1 リクエスト）
  MAX_BLAME_FILES: number().default(200),
  // 結果のキャッシュ秒数
  CACHE_TTL: number().default(3600),
});

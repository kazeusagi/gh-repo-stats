import { defineEnv, number, string } from 'void/env';

export default defineEnv({
  // GraphQL API に必要（公開リポジトリの読み取りだけの Fine-grained トークンで OK）
  GITHUB_TOKEN: string(),
  // 取得するコミットの上限（100 件で 1 リクエスト）
  MAX_COMMITS: number().default(3000),
  // git blame をかけるファイル数の上限（サイズの大きい順。8 件で 1 リクエスト）
  MAX_BLAME_FILES: number().default(200),
  // 分析結果を保持する秒数（30 日）
  CACHE_TTL: number().default(30 * 86400),
  // GraphQL の残りポイントがこれを下回ったら、新しい分析を断る（1 回の分析で約 60 ポイント）
  RATE_LIMIT_RESERVE: number().default(300),
  // 分析してから再分析を受け付けるまでの秒数（1 日）
  REFRESH_INTERVAL: number().default(86400),
});

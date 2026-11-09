# gh-repo-stats

GitHub リポジトリを分析して、誰が何行・何コミット書いたかのランキング、AI が関わったコードの割合、Star 数や npm の週間ダウンロード数などを表示する Web アプリです。

- フレームワーク: [Void](https://void.cloud)（Vite + Cloudflare Workers）
- UI: React / Tailwind CSS v4 / shadcn（Base UI 版, `base-nova`）
- デザインモック: [`design/`](./design)

## 表示する内容

| 項目 | 内容 |
| --- | --- |
| ランキング | 現存行数（git blame）・コミット数・追加行数・削除行数。期間で絞り込み、AI 共著ぶんの付け替え、bot の表示を切り替え可能 |
| リポジトリ | Star / Fork（30 日の増加数）、言語、ライセンス、トピック |
| npm | 週間・月間ダウンロード数、12 週の推移、最新バージョン、バージョン数、サイズ、依存数 |
| AI 支援率 | Co-Authored-By トレーラーと AI エージェントの bot 作者から判定（下限値） |
| アクティビティ | 1 年間のヒートマップ、月別コミット数（人のみ / AI 共著） |
| 健全性 | Issue / PR 数、PR マージまでの中央値、Issue クローズまでの中央値、リリース、Bus factor |
| ファイル | 行数の多いファイルと、その主な作者 |

## 仕組み

Cloudflare Workers では `git` を実行できないため、GitHub API でデータを集めます。

1. GraphQL でリポジトリ情報・コミット履歴（追加/削除行数とメッセージ付き）を取得
2. REST の `git/trees` でファイル一覧を取得し、サイズの大きいソースファイルから順に GraphQL の `blame` を実行
3. `src/server/analyze.ts` で人ごと・期間ごとに集計（同じメールのコミットは同一人物にまとめる）
4. 分析結果を Workers KV に 30 日間保存し、一覧用の情報とビュー数を D1 に記録

分析結果は 30 日間保持します。分析から 1 日経つと、画面の「データを更新」から再分析できます（それより前の依頼はサーバー側でも受け付けません）。トップ画面には、保持期間内のリポジトリをビュー数の多い順に表示します。

npm パッケージは `package.json` の `name` から探し、npm 側の `repository` がこのリポジトリを指している場合だけ表示します。

## セットアップ

```sh
npm install
echo "GITHUB_TOKEN=github_pat_xxx" > .env
npx void db migrate   # ローカルの D1 にテーブルを作成
npm run dev
```

`GITHUB_TOKEN` は GraphQL API に必要です。Fine-grained トークンで「Public repositories (read-only)」を選び、権限は何も付けずに発行してください。このトークンでは他人のリポジトリの Star 履歴が読めないため、Star の 30 日増加数は表示されません。

### 環境変数

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `GITHUB_TOKEN` | （必須） | GitHub のトークン |
| `MAX_COMMITS` | 3000 | 取得するコミット数の上限（100 件で 1 リクエスト） |
| `MAX_BLAME_FILES` | 200 | blame するファイル数の上限（8 件で 1 リクエスト） |
| `CACHE_TTL` | 2592000 | 分析結果を保持する秒数（30 日） |
| `REFRESH_INTERVAL` | 86400 | 分析から再分析を受け付けるまでの秒数（1 日） |
| `RATE_LIMIT_RESERVE` | 300 | GitHub GraphQL の残りポイントがこれを下回ったら新しい分析を断る |

上限を超えたぶんは画面下部に「何件中何件を分析したか」として表示されます。

### レート制限への対策

- 同じリポジトリの分析は同時に 1 つだけ走らせます（D1 の `analyses` テーブルでロック）。後から来たリクエストには `{ "status": "pending" }` を返し、画面が 5 秒おきに完了を確認します
- 分析を始める前に GitHub の `/rate_limit` で残りポイントを確認し、`RATE_LIMIT_RESERVE` を下回っていれば 503 で断ります
- 1 回の分析で使う GraphQL のポイントは、既定の上限で 60 前後です（1 時間あたり 5,000 ポイントまで）

## デプロイ

本番は https://ghrepostats.kazeusagi.dev です（`void.config.ts` の `cloudflare.routes` でカスタムドメインを設定）。`kazeusagi.dev` のゾーンがデプロイ先と同じ Cloudflare アカウントにあれば、DNS レコードと証明書は Cloudflare が自動で作ります。

```sh
npx void secret put GITHUB_TOKEN
npm run deploy   # D1 のマイグレーションも適用される
```

`src/db/schema.ts` を変更したら `npx void db generate` でマイグレーションを作り、コミットしてください。

既定の上限だと 1 回の分析で GitHub API へ 60 前後のリクエストを送ります。Workers の無料プランはサブリクエスト数や CPU 時間の上限が低いため、有料プランを使うか、`MAX_COMMITS` と `MAX_BLAME_FILES` を下げてください。

## 開発

```sh
npm test          # 集計ロジックのテスト
npm run typecheck
npm run build
```

### ディレクトリ

```
src/
  pages/            画面（/ と /:owner/:repo）。/ は分析済みリポジトリの一覧
  routes/api/       API（GET /api/stats/:owner/:repo、?refresh=1 で再分析。分析中は { status: "pending" }）
  server/           GitHub・npm からの取得と集計
  components/ui/    shadcn コンポーネント
  components/dashboard/  ダッシュボードの各カード
  db/               D1 のスキーマとマイグレーション
  env.ts            環境変数の定義
```

## 制限

- AI 支援率は署名が残っているコミットだけを数えるので、実際より少なく出ます
- blame は「最後にその行を変更した人」です。整形だけのコミットでも作者が変わります
- 非常に大きなファイルは GitHub 側で blame が失敗することがあり、その場合は集計から外れます

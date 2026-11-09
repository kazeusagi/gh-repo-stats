# gh-repo-stats

GitHub リポジトリを解析して、誰が何行・何コミット書いたかのランキング、AI が関わったコードの割合、Star 数や npm の週間ダウンロード数などを表示する Web アプリです。

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
4. 結果を Workers KV に `CACHE_TTL` 秒キャッシュ

npm パッケージは `package.json` の `name` から探し、npm 側の `repository` がこのリポジトリを指している場合だけ表示します。

## セットアップ

```sh
npm install
echo "GITHUB_TOKEN=ghp_xxx" > .env
npm run dev
```

`GITHUB_TOKEN` は GraphQL API に必要です。公開リポジトリだけなら、権限なしの fine-grained token で動きます。

### 環境変数

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `GITHUB_TOKEN` | （必須） | GitHub のトークン |
| `MAX_COMMITS` | 3000 | 取得するコミット数の上限（100 件で 1 リクエスト） |
| `MAX_BLAME_FILES` | 200 | blame するファイル数の上限（8 件で 1 リクエスト） |
| `CACHE_TTL` | 3600 | キャッシュ秒数 |

上限を超えたぶんは画面下部に「何件中何件を解析したか」として表示されます。

## デプロイ

```sh
npx void secret put GITHUB_TOKEN
npm run deploy
```

既定の上限だと 1 回の解析で GitHub API へ 60 前後のリクエストを送ります。Workers の無料プランはサブリクエスト数や CPU 時間の上限が低いため、有料プランを使うか、`MAX_COMMITS` と `MAX_BLAME_FILES` を下げてください。

## 開発

```sh
npm test          # 集計ロジックのテスト
npm run typecheck
npm run build
```

### ディレクトリ

```
src/
  pages/            画面（/ と /:owner/:repo）
  routes/api/       API（GET /api/stats/:owner/:repo、?refresh=1 で再解析）
  server/           GitHub・npm からの取得と集計
  components/ui/    shadcn コンポーネント
  components/dashboard/  ダッシュボードの各カード
  env.ts            環境変数の定義
```

## 制限

- AI 支援率は署名が残っているコミットだけを数えるので、実際より少なく出ます
- blame は「最後にその行を変更した人」です。整形だけのコミットでも作者が変わります
- 非常に大きなファイルは GitHub 側で blame が失敗することがあり、その場合は集計から外れます

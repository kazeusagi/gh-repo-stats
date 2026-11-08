# デザイン仕様

`index.html` はブラウザで直接開けるモックです（データはダミー）。

## コンセプト

- GitHub の UI に近い、技術者向けのダーク基調デザイン（ライト切替あり）
- 数値は `Geist Mono` で表示し、桁をそろえる（`tabular-nums`）
- 情報の密度は高めにし、装飾は控えめにする

## カラートークン

shadcn の CSS 変数名をそのまま使う。値は `index.html` の `:root` / `.dark` を参照。

| 変数 | 用途 |
| --- | --- |
| `--background` / `--card` / `--muted` | 背景の 3 段階 |
| `--border` | 境界線 |
| `--primary` | 主ボタン（GitHub の緑） |
| `--accent` | リンク・フォーカスリング |
| `--chart-1`〜`--chart-5` | グラフ（1: 人, 4: AI, 2/5: 追加/削除） |
| `--heat-0`〜`--heat-4` | コミットヒートマップ |

## 画面構成

1. **ヘッダー**: ロゴ / `owner/repo` 入力（⌘K でフォーカス）/ 解析ボタン / テーマ切替
2. **リポジトリ情報**: 名前、説明、トピック、言語、ライセンス、最新バージョン、作成日、最終 push
3. **KPI タイル（6 個）**: Stars、Forks、npm 週間 DL（スパークライン付き）、Contributors、Commits、現存行数
4. **メイン（左）**
   - コントリビューターランキング：現存行数 / コミット / 追加 / 削除 のタブで並び替え、期間フィルタ付き
   - コミットアクティビティ（GitHub 風ヒートマップ）
   - 月別コミット数（人のみ / AI 共著 の積み上げ）
   - ファイル別オーナーシップ
5. **サイドバー（右）**: AI 支援コード比率、言語、npm パッケージ、プロジェクトの健全性

## コンポーネント対応（shadcn + Base UI）

| モック | コンポーネント |
| --- | --- |
| カード | `Card` |
| ランキングのタブ | `Tabs`（Base UI） |
| 期間フィルタ | `Select`（Base UI） |
| ランキング / ファイル表 | `Table` |
| Public / 推定 などのラベル | `Badge` |
| アバター | `Avatar` |
| ツールチップ（グラフ・Bus factor） | `Tooltip`（Base UI） |
| リポジトリ入力 | `Input` + `Command`（⌘K） |
| グラフ | `Chart`（Recharts） |
| 解析中 | `Skeleton` |

## データソース

| 項目 | 取得元 |
| --- | --- |
| Stars / Forks / Issues / PR / トピック / ライセンス | GitHub REST API `GET /repos/{owner}/{repo}` |
| 言語の比率 | `GET /repos/{owner}/{repo}/languages` |
| リリース | `GET /repos/{owner}/{repo}/releases` |
| 人ごとの現存行数 | `git blame --line-porcelain -w -M -C` |
| 人ごとのコミット数・追加・削除 | `git log --numstat` |
| AI 共著の判定 | コミットの `Co-Authored-By` トレーラー、bot 作者 |
| npm の DL 数 | `api.npmjs.org/downloads/point/last-week/{pkg}`（`package.json` の `name` から判定） |
| npm のメタ情報 | `registry.npmjs.org/{pkg}` |

## 補足

- **Bus factor**: 現存コードの 50% を占めるのに必要な最少人数
- **AI 支援コード比率**: 署名がある分だけを数えるので「下限値」として表示する
- 同じ人の複数メールは `.mailmap` と GitHub アカウントの紐付けでまとめる
- bot（dependabot など）はデフォルトで除外し、切り替えられるようにする

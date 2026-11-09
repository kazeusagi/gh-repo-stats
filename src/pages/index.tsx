import { Link } from '@void/react';
import { BotIcon, PackageIcon, TrophyIcon } from 'lucide-react';
import { routeUrl } from 'void/routes';
import { RepoSearch } from '@/components/repo-search';

const EXAMPLES = ['vitejs/vite', 'honojs/hono', 'shadcn-ui/ui', 'mui/base-ui'];

const FEATURES = [
  { icon: TrophyIcon, title: '貢献者ランキング', text: 'git blame で今のコードを誰が書いたかを行単位で集計' },
  { icon: BotIcon, title: 'AI 支援率', text: 'Co-Authored-By などの署名から AI が関わったコードを検出' },
  { icon: PackageIcon, title: 'npm と GitHub の指標', text: 'Star の伸び、週間ダウンロード数、PR のマージ速度など' },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-20 pb-24 sm:pt-28">
      <p className="font-mono text-sm text-muted-foreground">$ repo-stats analyze</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        そのリポジトリ、
        <br className="sm:hidden" />
        誰が書いた？
      </h1>
      <p className="mt-3 text-muted-foreground">
        GitHub リポジトリを解析して、コントリビューターのランキングや AI が書いたコードの割合を表示します。
      </p>
      <div className="mt-8">
        <RepoSearch size="lg" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">例:</span>
        {EXAMPLES.map((name) => {
          const [owner, repo] = name.split('/');
          return (
            <Link
              key={name}
              href={routeUrl('/:owner/:repo', { params: { owner, repo } })}
              className="rounded-full border px-3 py-0.5 font-mono text-xs hover:border-muted-foreground"
            >
              {name}
            </Link>
          );
        })}
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-lg border bg-card p-4">
            <Icon className="size-5 text-link" />
            <h2 className="mt-3 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

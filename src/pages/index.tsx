import { Link } from '@void/react';
import { BotIcon, EyeIcon, PackageIcon, StarIcon, TrophyIcon } from 'lucide-react';
import { routeUrl } from 'void/routes';
import { RepoSearch } from '@/components/repo-search';
import { avatarSrc, formatCompact, timeAgo } from '@/lib/utils';
import type { Props } from './index.server';

const FEATURES = [
  { icon: TrophyIcon, title: '貢献者ランキング', text: 'git blame で、今のコードを誰が書いたかを行単位で集計' },
  { icon: BotIcon, title: 'AI 支援率', text: 'Co-Authored-By などの署名から、AI が関わったコードを検出' },
  { icon: PackageIcon, title: 'npm と GitHub の指標', text: 'Star 数、週間ダウンロード数、PR のマージ速度など' },
];

const repoHref = (fullName: string) => {
  const [owner, repo] = fullName.split('/');
  return routeUrl('/:owner/:repo', { params: { owner, repo } });
};

export default function HomePage({ repos }: Props) {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-16 pb-24 sm:pt-24">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm text-muted-foreground">$ repo-stats analyze</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">GitHub リポジトリを分析</h1>
        <p className="mt-3 text-muted-foreground">
          コントリビューターのランキング、AI が関わったコードの割合、Star 数や npm のダウンロード数をひと目で。
        </p>
        <div className="mt-8">
          <RepoSearch size="lg" />
        </div>
      </div>

      {repos.length > 0 && (
        <section className="mt-16">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">分析済みのリポジトリ</h2>
            <span className="text-xs text-muted-foreground">よく見られている順</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map((r) => (
              <Link
                key={r.id}
                href={repoHref(r.fullName)}
                className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <img src={avatarSrc(r.ownerAvatarUrl, 40)} alt="" className="size-5 rounded-full" />
                  <span className="truncate font-mono text-sm font-medium text-link">{r.fullName}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(r.analyzedAt)}</span>
                </div>
                <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{r.description ?? '説明なし'}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {r.language && (
                    <span className="flex items-center gap-1">
                      <span className="size-2.5 rounded-full" style={{ background: r.languageColor ?? '#8b949e' }} />
                      {r.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <StarIcon className="size-3" />
                    {formatCompact(r.stars)}
                  </span>
                  <span className="flex items-center gap-1 text-chart-4">
                    <BotIcon className="size-3" />
                    AI {(r.aiShare * 100).toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-1" title="ビュー数">
                    <EyeIcon className="size-3" />
                    {formatCompact(r.views)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

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

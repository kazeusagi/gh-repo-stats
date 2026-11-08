import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RepoStats } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { FileOwnership, Heatmap, MonthlyChart } from './activity';
import { KpiGrid } from './kpi-grid';
import { Ranking } from './ranking';
import { RepoHeader } from './repo-header';
import { AiShare, HealthCard, Languages, NpmCard } from './sidebar';

export function Dashboard({ stats, onRefresh }: { stats: RepoStats; onRefresh: () => void }) {
  const { totals, meta, repo } = stats;
  return (
    <>
      <RepoHeader stats={stats} />
      <KpiGrid stats={stats} />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Ranking contributors={stats.contributors} />
          <Heatmap heatmap={stats.heatmap} />
          <MonthlyChart monthly={stats.monthly} />
          <FileOwnership files={stats.files} repoUrl={repo.url} branch={repo.defaultBranch} />
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          <AiShare stats={stats} />
          <Languages languages={repo.languages} />
          {stats.npm && <NpmCard npm={stats.npm} />}
          <HealthCard stats={stats} />
        </aside>
      </div>
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t py-5 text-xs text-muted-foreground">
        <div className="flex flex-col gap-1">
          <span>
            解析 {new Date(meta.analyzedAt).toLocaleString('ja-JP')} · <span className="font-mono">{repo.headSha.slice(0, 7)}</span> ·{' '}
            {(meta.durationMs / 1000).toFixed(1)}s{meta.cached && ' · キャッシュ'}
          </span>
          <span>
            コミット {formatNumber(totals.analyzedCommits)} / {formatNumber(totals.commits)} 件、blame{' '}
            {formatNumber(totals.blamedFiles)} / {formatNumber(totals.files)} ファイル（コード量の{' '}
            {Math.round(totals.blameCoverage * 100)}%）を解析
            {meta.commitsTruncated && '。古いコミットは省略しています'}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCwIcon /> 再解析
        </Button>
      </footer>
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true">
      <div className="flex items-start gap-5 py-7">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-lg" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[560px] rounded-lg" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

import { FileCodeIcon, GitCommitIcon, GitForkIcon, PackageIcon, StarIcon, UsersIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { RepoStats } from '@/lib/types';
import { formatCompact, formatNumber } from '@/lib/utils';

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${32 - ((v - min) / (max - min || 1)) * 28}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="mt-1 h-8 w-full">
      <polyline points={points} fill="none" stroke="var(--chart-1)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-lg px-4 py-3.5 ring-border">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-[26px] leading-tight font-semibold tracking-tight tabular">{value}</div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">{children}</div>
    </Card>
  );
}

function Growth({ value, capped }: { value: number | null; capped: boolean }) {
  if (value === null) return null;
  return (
    <>
      <span className="font-medium text-chart-2">
        +{formatNumber(value)}
        {capped && '+'}
      </span>
      <span>30日</span>
    </>
  );
}

export function KpiGrid({ stats }: { stats: RepoStats }) {
  const { repo, growth, npm, totals } = stats;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi icon={StarIcon} label="Stars" value={formatNumber(repo.stars)}>
        <Growth value={growth.stars30d} capped={growth.stars30dCapped} />
      </Kpi>
      <Kpi icon={GitForkIcon} label="Forks" value={formatNumber(repo.forks)}>
        <Growth value={growth.forks30d} capped={growth.forks30dCapped} />
      </Kpi>
      {npm ? (
        <Card className="gap-0 rounded-lg px-4 py-3.5 ring-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PackageIcon className="size-3.5" />
            npm 週間 DL
          </div>
          <div className="mt-1 text-[26px] leading-tight font-semibold tracking-tight tabular">{formatCompact(npm.weekly)}</div>
          <Sparkline values={npm.weeklySeries} />
        </Card>
      ) : (
        <Kpi icon={PackageIcon} label="npm 週間 DL" value="—">
          <span>npm 未公開</span>
        </Kpi>
      )}
      <Kpi icon={UsersIcon} label="Contributors" value={formatNumber(totals.contributors)}>
        <span>直近90日 アクティブ {totals.activeContributors90d}</span>
      </Kpi>
      <Kpi icon={GitCommitIcon} label="Commits" value={formatNumber(totals.commits)}>
        <span>週平均 {totals.weeklyAvgCommits}</span>
      </Kpi>
      <Kpi icon={FileCodeIcon} label="現存行数" value={formatNumber(totals.lines)}>
        <span>{formatNumber(totals.blamedFiles)} ファイル</span>
      </Kpi>
    </section>
  );
}

import { BotIcon, ExternalLinkIcon, InfoIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RepoStats } from '@/lib/types';
import { formatDuration, formatNumber, timeAgo } from '@/lib/utils';
import { Dot, KeyValue, Panel, StackBar } from './parts';

const TOOL_COLORS = ['var(--chart-4)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-5)', '#8b949e'];

export function AiShare({ stats }: { stats: RepoStats }) {
  const { ai, totals } = stats;
  const share = totals.lines ? ai.lines / totals.lines : 0;
  const toolTotal = ai.tools.reduce((s, t) => s + t.lines, 0);

  return (
    <Panel
      title={
        <>
          <BotIcon className="size-4 text-chart-4" />
          AI 支援コード比率
        </>
      }
      aside={<Badge variant="outline" className="text-muted-foreground">推定・下限値</Badge>}
    >
      <div className="flex items-center gap-4 p-4">
        <svg viewBox="0 0 36 36" className="size-24 shrink-0">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--muted)" strokeWidth="3.5" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="var(--chart-4)"
            strokeWidth="3.5"
            strokeDasharray={`${share * 100} 100`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
            pathLength={100}
          />
          <text x="18" y="20.5" textAnchor="middle" fontSize="7" fontWeight="600" fill="var(--foreground)">
            {(share * 100).toFixed(1)}%
          </text>
        </svg>
        <div className="flex-1">
          <KeyValue label="AI 共著の行">{formatNumber(ai.lines)}</KeyValue>
          <KeyValue label="AI 共著コミット">{formatNumber(ai.commits)}</KeyValue>
          <KeyValue label="初出">{ai.firstSeen?.slice(0, 7) ?? '—'}</KeyValue>
        </div>
      </div>
      <div className="px-4 pb-4">
        {toolTotal > 0 && (
          <>
            <StackBar
              items={ai.tools.map((t, i) => ({ key: t.id, share: t.lines / toolTotal, color: TOOL_COLORS[i % TOOL_COLORS.length] }))}
            />
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {ai.tools.map((t, i) => (
                <span key={t.id} className="flex items-center gap-1.5">
                  <Dot color={TOOL_COLORS[i % TOOL_COLORS.length]} />
                  {t.name} {Math.round((t.lines / toolTotal) * 100)}%
                </span>
              ))}
            </div>
          </>
        )}
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          Co-Authored-By トレーラー・AI エージェントの bot 作者から判定しています。署名なしの AI 利用は含まれません。
        </p>
      </div>
    </Panel>
  );
}

export function Languages({ languages }: { languages: RepoStats['repo']['languages'] }) {
  if (languages.length === 0) return null;
  return (
    <Panel title="言語">
      <div className="p-4">
        <StackBar items={languages.map((l) => ({ key: l.name, share: l.share, color: l.color }))} />
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {languages.map((l) => (
            <span key={l.name} className="flex items-center gap-1.5">
              <Dot color={l.color} />
              {l.name} <span className="text-muted-foreground">{(l.share * 100).toFixed(1)}%</span>
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function formatBytes(n: number | null) {
  if (n === null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function NpmCard({ npm }: { npm: NonNullable<RepoStats['npm']> }) {
  return (
    <Panel
      title={
        <>
          <span className="rounded-[3px] bg-[#cb3837] px-1 font-mono text-[11px] text-white">npm</span>
          <span className="font-mono">{npm.name}</span>
        </>
      }
      aside={
        <a href={npm.url} className="flex items-center gap-1 text-xs text-link hover:underline">
          npmjs.com <ExternalLinkIcon className="size-3" />
        </a>
      }
    >
      <div className="px-4 py-2.5">
        <KeyValue label="最新バージョン">{npm.version}</KeyValue>
        <KeyValue label="週間 DL">{formatNumber(npm.weekly)}</KeyValue>
        <KeyValue label="月間 DL">{formatNumber(npm.monthly)}</KeyValue>
        <KeyValue label="バージョン数">{formatNumber(npm.versions)}</KeyValue>
        <KeyValue label="Unpacked size">{formatBytes(npm.unpackedSize)}</KeyValue>
        <KeyValue label="依存パッケージ">{npm.dependencies}</KeyValue>
      </div>
    </Panel>
  );
}

export function HealthCard({ stats }: { stats: RepoStats }) {
  const { health, totals, repo } = stats;
  return (
    <Panel title="プロジェクトの健全性">
      <div className="px-4 py-2.5">
        <KeyValue label="Open Issues">{formatNumber(health.openIssues)}</KeyValue>
        <KeyValue label="Closed Issues">{formatNumber(health.closedIssues)}</KeyValue>
        <KeyValue label="Open PRs">{formatNumber(health.openPRs)}</KeyValue>
        <KeyValue label="Merged PRs">{formatNumber(health.mergedPRs)}</KeyValue>
        <KeyValue label="PR マージまでの中央値">{formatDuration(health.prMergeMedianHours)}</KeyValue>
        <KeyValue label="Issue クローズまでの中央値">{formatDuration(health.issueCloseMedianHours)}</KeyValue>
        <KeyValue label="Watchers">{formatNumber(repo.watchers)}</KeyValue>
        <KeyValue label="リリース数">{formatNumber(health.releases)}</KeyValue>
        <KeyValue label="最終リリース">
          {health.latestRelease ? `${health.latestRelease.tag} · ${timeAgo(health.latestRelease.publishedAt)}` : '—'}
        </KeyValue>
        <KeyValue
          label={
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                Bus factor <InfoIcon className="size-3" />
              </TooltipTrigger>
              <TooltipContent>現存コードの 50% を占めるのに必要な最少人数</TooltipContent>
            </Tooltip>
          }
        >
          <span className={totals.busFactor <= 2 ? 'text-chart-3' : undefined}>{totals.busFactor}</span>
        </KeyValue>
      </div>
    </Panel>
  );
}

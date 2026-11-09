import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RepoStats } from '@/lib/types';
import { formatNumber, timeAgo } from '@/lib/utils';
import { AiTag, Panel } from './parts';

const DAY = 86_400_000;

function level(count: number, max: number) {
  if (count === 0) return 0;
  const r = count / max;
  return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4;
}

export function Heatmap({ heatmap }: { heatmap: RepoStats['heatmap'] }) {
  const start = new Date(`${heatmap.start}T00:00:00Z`).getTime();
  const max = Math.max(...heatmap.days, 1);
  const total = heatmap.days.reduce((s, n) => s + n, 0);
  const weeks = Math.ceil(heatmap.days.length / 7);

  // 各月の最初の週に月ラベルを置く
  const monthLabels = Array.from({ length: weeks }, (_, w) => {
    const d = new Date(start + w * 7 * DAY);
    return d.getUTCDate() <= 7 ? `${d.getUTCMonth() + 1}月` : '';
  });

  return (
    <Panel
      title="コミットアクティビティ"
      aside={<span className="text-xs text-muted-foreground">過去 1 年間に {formatNumber(total)} コミット</span>}
    >
      <div className="overflow-x-auto p-4">
        <div className="w-max">
          <div className="mb-1 grid auto-cols-[11px] grid-flow-col gap-[3px] text-[10px] text-muted-foreground">
            {monthLabels.map((m, i) => (
              <span key={i} className="overflow-visible whitespace-nowrap">
                {m}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
            {heatmap.days.map((count, i) => (
              <span
                key={i}
                title={`${new Date(start + i * DAY).toISOString().slice(0, 10)}: ${count} コミット`}
                className="size-[11px] rounded-[2px] outline outline-foreground/5 -outline-offset-1"
                style={{ background: `var(--heat-${level(count, max)})` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-[3px] text-xs text-muted-foreground">
          少
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="size-[11px] rounded-[2px]" style={{ background: `var(--heat-${l})` }} />
          ))}
          多
        </div>
      </div>
    </Panel>
  );
}

export function MonthlyChart({ monthly }: { monthly: RepoStats['monthly'] }) {
  const peak = Math.max(...monthly.map((m) => m.human + m.ai), 1);
  return (
    <Panel
      title="月別コミット数"
      aside={
        <div className="flex gap-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-chart-1" />人のみ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-chart-4" />AI 共著
          </span>
        </div>
      }
    >
      <div className="p-4">
        <div className="flex h-40 items-end gap-1.5">
          {monthly.map((m) => (
            <div
              key={m.month}
              title={`${m.month}: 人 ${m.human} / AI ${m.ai}`}
              className="flex h-full flex-1 flex-col-reverse gap-0.5"
            >
              <div className="bg-chart-1" style={{ height: `${(m.human / peak) * 100}%` }} />
              <div className="rounded-t-[3px] bg-chart-4" style={{ height: `${(m.ai / peak) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 font-mono text-[11px] text-muted-foreground">
          {monthly.map((m) => (
            <span key={m.month} className="flex-1 text-center">
              {Number(m.month.slice(5))}月
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function FileOwnership({ files, repoUrl, branch }: { files: RepoStats['files']; repoUrl: string; branch: string }) {
  return (
    <Panel title="ファイル別オーナーシップ" aside={<span className="text-xs text-muted-foreground">行数の多い順</span>}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">ファイル</TableHead>
            <TableHead className="text-right">行数</TableHead>
            <TableHead>主な作者</TableHead>
            <TableHead className="hidden pr-4 text-right sm:table-cell">最終更新</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((f) => (
            <TableRow key={f.path}>
              <TableCell className="max-w-72 truncate pl-4 font-mono text-[13px]">
                <a href={`${repoUrl}/blame/${branch}/${f.path}`} className="hover:text-link hover:underline">
                  {f.path}
                </a>
              </TableCell>
              <TableCell className="text-right font-mono tabular">{formatNumber(f.lines)}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5">
                  {f.owner.name}
                  {f.owner.kind === 'ai' && <AiTag />}
                  <span className="text-muted-foreground">{Math.round(f.share * 100)}%</span>
                </span>
              </TableCell>
              <TableCell className="hidden pr-4 text-right text-muted-foreground sm:table-cell">
                {timeAgo(f.lastUpdated)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

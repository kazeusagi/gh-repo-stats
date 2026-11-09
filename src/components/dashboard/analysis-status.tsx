import { ClockIcon, RefreshCwIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { RepoStats } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

function timeUntil(ms: number) {
  const hours = Math.ceil(ms / 3_600_000);
  return hours >= 2 ? `${hours} 時間後` : `${Math.max(1, Math.ceil(ms / 60_000))} 分後`;
}

/** 分析日時と、1 日経ったら押せる更新ボタン */
type Props = {
  meta: RepoStats['meta'];
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function AnalysisStatus({ meta, refreshing, error, onRefresh }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const analyzedAt = new Date(meta.analyzedAt);
  const remaining = new Date(meta.refreshableAt).getTime() - now;
  const canRefresh = remaining <= 0;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <ClockIcon className="size-4" />
          分析日時
          <span className="font-mono text-foreground tabular">
            {analyzedAt.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
          （{timeAgo(meta.analyzedAt, now)}）
        </span>
        <span className="flex items-center gap-3">
          {refreshing ? (
            <span className="text-xs text-muted-foreground">分析し直しています…</span>
          ) : (
            !canRefresh && <span className="text-xs text-muted-foreground">{timeUntil(remaining)}に更新できます</span>
          )}
          <Button variant="outline" size="sm" disabled={!canRefresh || refreshing} onClick={onRefresh}>
            <RefreshCwIcon className={cn(refreshing && 'animate-spin')} /> データを更新
          </Button>
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">更新できませんでした: {error}</p>}
    </div>
  );
}

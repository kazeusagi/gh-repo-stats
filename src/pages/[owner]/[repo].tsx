import { useParams } from '@void/react';
import { LoaderCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FetchError, fetch } from 'void/client';
import { Dashboard, DashboardSkeleton } from '@/components/dashboard/dashboard';
import { Button } from '@/components/ui/button';
import type { RepoStats, StatsResponse } from '@/lib/types';

// ほかの人が分析中のとき、完了を確認する間隔と上限
const POLL_MS = 5_000;
const POLL_LIMIT = 60;

type State =
  | { status: 'loading'; waiting: boolean }
  | { status: 'error'; message: string }
  | { status: 'ok'; stats: RepoStats; refreshing: boolean; refreshError: string | null };

class PollTimeout extends Error {}

function errorMessage(e: unknown) {
  if (e instanceof PollTimeout) return e.message;
  if (!(e instanceof FetchError)) return 'ネットワークエラーが発生しました';
  // API のエラーはテキストで返る
  if (typeof e.data === 'string' && e.data) return e.data;
  return (e.data as { message?: string } | null)?.message ?? `エラーが発生しました (${e.status})`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function RepoPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [state, setState] = useState<State>({ status: 'loading', waiting: false });
  const run = useRef(0);

  /** 結果が出るまで取得する。分析中（pending）なら待ってから取り直す */
  const load = useCallback(
    async (refresh: boolean) => {
      const id = ++run.current;
      const current = () => id === run.current;
      for (let i = 0; i < POLL_LIMIT; i++) {
        const res = (await fetch('/api/stats/:owner/:repo', {
          params: { owner, repo },
          // 更新の依頼は最初の 1 回だけ送る
          query: refresh && i === 0 ? { refresh: '1' } : {},
        })) as StatsResponse;
        if (!current()) return null;
        if (res.status === 'ready') return res.stats;
        setState((s) => (s.status === 'ok' ? s : { status: 'loading', waiting: true }));
        await sleep(POLL_MS);
        if (!current()) return null;
      }
      throw new PollTimeout('分析に時間がかかっています。しばらくしてから開き直してください');
    },
    [owner, repo],
  );

  useEffect(() => {
    setState({ status: 'loading', waiting: false });
    load(false)
      .then((stats) => stats && setState({ status: 'ok', stats, refreshing: false, refreshError: null }))
      .catch((e: unknown) => setState({ status: 'error', message: errorMessage(e) }));
    return () => {
      run.current++;
    };
  }, [load]);

  const refresh = () => {
    if (state.status !== 'ok') return;
    setState({ ...state, refreshing: true, refreshError: null });
    load(true)
      .then((stats) => stats && setState({ status: 'ok', stats, refreshing: false, refreshError: null }))
      // 更新に失敗しても、今の結果は表示したままにする
      .catch((e: unknown) =>
        setState((s) => (s.status === 'ok' ? { ...s, refreshing: false, refreshError: errorMessage(e) } : s)),
      );
  };

  const retry = () => {
    setState({ status: 'loading', waiting: false });
    load(false)
      .then((stats) => stats && setState({ status: 'ok', stats, refreshing: false, refreshError: null }))
      .catch((e: unknown) => setState({ status: 'error', message: errorMessage(e) }));
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
      {state.status === 'loading' && (
        <>
          <p className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            <span className="font-mono">
              {owner}/{repo}
            </span>
            {state.waiting
              ? 'はほかの人が分析中です。完了を待っています'
              : 'を分析しています。初回は数十秒かかることがあります'}
          </p>
          <DashboardSkeleton />
        </>
      )}
      {state.status === 'error' && (
        <div className="mx-auto mt-20 max-w-md rounded-lg border bg-card p-6 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            {owner}/{repo}
          </p>
          <p className="mt-2 font-semibold">{state.message}</p>
          <Button variant="outline" className="mt-4" onClick={retry}>
            再試行
          </Button>
        </div>
      )}
      {state.status === 'ok' && (
        <Dashboard
          stats={state.stats}
          refreshing={state.refreshing}
          refreshError={state.refreshError}
          onRefresh={refresh}
        />
      )}
    </main>
  );
}

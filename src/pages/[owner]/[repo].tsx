import { useParams } from '@void/react';
import { LoaderCircleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FetchError, fetch } from 'void/client';
import { Dashboard, DashboardSkeleton } from '@/components/dashboard/dashboard';
import { Button } from '@/components/ui/button';
import type { RepoStats } from '@/lib/types';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; stats: RepoStats };

function errorMessage(e: unknown) {
  if (!(e instanceof FetchError)) return 'ネットワークエラーが発生しました';
  // API のエラーはテキストで返る
  if (typeof e.data === 'string' && e.data) return e.data;
  return (e.data as { message?: string } | null)?.message ?? `エラーが発生しました (${e.status})`;
}

export default function RepoPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetch('/api/stats/:owner/:repo', {
      params: { owner, repo },
      query: refresh ? { refresh: '1' } : {},
    })
      .then((stats) => !cancelled && setState({ status: 'ok', stats: stats as RepoStats }))
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', message: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, refresh]);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
      {state.status === 'loading' && (
        <>
          <p className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            <span className="font-mono">
              {owner}/{repo}
            </span>
            を解析しています。初回は数十秒かかることがあります
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
          <Button variant="outline" className="mt-4" onClick={() => setRefresh((n) => n + 1)}>
            再試行
          </Button>
        </div>
      )}
      {state.status === 'ok' && <Dashboard stats={state.stats} onRefresh={() => setRefresh((n) => n + 1)} />}
    </main>
  );
}

import { TrophyIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Contributor, Metrics, Period } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { AiTag, Panel, PersonAvatar } from './parts';

type Key = 'lines' | 'commits' | 'add' | 'del';

const KEYS: { key: Key; label: string; head: string }[] = [
  { key: 'lines', label: '現存行数', head: '現存行数（git blame）' },
  { key: 'commits', label: 'コミット', head: 'コミット数' },
  { key: 'add', label: '追加', head: '追加行数' },
  { key: 'del', label: '削除', head: '削除行数' },
];

const PERIOD_LABELS: Record<Period, string> = { all: '全期間', '365': '1年', '90': '90日', '30': '30日' };

const AI_KEY = { lines: 'aiLines', commits: 'aiCommits', add: 'aiAdd', del: 'aiDel' } as const satisfies Record<Key, keyof Metrics>;

/** AI 共著ぶんを AI 側に付け替えるかどうかで値が変わる */
function valueOf(c: Contributor, period: Period, key: Key, separateAi: boolean) {
  const m = c.periods[period];
  if (!separateAi) return m[key];
  return c.kind === 'ai' ? m[key] + m[AI_KEY[key]] : m[key] - m[AI_KEY[key]];
}

const RANK_STYLES = [
  'bg-[#e3b341]/20 text-[#e3b341]',
  'bg-[#9ca3af]/20 text-[#b1bac4]',
  'bg-[#db8a4a]/20 text-[#db8a4a]',
];

const PAGE = 10;

export function Ranking({ contributors }: { contributors: Contributor[] }) {
  const [key, setKey] = useState<Key>('lines');
  const [period, setPeriod] = useState<Period>('all');
  const [separateAi, setSeparateAi] = useState(true);
  const [showBots, setShowBots] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    return contributors
      .filter((c) => showBots || c.kind !== 'bot')
      .map((c) => ({
        c,
        value: valueOf(c, period, key, separateAi),
        commits: valueOf(c, period, 'commits', separateAi),
        add: valueOf(c, period, 'add', separateAi),
        del: valueOf(c, period, 'del', separateAi),
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [contributors, key, period, separateAi, showBots]);

  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = rows[0]?.value ?? 1;
  const head = KEYS.find((k) => k.key === key)!.head;

  return (
    <Panel
      title={
        <>
          <TrophyIcon className="size-4 text-[#e3b341]" />
          コントリビューター ランキング
        </>
      }
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={key} onValueChange={(v) => setKey(v as Key)}>
            <TabsList>
              {KEYS.map((k) => (
                <TabsTrigger key={k.key} value={k.key} className="px-2.5">
                  {k.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger size="sm" className="w-24">
              <SelectValue>{(v: Period) => PERIOD_LABELS[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-2">
          <Switch size="sm" checked={separateAi} onCheckedChange={setSeparateAi} />
          AI 共著のぶんを AI として数える
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <Switch size="sm" checked={showBots} onCheckedChange={setShowBots} />
          bot を含める
        </label>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 pl-4">#</TableHead>
            <TableHead>コントリビューター</TableHead>
            <TableHead>{head}</TableHead>
            <TableHead className="text-right">コミット</TableHead>
            <TableHead className="hidden text-right md:table-cell">追加 / 削除</TableHead>
            <TableHead className="hidden pr-4 text-right lg:table-cell">活動期間</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, limit).map(({ c, value, commits, add, del }, i) => (
            <TableRow key={c.id}>
              <TableCell className="pl-4">
                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-full text-[13px] font-semibold',
                    RANK_STYLES[i] ?? 'text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex min-w-44 items-center gap-2.5">
                  <PersonAvatar id={c.id} name={c.name} avatarUrl={c.avatarUrl} kind={c.kind} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {c.login ? (
                        <a href={`https://github.com/${c.login}`} className="truncate hover:underline">
                          {c.name}
                        </a>
                      ) : (
                        <span className="truncate">{c.name}</span>
                      )}
                      {c.kind === 'ai' && <AiTag />}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {c.login ? `@${c.login}` : c.kind === 'ai' ? 'AI エージェント' : 'GitHub 未連携'}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="min-w-48">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-mono tabular">{formatNumber(value)}</span>
                  <span className="text-muted-foreground">{((value / total) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div
                    className={cn('h-full rounded', c.kind === 'ai' ? 'bg-chart-4' : 'bg-chart-1')}
                    style={{ width: `${(value / max) * 100}%` }}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right font-mono tabular">{formatNumber(commits)}</TableCell>
              <TableCell className="hidden text-right font-mono tabular md:table-cell">
                <span className="text-chart-2">+{formatNumber(add)}</span>{' '}
                <span className="text-chart-5">−{formatNumber(del)}</span>
              </TableCell>
              <TableCell className="hidden pr-4 text-right text-xs text-muted-foreground lg:table-cell">
                {c.firstAt?.slice(0, 7)} 〜 {c.lastAt?.slice(0, 7)}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                この期間のデータはありません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex flex-wrap justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
        <span>
          上位 {Math.min(limit, rows.length)} / {rows.length} 人を表示
        </span>
        {rows.length > limit && (
          <button type="button" className="text-link hover:underline" onClick={() => setLimit((n) => n + 20)}>
            さらに表示 →
          </button>
        )}
      </div>
    </Panel>
  );
}

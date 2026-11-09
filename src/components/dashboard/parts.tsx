// ダッシュボード内で使い回す小さな部品
import { BotIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import type { ContributorKind } from '@/lib/types';
import { avatarSrc, cn } from '@/lib/utils';

export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('gap-0 rounded-lg py-0 ring-border', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export function KeyValue({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed py-1.5 text-[13px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular">{children}</span>
    </div>
  );
}

const PALETTE = ['#4493f8', '#3fb950', '#d29922', '#f85149', '#db61a2', '#39c5cf', '#e3b341', '#8b949e'];

function colorOf(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function PersonAvatar({
  id,
  name,
  avatarUrl,
  kind,
  className,
}: {
  id: string;
  name: string;
  avatarUrl?: string | null;
  kind: ContributorKind;
  className?: string;
}) {
  if (kind === 'ai') {
    return (
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-chart-4/20 text-chart-4', className)}>
        <BotIcon className="size-4" />
      </span>
    );
  }
  return (
    <Avatar className={cn('size-8', className)}>
      {avatarUrl && <AvatarImage src={avatarSrc(avatarUrl, 64)} alt="" />}
      <AvatarFallback className="text-xs font-semibold text-white" style={{ background: colorOf(id) }}>
        {name.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export function AiTag() {
  return (
    <span className="inline-flex h-[18px] items-center rounded bg-chart-4/15 px-1.5 text-[11px] font-medium text-chart-4">AI</span>
  );
}

export function Dot({ color }: { color: string | null }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color ?? '#8b949e' }} />;
}

/** 割合を横に並べたバー（言語・AI ツール） */
export function StackBar({ items }: { items: { key: string; share: number; color: string | null }[] }) {
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded">
      {items.map((i) => (
        <span key={i.key} style={{ width: `${i.share * 100}%`, background: i.color ?? '#8b949e' }} />
      ))}
    </div>
  );
}

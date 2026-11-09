import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number) {
  return n.toLocaleString('en-US');
}

export function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return formatNumber(n);
}

export function timeAgo(iso: string | null, now = Date.now()) {
  if (!iso) return '—';
  const sec = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}分前`;
  if (sec < 86400) return `${Math.round(sec / 3600)}時間前`;
  if (sec < 86400 * 30) return `${Math.round(sec / 86400)}日前`;
  if (sec < 86400 * 365) return `${Math.round(sec / 86400 / 30)}か月前`;
  return `${(sec / 86400 / 365).toFixed(1)}年前`;
}

export function formatDuration(hours: number | null) {
  if (hours === null) return '—';
  if (hours < 24) return `${hours.toFixed(1)} 時間`;
  return `${(hours / 24).toFixed(1)} 日`;
}

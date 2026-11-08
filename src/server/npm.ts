// npm レジストリと downloads API からの取得
import type { NpmStats } from '../lib/types';

const DAY = 86_400_000;

async function getJson<T>(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': 'gh-repo-stats', ...headers } });
  return res.ok ? ((await res.json()) as T) : null;
}

/** package.json の中身から、公開されている npm パッケージ名を取り出す */
export function packageNameOf(packageJson: string | null | undefined) {
  if (!packageJson) return null;
  try {
    const pkg = JSON.parse(packageJson) as { name?: string; private?: boolean };
    return pkg.name && !pkg.private ? pkg.name : null;
  } catch {
    return null;
  }
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export async function fetchNpm(name: string, fullName: string): Promise<NpmStats | null> {
  const encoded = name.replace('/', '%2F');
  type Latest = {
    version: string;
    license?: string;
    repository?: string | { url?: string };
    dependencies?: Record<string, string>;
    dist?: { unpackedSize?: number };
  };
  const latest = await getJson<Latest>(`https://registry.npmjs.org/${encoded}/latest`);
  if (!latest) return null;

  // 同名の別パッケージを拾わないよう、repository がこのリポジトリを指すか確認する
  const repoUrl = typeof latest.repository === 'string' ? latest.repository : latest.repository?.url ?? '';
  if (!repoUrl.toLowerCase().includes(fullName.toLowerCase())) return null;

  const now = Date.now();
  const [abbrev, week, month, range] = await Promise.all([
    getJson<{ versions: Record<string, unknown> }>(`https://registry.npmjs.org/${encoded}`, {
      Accept: 'application/vnd.npm.install-v1+json',
    }),
    getJson<{ downloads: number }>(`https://api.npmjs.org/downloads/point/last-week/${name}`),
    getJson<{ downloads: number }>(`https://api.npmjs.org/downloads/point/last-month/${name}`),
    getJson<{ downloads: { day: string; downloads: number }[] }>(
      `https://api.npmjs.org/downloads/range/${day(now - 85 * DAY)}:${day(now - DAY)}/${name}`,
    ),
  ]);

  // 日別を 12 週ぶんの合計にまとめる（古い順）
  const daily = range?.downloads ?? [];
  const weeklySeries: number[] = [];
  for (let end = daily.length; end - 7 >= 0 && weeklySeries.length < 12; end -= 7) {
    weeklySeries.unshift(daily.slice(end - 7, end).reduce((s, d) => s + d.downloads, 0));
  }

  return {
    name,
    url: `https://www.npmjs.com/package/${name}`,
    version: latest.version,
    license: latest.license ?? null,
    weekly: week?.downloads ?? 0,
    monthly: month?.downloads ?? 0,
    weeklySeries,
    versions: abbrev ? Object.keys(abbrev.versions).length : 0,
    unpackedSize: latest.dist?.unpackedSize ?? null,
    dependencies: Object.keys(latest.dependencies ?? {}).length,
  };
}

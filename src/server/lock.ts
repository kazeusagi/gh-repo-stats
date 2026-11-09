// リポジトリごとの分析ロック（D1）。書き込みは常にプライマリで処理されるので、
// 複数の拠点から同時に来ても 1 つだけが取得できる
import { and, db, eq, lt, or, sql } from 'void/db';
import { analyses } from '../db/schema';

// 分析が終わらないまま放置されたロックを無効とみなす時間
const STALE_MS = 5 * 60_000;
// 分析完了から、KV の結果が全拠点に行き渡るのを待つ時間
const PROPAGATION_MS = 90_000;

/** ロックを取れたら true。ほかで分析中（または完了直後）なら false */
export async function acquireLock(id: string, now = Date.now()) {
  const rows = await db
    .insert(analyses)
    .values({ id, status: 'running', startedAt: now })
    .onConflictDoUpdate({
      target: analyses.id,
      set: { status: 'running', startedAt: now, finishedAt: null },
      setWhere: or(
        and(eq(analyses.status, 'running'), lt(analyses.startedAt, now - STALE_MS)),
        and(eq(analyses.status, 'done'), lt(analyses.finishedAt, now - PROPAGATION_MS)),
      ),
    })
    .returning({ id: analyses.id });
  return rows.length > 0;
}

export async function finishLock(id: string) {
  await db.update(analyses).set({ status: 'done', finishedAt: sql`${Date.now()}` }).where(eq(analyses.id, id));
}

/** 失敗したときはすぐに次の人が分析できるよう消す */
export async function releaseLock(id: string) {
  await db.delete(analyses).where(eq(analyses.id, id));
}

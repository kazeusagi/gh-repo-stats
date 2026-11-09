// 分析済みリポジトリの一覧とビュー数（D1）
import { env } from 'void/env';
import { db, desc, eq, gte, lt, sql } from 'void/db';
import { repos } from '../db/schema';
import type { RepoStats } from '../lib/types';

export type RepoSummary = typeof repos.$inferSelect;

const retentionCutoff = () => new Date(Date.now() - env.CACHE_TTL * 1000).toISOString();

/** 分析結果を一覧に登録し、ビュー数を 1 増やす */
export async function saveRepo(stats: RepoStats) {
  const values = {
    fullName: stats.repo.fullName,
    description: stats.repo.description,
    ownerAvatarUrl: stats.repo.ownerAvatarUrl,
    language: stats.repo.primaryLanguage?.name ?? null,
    languageColor: stats.repo.primaryLanguage?.color ?? null,
    stars: stats.repo.stars,
    aiShare: stats.totals.lines ? stats.ai.lines / stats.totals.lines : 0,
    analyzedAt: stats.meta.analyzedAt,
  };
  await db.batch([
    db
      .insert(repos)
      .values({ id: stats.repo.fullName.toLowerCase(), ...values, views: 1 })
      .onConflictDoUpdate({ target: repos.id, set: { ...values, views: sql`${repos.views} + 1` } }),
    // 保持期間を過ぎたものは消す（KV 側は TTL で消える）
    db.delete(repos).where(lt(repos.analyzedAt, retentionCutoff())),
  ]);
}

export async function recordView(fullName: string) {
  await db
    .update(repos)
    .set({ views: sql`${repos.views} + 1` })
    .where(eq(repos.id, fullName.toLowerCase()));
}

/** ビュー数の多い順 */
export async function listRepos(limit = 30) {
  return db
    .select()
    .from(repos)
    .where(gte(repos.analyzedAt, retentionCutoff()))
    .orderBy(desc(repos.views), desc(repos.analyzedAt))
    .limit(limit);
}

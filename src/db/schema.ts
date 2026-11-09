import { integer, real, sqliteTable, text } from 'void/schema-d1';

// 分析済みリポジトリの一覧（トップ画面用）。分析結果の本体は KV に置く
export const repos = sqliteTable('repos', {
  // 小文字の "owner/name"
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  description: text('description'),
  ownerAvatarUrl: text('owner_avatar_url').notNull(),
  language: text('language'),
  languageColor: text('language_color'),
  stars: integer('stars').notNull(),
  aiShare: real('ai_share').notNull(),
  analyzedAt: text('analyzed_at').notNull(),
  views: integer('views').notNull().default(0),
});

// 同じリポジトリの分析が同時に走らないようにするためのロック
export const analyses = sqliteTable('analyses', {
  id: text('id').primaryKey(),
  status: text('status', { enum: ['running', 'done'] }).notNull(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
});

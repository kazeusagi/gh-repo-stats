CREATE TABLE `repos` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`description` text,
	`owner_avatar_url` text NOT NULL,
	`language` text,
	`language_color` text,
	`stars` integer NOT NULL,
	`ai_share` real NOT NULL,
	`analyzed_at` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL
);

CREATE TABLE `tasting` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tasting_date` text NOT NULL,
	`bottles_per_participant` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "tasting_name_length" CHECK(length("tasting"."name") BETWEEN 1 AND 60),
	CONSTRAINT "tasting_bottles_per_participant_range" CHECK("tasting"."bottles_per_participant" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE `tasting_bottle` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`slot` integer NOT NULL,
	`alias` text NOT NULL,
	`name` text NOT NULL,
	`smoke` integer NOT NULL,
	`cask` integer NOT NULL,
	`abv` real NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `tasting_participant`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasting_bottle_slot_min" CHECK("tasting_bottle"."slot" >= 1),
	CONSTRAINT "tasting_bottle_alias_length" CHECK(length("tasting_bottle"."alias") BETWEEN 1 AND 30),
	CONSTRAINT "tasting_bottle_name_length" CHECK(length("tasting_bottle"."name") BETWEEN 1 AND 80),
	CONSTRAINT "tasting_bottle_smoke_range" CHECK("tasting_bottle"."smoke" BETWEEN 0 AND 5),
	CONSTRAINT "tasting_bottle_cask_range" CHECK("tasting_bottle"."cask" BETWEEN 0 AND 5),
	CONSTRAINT "tasting_bottle_abv_range" CHECK("tasting_bottle"."abv" BETWEEN 35 AND 75),
	CONSTRAINT "tasting_bottle_value_range" CHECK("tasting_bottle"."value" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasting_bottle_participant_slot_unique` ON `tasting_bottle` (`participant_id`,`slot`);--> statement-breakpoint
CREATE TABLE `tasting_participant` (
	`id` text PRIMARY KEY NOT NULL,
	`tasting_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tasting_id`) REFERENCES `tasting`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasting_participant_name_length" CHECK(length("tasting_participant"."name") BETWEEN 1 AND 40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasting_participant_token_hash_unique` ON `tasting_participant` (`token_hash`);--> statement-breakpoint
CREATE TABLE `tasting_write_throttle` (
	`participant_id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_start` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `tasting_participant`(`id`) ON UPDATE no action ON DELETE cascade
);

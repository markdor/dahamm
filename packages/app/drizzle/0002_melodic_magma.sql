CREATE TABLE `shopping_item` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);

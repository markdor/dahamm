CREATE TABLE `magic_link_throttle` (
	`email` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_start` integer NOT NULL
);

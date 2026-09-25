import { sql, type SQL } from 'drizzle-orm';
import {
	sqliteTable,
	text,
	integer,
	real,
	check,
	uniqueIndex,
	type SQLiteColumn
} from 'drizzle-orm/sqlite-core';
import {
	TASTING_ABV,
	TASTING_ALIAS_LENGTH,
	TASTING_BOTTLE_NAME_LENGTH,
	TASTING_BOTTLES_PER_PARTICIPANT,
	TASTING_NAME_LENGTH,
	TASTING_PARTICIPANT_NAME_LENGTH,
	TASTING_RATING_RANGE
} from '@dahamm/shared';

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	// Whitelist + profile fields live directly on the Better Auth user table
	// (no separate whitelist table): a row here means the address may log in.
	username: text('username').notNull().unique(),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	// Optional – users without bot access are allowed.
	telegramUserId: text('telegram_user_id').unique()
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	// Cascade so deleting a user from the admin page kills all their sessions
	// (forced logout on next request).
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// Backs Better Auth's built-in rate limiter (storage: 'database').
export const rateLimit = sqliteTable('rate_limit', {
	id: text('id').primaryKey(),
	key: text('key'),
	count: integer('count'),
	lastRequest: integer('last_request')
});

// Exactly one active bot token at a time (single row). We store only the
// SHA-256 hash of the token; the plaintext is shown once in the admin UI.
export const botToken = sqliteTable('bot_token', {
	id: text('id').primaryKey(),
	tokenHash: text('token_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	lastUsedAt: integer('last_used_at', { mode: 'timestamp' })
});

// Per-email throttle for magic-link requests. Better Auth's built-in rate
// limiter only buckets per IP+path, so flooding a single mailbox from rotating
// IPs would slip through. One row per email, rolling fixed window.
export const magicLinkThrottle = sqliteTable('magic_link_throttle', {
	email: text('email').primaryKey(),
	count: integer('count').notNull(),
	windowStart: integer('window_start', { mode: 'timestamp' }).notNull()
});

// Shared family shopping list – not per-user. Mirrors the `ShoppingItem` domain
// type in @dahamm/shared (id, name, done, createdAt); the API and bot derive
// from the same shape.
export const shoppingItem = sqliteTable('shopping_item', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	done: integer('done', { mode: 'boolean' }).notNull().default(false),
	// Millisecond precision so „newest first" stays deterministic even when
	// several items are added within the same second (e.g. a bot batch from one
	// message). SQL column stays `integer` – this only changes Date ↔ int scaling.
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	// Null while open. Set when checked off, cleared on reopen – the sort key
	// for the "erledigt" list (completion order, not creation order).
	completedAt: integer('completed_at', { mode: 'timestamp_ms' })
});

// CHECK bounds come from the shared TASTING_* constants (the same source as the
// form attributes and the server validation). They must be inlined via
// sql.raw: drizzle-kit writes only the SQL text of a check into the migration,
// so an interpolated JS value would end up as a bare `?` placeholder.
type Range = { readonly min: number; readonly max: number };

function inRange({ min, max }: Range): SQL {
	return sql`BETWEEN ${sql.raw(String(min))} AND ${sql.raw(String(max))}`;
}

function between(column: SQLiteColumn, range: Range): SQL {
	return sql`${column} ${inRange(range)}`;
}

function lengthBetween(column: SQLiteColumn, range: Range): SQL {
	return sql`length(${column}) ${inRange(range)}`;
}

// Whisky blind tasting (`/glenidunno`). There is no status column: the phases
// (entry → order → revealed) derive solely from `tasting_date`.
export const tasting = sqliteTable(
	'tasting',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		// Calendar date `YYYY-MM-DD` instead of the usual timestamp: the phases
		// hang on the Berlin wall clock of that day, not on an instant.
		tastingDate: text('tasting_date').notNull(),
		bottlesPerParticipant: integer('bottles_per_participant').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [
		check('tasting_name_length', lengthBetween(t.name, TASTING_NAME_LENGTH)),
		check(
			'tasting_bottles_per_participant_range',
			between(t.bottlesPerParticipant, TASTING_BOTTLES_PER_PARTICIPANT)
		)
	]
);

// One row per participant link. Only the SHA-256 hash of the token is stored;
// regenerating a link replaces the hash, the participant's bottles stay.
export const tastingParticipant = sqliteTable(
	'tasting_participant',
	{
		id: text('id').primaryKey(),
		tastingId: text('tasting_id')
			.notNull()
			.references(() => tasting.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		tokenHash: text('token_hash').notNull().unique(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [
		check('tasting_participant_name_length', lengthBetween(t.name, TASTING_PARTICIPANT_NAME_LENGTH))
	]
);

// A bottle belongs to a participant (slot 1..bottles_per_participant); the
// tasting is reached via a join. Alias uniqueness per tasting (case-insensitive)
// is enforced by the save action inside its transaction – without a tasting_id
// here (and with SQLite's ASCII-only lower()) the DB can't express it.
export const tastingBottle = sqliteTable(
	'tasting_bottle',
	{
		id: text('id').primaryKey(),
		participantId: text('participant_id')
			.notNull()
			.references(() => tastingParticipant.id, { onDelete: 'cascade' }),
		slot: integer('slot').notNull(),
		alias: text('alias').notNull(),
		name: text('name').notNull(),
		smoke: integer('smoke').notNull(),
		cask: integer('cask').notNull(),
		abv: real('abv').notNull(),
		value: integer('value').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [
		uniqueIndex('tasting_bottle_participant_slot_unique').on(t.participantId, t.slot),
		check('tasting_bottle_slot_min', sql`${t.slot} >= 1`),
		check('tasting_bottle_alias_length', lengthBetween(t.alias, TASTING_ALIAS_LENGTH)),
		check('tasting_bottle_name_length', lengthBetween(t.name, TASTING_BOTTLE_NAME_LENGTH)),
		check('tasting_bottle_smoke_range', between(t.smoke, TASTING_RATING_RANGE)),
		check('tasting_bottle_cask_range', between(t.cask, TASTING_RATING_RANGE)),
		check('tasting_bottle_abv_range', between(t.abv, TASTING_ABV)),
		check('tasting_bottle_value_range', between(t.value, TASTING_RATING_RANGE))
	]
);

// Per-participant write limit on the public save action (see
// tastingWriteThrottle.ts). Same fixed-window shape as magic_link_throttle.
export const tastingWriteThrottle = sqliteTable('tasting_write_throttle', {
	participantId: text('participant_id')
		.primaryKey()
		.references(() => tastingParticipant.id, { onDelete: 'cascade' }),
	count: integer('count').notNull(),
	windowStart: integer('window_start', { mode: 'timestamp' }).notNull()
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type BotToken = typeof botToken.$inferSelect;
export type ShoppingItemRow = typeof shoppingItem.$inferSelect;
export type TastingRow = typeof tasting.$inferSelect;
export type TastingParticipantRow = typeof tastingParticipant.$inferSelect;
export type TastingBottleRow = typeof tastingBottle.$inferSelect;

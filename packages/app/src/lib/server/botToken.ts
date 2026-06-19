import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { botToken } from './db/schema';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

type Schema = { botToken: typeof botToken };
type Db = BetterSQLite3Database<Schema>;

function sha256(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

export type BotTokenStatus = {
	exists: boolean;
	createdAt: Date | null;
	lastUsedAt: Date | null;
};

/**
 * Generates a fresh 256-bit bot token, replacing any existing one (there is
 * only ever a single active token). Returns the plaintext token, which the
 * caller must show exactly once – only the SHA-256 hash is persisted.
 */
export function generateBotToken(db: Db): string {
	const token = randomBytes(32).toString('hex');
	const hash = sha256(token).toString('hex');

	// One row only: replace whatever was there.
	db.delete(botToken).run();
	db.insert(botToken)
		.values({ id: randomUUID(), tokenHash: hash, createdAt: new Date(), lastUsedAt: null })
		.run();

	return token;
}

/** Deletes the active token. The bot can no longer authenticate afterwards. */
export function revokeBotToken(db: Db): void {
	db.delete(botToken).run();
}

export function getBotTokenStatus(db: Db): BotTokenStatus {
	const row = db.select().from(botToken).get();
	if (!row) return { exists: false, createdAt: null, lastUsedAt: null };
	return { exists: true, createdAt: row.createdAt, lastUsedAt: row.lastUsedAt };
}

/**
 * Constant-time check of a presented bearer token against the stored hash.
 * On success, bumps lastUsedAt so the admin UI can show the bot is alive.
 * 256-bit tokens make SHA-256 (no bcrypt) sufficient.
 */
export function verifyBotToken(db: Db, presented: string | undefined | null): boolean {
	if (!presented) return false;
	const row = db.select().from(botToken).get();
	if (!row) return false;

	const presentedHash = sha256(presented);
	const storedHash = Buffer.from(row.tokenHash, 'hex');

	// Both are 32-byte SHA-256 digests, so the lengths always match; the guard
	// keeps timingSafeEqual from throwing if the stored value is ever malformed.
	if (presentedHash.length !== storedHash.length) return false;
	if (!timingSafeEqual(presentedHash, storedHash)) return false;

	db.update(botToken).set({ lastUsedAt: new Date() }).run();
	return true;
}

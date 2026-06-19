import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from './db/schema';
import { generateBotToken, getBotTokenStatus, revokeBotToken, verifyBotToken } from './botToken';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
});

describe('generateBotToken', () => {
	it('returns a 256-bit hex token (64 chars)', () => {
		const token = generateBotToken(db);
		expect(token).toMatch(/^[0-9a-f]{64}$/);
	});

	it('persists only a single row and never the plaintext', () => {
		const token = generateBotToken(db);
		const rows = db.select().from(schema.botToken).all();
		expect(rows.length).toBe(1);
		expect(rows[0].tokenHash).not.toBe(token);
		expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha-256 hex
	});

	it('replaces the previous token (rotation invalidates the old one)', () => {
		const first = generateBotToken(db);
		const second = generateBotToken(db);
		expect(second).not.toBe(first);
		expect(db.select().from(schema.botToken).all().length).toBe(1);
		expect(verifyBotToken(db, first)).toBe(false);
		expect(verifyBotToken(db, second)).toBe(true);
	});
});

describe('verifyBotToken', () => {
	it('accepts the correct token', () => {
		const token = generateBotToken(db);
		expect(verifyBotToken(db, token)).toBe(true);
	});

	it('rejects a wrong token', () => {
		generateBotToken(db);
		expect(verifyBotToken(db, 'f'.repeat(64))).toBe(false);
	});

	it('rejects empty / missing tokens', () => {
		generateBotToken(db);
		expect(verifyBotToken(db, '')).toBe(false);
		expect(verifyBotToken(db, undefined)).toBe(false);
		expect(verifyBotToken(db, null)).toBe(false);
	});

	it('rejects everything when no token is set', () => {
		expect(verifyBotToken(db, 'a'.repeat(64))).toBe(false);
	});

	it('bumps lastUsedAt on a successful verify', () => {
		const token = generateBotToken(db);
		expect(getBotTokenStatus(db).lastUsedAt).toBeNull();
		expect(verifyBotToken(db, token)).toBe(true);
		expect(getBotTokenStatus(db).lastUsedAt).toBeInstanceOf(Date);
	});
});

describe('getBotTokenStatus', () => {
	it('reports no token before generation', () => {
		expect(getBotTokenStatus(db)).toEqual({ exists: false, createdAt: null, lastUsedAt: null });
	});

	it('reports an active token after generation', () => {
		generateBotToken(db);
		const status = getBotTokenStatus(db);
		expect(status.exists).toBe(true);
		expect(status.createdAt).toBeInstanceOf(Date);
		expect(status.lastUsedAt).toBeNull();
	});
});

describe('revokeBotToken', () => {
	it('deletes the token so the bot can no longer authenticate', () => {
		const token = generateBotToken(db);
		revokeBotToken(db);
		expect(getBotTokenStatus(db).exists).toBe(false);
		expect(verifyBotToken(db, token)).toBe(false);
	});

	it('is a no-op when there is no token', () => {
		expect(() => revokeBotToken(db)).not.toThrow();
		expect(getBotTokenStatus(db).exists).toBe(false);
	});
});

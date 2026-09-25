import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';

import * as schema from './db/schema';
import type { ThrottleOptions } from './magicLinkThrottle';
import { consumeTastingWriteLimit } from './tastingWriteThrottle';

let db: BetterSQLite3Database<typeof schema>;

const OPTS: ThrottleOptions = { max: 3, windowMs: 10 * 60 * 1000 };
const T0 = new Date('2026-10-03T12:00:00Z');

function insertParticipant(tastingId: string): string {
	const id = randomUUID();
	db.insert(schema.tastingParticipant)
		.values({ id, tastingId, name: 'Anna', tokenHash: randomUUID(), createdAt: T0 })
		.run();
	return id;
}

let tastingId: string;
let participantId: string;

beforeEach(() => {
	const sqlite = new Database(':memory:');
	// The throttle row references the participant – FKs must be enforced.
	sqlite.pragma('foreign_keys = ON');
	db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });

	tastingId = randomUUID();
	db.insert(schema.tasting)
		.values({
			id: tastingId,
			name: 'Herbst',
			tastingDate: '2026-10-03',
			bottlesPerParticipant: 2,
			createdAt: T0
		})
		.run();
	participantId = insertParticipant(tastingId);
});

describe('consumeTastingWriteLimit', () => {
	it('allows writes up to the limit, then blocks within the window', () => {
		expect(consumeTastingWriteLimit(db, participantId, OPTS, T0)).toBe(true);
		expect(consumeTastingWriteLimit(db, participantId, OPTS, T0)).toBe(true);
		expect(consumeTastingWriteLimit(db, participantId, OPTS, T0)).toBe(true);
		expect(consumeTastingWriteLimit(db, participantId, OPTS, T0)).toBe(false);
	});

	it('keeps a separate quota per participant (i.e. per link)', () => {
		const other = insertParticipant(tastingId);
		for (let i = 0; i < 3; i++) consumeTastingWriteLimit(db, participantId, OPTS, T0);

		expect(consumeTastingWriteLimit(db, participantId, OPTS, T0)).toBe(false);
		expect(consumeTastingWriteLimit(db, other, OPTS, T0)).toBe(true);
	});

	it('resets once the window has fully elapsed', () => {
		for (let i = 0; i < 3; i++) consumeTastingWriteLimit(db, participantId, OPTS, T0);

		const later = new Date(T0.getTime() + OPTS.windowMs + 1000);
		expect(consumeTastingWriteLimit(db, participantId, OPTS, later)).toBe(true);
		expect(db.select().from(schema.tastingWriteThrottle).all()).toHaveLength(1);
	});

	it('still counts a write exactly at the window edge to the old window', () => {
		for (let i = 0; i < 3; i++) consumeTastingWriteLimit(db, participantId, OPTS, T0);

		const edge = new Date(T0.getTime() + OPTS.windowMs);
		expect(consumeTastingWriteLimit(db, participantId, OPTS, edge)).toBe(false);
	});

	it('uses 30 writes per 10 minutes by default', () => {
		for (let i = 0; i < 30; i++) {
			expect(consumeTastingWriteLimit(db, participantId, undefined, T0)).toBe(true);
		}
		expect(consumeTastingWriteLimit(db, participantId, undefined, T0)).toBe(false);
	});

	it('disappears with its tasting (cascade)', () => {
		consumeTastingWriteLimit(db, participantId, OPTS, T0);
		db.delete(schema.tasting).where(eq(schema.tasting.id, tastingId)).run();

		expect(db.select().from(schema.tastingWriteThrottle).all()).toHaveLength(0);
	});
});

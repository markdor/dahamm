import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';

import * as schema from './schema';

// The tasting tables are the first with CHECK constraints (the second line of
// defense behind the server validation). These tests run the real migrations,
// so they also catch bounds that drizzle-kit failed to inline.

let db: BetterSQLite3Database<typeof schema>;
const NOW = new Date('2026-10-03T12:00:00Z');

beforeEach(() => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
});

function insertTasting(overrides: Partial<typeof schema.tasting.$inferInsert> = {}): string {
	const id = randomUUID();
	db.insert(schema.tasting)
		.values({
			id,
			name: 'Herbst',
			tastingDate: '2026-10-03',
			bottlesPerParticipant: 2,
			createdAt: NOW,
			...overrides
		})
		.run();
	return id;
}

function insertParticipant(
	tastingId: string,
	overrides: Partial<typeof schema.tastingParticipant.$inferInsert> = {}
): string {
	const id = randomUUID();
	db.insert(schema.tastingParticipant)
		.values({ id, tastingId, name: 'Anna', tokenHash: randomUUID(), createdAt: NOW, ...overrides })
		.run();
	return id;
}

function insertBottle(
	participantId: string,
	overrides: Partial<typeof schema.tastingBottle.$inferInsert> = {}
): void {
	db.insert(schema.tastingBottle)
		.values({
			id: randomUUID(),
			participantId,
			slot: 1,
			alias: 'Nebel',
			name: 'Talisker 10',
			smoke: 3,
			cask: 1,
			abv: 45.8,
			value: 2,
			updatedAt: NOW,
			...overrides
		})
		.run();
}

const CHECK_FAILED = /CHECK constraint failed/;

describe('tasting CHECK constraints', () => {
	it('enforce the name length and bottles per participant', () => {
		expect(() => insertTasting({ name: '' })).toThrow(CHECK_FAILED);
		expect(() => insertTasting({ name: 'x'.repeat(61) })).toThrow(CHECK_FAILED);
		expect(() => insertTasting({ bottlesPerParticipant: 0 })).toThrow(CHECK_FAILED);
		expect(() => insertTasting({ bottlesPerParticipant: 5 })).toThrow(CHECK_FAILED);
		expect(() => insertTasting({ name: 'x'.repeat(60), bottlesPerParticipant: 4 })).not.toThrow();
	});

	it('enforce the participant name length', () => {
		const tastingId = insertTasting();
		expect(() => insertParticipant(tastingId, { name: '' })).toThrow(CHECK_FAILED);
		expect(() => insertParticipant(tastingId, { name: 'x'.repeat(41) })).toThrow(CHECK_FAILED);
		expect(() => insertParticipant(tastingId, { name: 'x'.repeat(40) })).not.toThrow();
	});

	it('enforce the bottle value ranges, lengths and slot', () => {
		const participantId = insertParticipant(insertTasting());
		const invalid: Partial<typeof schema.tastingBottle.$inferInsert>[] = [
			{ slot: 0 },
			{ alias: '' },
			{ alias: 'x'.repeat(31) },
			{ name: '' },
			{ name: 'x'.repeat(81) },
			{ smoke: -1 },
			{ smoke: 6 },
			{ cask: 6 },
			{ value: 6 },
			{ abv: 34.9 },
			{ abv: 75.1 }
		];
		for (const overrides of invalid) {
			expect(() => insertBottle(participantId, overrides), JSON.stringify(overrides)).toThrow(
				CHECK_FAILED
			);
		}
	});

	it('accept the bounds themselves', () => {
		const participantId = insertParticipant(insertTasting({ bottlesPerParticipant: 4 }));
		insertBottle(participantId, { slot: 1, smoke: 0, cask: 0, value: 0, abv: 35 });
		insertBottle(participantId, {
			slot: 2,
			smoke: 5,
			cask: 5,
			value: 5,
			abv: 75,
			alias: 'x'.repeat(30),
			name: 'x'.repeat(80)
		});
		expect(db.select().from(schema.tastingBottle).all()).toHaveLength(2);
	});
});

describe('tasting unique constraints', () => {
	it('allow one bottle per participant and slot', () => {
		const participantId = insertParticipant(insertTasting());
		insertBottle(participantId, { slot: 1 });
		expect(() => insertBottle(participantId, { slot: 1 })).toThrow(/UNIQUE constraint failed/);
	});

	it('keep token hashes unique', () => {
		const tastingId = insertTasting();
		insertParticipant(tastingId, { tokenHash: 'same' });
		expect(() => insertParticipant(tastingId, { tokenHash: 'same' })).toThrow(
			/UNIQUE constraint failed/
		);
	});
});

describe('deleting a tasting', () => {
	it('cascades to participants, bottles and write-throttle rows', () => {
		const tastingId = insertTasting();
		const participantId = insertParticipant(tastingId);
		insertBottle(participantId);
		db.insert(schema.tastingWriteThrottle)
			.values({ participantId, count: 1, windowStart: NOW })
			.run();

		db.delete(schema.tasting).where(eq(schema.tasting.id, tastingId)).run();

		expect(db.select().from(schema.tastingParticipant).all()).toHaveLength(0);
		expect(db.select().from(schema.tastingBottle).all()).toHaveLength(0);
		expect(db.select().from(schema.tastingWriteThrottle).all()).toHaveLength(0);
	});
});

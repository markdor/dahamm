import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { SHOPPING_ITEM_NAME_LENGTH } from '@dahamm/shared';

import * as schema from './db/schema';
import {
	createShoppingItem,
	completeShoppingItem,
	listOpenShoppingItems,
	ShoppingItemValidationError
} from './shoppingItems';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
});

describe('createShoppingItem', () => {
	it('persists a new open item and returns it as the shared domain type', () => {
		const item = createShoppingItem(db, 'Milch');
		expect(item).toMatchObject({ name: 'Milch', done: false });
		expect(item.id).toMatch(/[0-9a-f-]{36}/);
		expect(typeof item.createdAt).toBe('string');
		expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false);

		const rows = db.select().from(schema.shoppingItem).all();
		expect(rows.length).toBe(1);
		expect(rows[0].name).toBe('Milch');
		expect(rows[0].done).toBe(false);
	});

	it('trims surrounding whitespace from the name', () => {
		const item = createShoppingItem(db, '  Vollkornbrot  ');
		expect(item.name).toBe('Vollkornbrot');
	});

	it('rejects names shorter than the shared minimum (3)', () => {
		expect(() => createShoppingItem(db, 'ab')).toThrow(ShoppingItemValidationError);
		expect(db.select().from(schema.shoppingItem).all().length).toBe(0);
	});

	it('rejects whitespace-only names', () => {
		expect(() => createShoppingItem(db, '   ')).toThrow(ShoppingItemValidationError);
	});

	it('accepts a name at exactly the maximum length', () => {
		const name = 'x'.repeat(SHOPPING_ITEM_NAME_LENGTH.max);
		expect(createShoppingItem(db, name).name).toBe(name);
	});

	it('rejects names longer than the shared maximum', () => {
		const tooLong = 'x'.repeat(SHOPPING_ITEM_NAME_LENGTH.max + 1);
		expect(() => createShoppingItem(db, tooLong)).toThrow(ShoppingItemValidationError);
	});

	it('carries a German user message on the validation error', () => {
		try {
			createShoppingItem(db, 'ab');
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(ShoppingItemValidationError);
			const { min, max } = SHOPPING_ITEM_NAME_LENGTH;
			expect((err as ShoppingItemValidationError).userMessage).toBe(
				`Der Name muss zwischen ${min} und ${max} Zeichen lang sein.`
			);
		}
	});
});

describe('listOpenShoppingItems', () => {
	it('returns only open items, oldest first', async () => {
		createShoppingItem(db, 'Erstes');
		await new Promise((r) => setTimeout(r, 5));
		createShoppingItem(db, 'Zweites');
		const second = createShoppingItem(db, 'Drittes');

		completeShoppingItem(db, second.id);

		const open = listOpenShoppingItems(db);
		expect(open.map((i) => i.name)).toEqual(['Erstes', 'Zweites']);
	});

	it('returns an empty list when nothing is open', () => {
		expect(listOpenShoppingItems(db)).toEqual([]);
	});
});

describe('completeShoppingItem', () => {
	it('marks the item as done so it drops off the open list', () => {
		const item = createShoppingItem(db, 'Kaffeebohnen');
		completeShoppingItem(db, item.id);

		const row = db
			.select()
			.from(schema.shoppingItem)
			.where(eq(schema.shoppingItem.id, item.id))
			.get();
		expect(row?.done).toBe(true);
		expect(listOpenShoppingItems(db)).toEqual([]);
	});

	it('is a silent no-op for an unknown id', () => {
		expect(() => completeShoppingItem(db, 'does-not-exist')).not.toThrow();
	});
});

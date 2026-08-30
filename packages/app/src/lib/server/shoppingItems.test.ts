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
	uncompleteShoppingItem,
	renameShoppingItem,
	listOpenShoppingItems,
	listDoneShoppingItems,
	countDoneShoppingItems,
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
	it('returns only open items, newest first', async () => {
		createShoppingItem(db, 'Erstes');
		await new Promise((r) => setTimeout(r, 5));
		createShoppingItem(db, 'Zweites');
		const second = createShoppingItem(db, 'Drittes');

		completeShoppingItem(db, second.id);

		const open = listOpenShoppingItems(db);
		expect(open.map((i) => i.name)).toEqual(['Zweites', 'Erstes']);
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

describe('uncompleteShoppingItem', () => {
	it('reopens a done item so it reappears on the open list', () => {
		const item = createShoppingItem(db, 'Kaffeebohnen');
		completeShoppingItem(db, item.id);
		uncompleteShoppingItem(db, item.id);

		const row = db
			.select()
			.from(schema.shoppingItem)
			.where(eq(schema.shoppingItem.id, item.id))
			.get();
		expect(row?.done).toBe(false);
		expect(listOpenShoppingItems(db).map((i) => i.id)).toEqual([item.id]);
	});

	it('is a silent no-op for an unknown id', () => {
		expect(() => uncompleteShoppingItem(db, 'does-not-exist')).not.toThrow();
	});
});

describe('renameShoppingItem', () => {
	it('updates the name of an existing item', () => {
		const item = createShoppingItem(db, 'Milch');
		renameShoppingItem(db, item.id, 'Hafermilch');

		const row = db
			.select()
			.from(schema.shoppingItem)
			.where(eq(schema.shoppingItem.id, item.id))
			.get();
		expect(row?.name).toBe('Hafermilch');
	});

	it('trims surrounding whitespace from the new name', () => {
		const item = createShoppingItem(db, 'Milch');
		renameShoppingItem(db, item.id, '  Hafermilch  ');

		const row = db
			.select()
			.from(schema.shoppingItem)
			.where(eq(schema.shoppingItem.id, item.id))
			.get();
		expect(row?.name).toBe('Hafermilch');
	});

	it('rejects names shorter than the shared minimum and leaves the item unchanged', () => {
		const item = createShoppingItem(db, 'Milch');
		expect(() => renameShoppingItem(db, item.id, 'ab')).toThrow(ShoppingItemValidationError);

		const row = db
			.select()
			.from(schema.shoppingItem)
			.where(eq(schema.shoppingItem.id, item.id))
			.get();
		expect(row?.name).toBe('Milch');
	});

	it('rejects names longer than the shared maximum', () => {
		const item = createShoppingItem(db, 'Milch');
		const tooLong = 'x'.repeat(SHOPPING_ITEM_NAME_LENGTH.max + 1);
		expect(() => renameShoppingItem(db, item.id, tooLong)).toThrow(ShoppingItemValidationError);
	});

	it('is a silent no-op for an unknown id', () => {
		expect(() => renameShoppingItem(db, 'does-not-exist', 'Neuer Name')).not.toThrow();
	});
});

describe('listDoneShoppingItems', () => {
	it('returns the first page of done items, newest first, without a cursor', async () => {
		const a = createShoppingItem(db, 'Erstes');
		await new Promise((r) => setTimeout(r, 5));
		const b = createShoppingItem(db, 'Zweites');
		await new Promise((r) => setTimeout(r, 5));
		const c = createShoppingItem(db, 'Drittes');
		completeShoppingItem(db, a.id);
		completeShoppingItem(db, b.id);
		completeShoppingItem(db, c.id);

		const page = listDoneShoppingItems(db, { limit: 2 });
		expect(page.map((i) => i.name)).toEqual(['Drittes', 'Zweites']);
	});

	it('returns the next page using the cursor of the last loaded item', async () => {
		const a = createShoppingItem(db, 'Erstes');
		await new Promise((r) => setTimeout(r, 5));
		const b = createShoppingItem(db, 'Zweites');
		await new Promise((r) => setTimeout(r, 5));
		const c = createShoppingItem(db, 'Drittes');
		completeShoppingItem(db, a.id);
		completeShoppingItem(db, b.id);
		completeShoppingItem(db, c.id);

		const firstPage = listDoneShoppingItems(db, { limit: 2 });
		const cursor = new Date(firstPage[firstPage.length - 1].createdAt);
		const secondPage = listDoneShoppingItems(db, { limit: 2, cursor });
		expect(secondPage.map((i) => i.name)).toEqual(['Erstes']);
	});

	it('returns an empty list once there are no further pages', async () => {
		const a = createShoppingItem(db, 'Einziges');
		completeShoppingItem(db, a.id);

		const firstPage = listDoneShoppingItems(db, { limit: 50 });
		const cursor = new Date(firstPage[firstPage.length - 1].createdAt);
		const secondPage = listDoneShoppingItems(db, { limit: 50, cursor });
		expect(secondPage).toEqual([]);
	});

	it('excludes open items', () => {
		createShoppingItem(db, 'Offen');
		expect(listDoneShoppingItems(db, { limit: 50 })).toEqual([]);
	});
});

describe('countDoneShoppingItems', () => {
	it('returns 0 when nothing is done', () => {
		createShoppingItem(db, 'Offen');
		expect(countDoneShoppingItems(db)).toBe(0);
	});

	it('counts done items regardless of how many would be loaded on a page', () => {
		const a = createShoppingItem(db, 'Erstes');
		const b = createShoppingItem(db, 'Zweites');
		completeShoppingItem(db, a.id);
		completeShoppingItem(db, b.id);

		expect(countDoneShoppingItems(db)).toBe(2);
	});
});

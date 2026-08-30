import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent, ServerLoadEvent } from '@sveltejs/kit';

vi.mock('$lib/server/db', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const schema = await import('$lib/server/db/schema');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return { db, schema };
});

vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { db } from '$lib/server/db';
import { shoppingItem } from '$lib/server/db/schema';
import { logger } from '$lib/server/logger';
import { load, actions } from './+page.server';

function makeEvent(form: Record<string, string>): RequestEvent {
	const fd = new FormData();
	for (const [k, v] of Object.entries(form)) fd.append(k, v);
	const request = new Request('http://localhost/', { method: 'POST', body: fd });
	return { request } as unknown as RequestEvent;
}

beforeEach(() => {
	db.delete(shoppingItem).run();
	vi.clearAllMocks();
});

describe('shopping load', () => {
	it('returns open items and the total done count', () => {
		db.insert(shoppingItem)
			.values([
				{ id: '1', name: 'Milch', done: false, createdAt: new Date() },
				{ id: '2', name: 'Brot', done: true, createdAt: new Date() }
			])
			.run();

		const result = load({} as ServerLoadEvent) as { openItems: unknown[]; doneCount: number };
		expect(result.openItems).toHaveLength(1);
		expect(result.doneCount).toBe(1);
	});
});

describe('addShoppingItem action', () => {
	it('creates the item and returns it', async () => {
		const result = await actions.addShoppingItem(makeEvent({ name: 'Brot' }));
		expect(result).toMatchObject({
			action: 'addShoppingItem',
			item: { name: 'Brot', done: false }
		});
		expect(db.select().from(shoppingItem).all()).toHaveLength(1);
	});

	it('rejects a too-short name with a validation error', async () => {
		const result = await actions.addShoppingItem(makeEvent({ name: 'ab' }));
		expect(result).toMatchObject({
			status: 422,
			data: { action: 'addShoppingItem', userMessage: expect.stringContaining('Zeichen lang sein') }
		});
		expect(db.select().from(shoppingItem).all()).toHaveLength(0);
	});

	it('rejects a missing name field the same way as an empty one', async () => {
		const result = await actions.addShoppingItem(makeEvent({}));
		expect(result).toMatchObject({ status: 422, data: { action: 'addShoppingItem' } });
	});

	it('logs and returns 500 on an unexpected database error', async () => {
		const err = new Error('disk full');
		const insertSpy = vi.spyOn(db, 'insert').mockImplementationOnce(() => {
			throw err;
		});

		const result = await actions.addShoppingItem(makeEvent({ name: 'Brot' }));
		expect(result).toMatchObject({
			status: 500,
			data: { action: 'addShoppingItem', userMessage: 'Da ist etwas schiefgelaufen.' }
		});
		expect(logger.error).toHaveBeenCalledWith({ err }, 'failed to create shopping item');

		insertSpy.mockRestore();
	});
});

describe('completeShoppingItem action', () => {
	it('marks the item done', async () => {
		db.insert(shoppingItem)
			.values({ id: '1', name: 'Milch', done: false, createdAt: new Date() })
			.run();

		const result = await actions.completeShoppingItem(makeEvent({ id: '1' }));
		expect(result).toEqual({ action: 'completeShoppingItem', completed: true });
		expect(db.select().from(shoppingItem).all()[0].done).toBe(true);
	});

	it('returns 400 when the id is missing', async () => {
		const result = await actions.completeShoppingItem(makeEvent({}));
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'completeShoppingItem',
				userMessage: 'Eintrag konnte nicht verarbeitet werden.'
			}
		});
	});

	it('logs and returns 500 on an unexpected database error', async () => {
		const err = new Error('disk full');
		const updateSpy = vi.spyOn(db, 'update').mockImplementationOnce(() => {
			throw err;
		});

		const result = await actions.completeShoppingItem(makeEvent({ id: '1' }));
		expect(result).toMatchObject({
			status: 500,
			data: { action: 'completeShoppingItem', userMessage: 'Da ist etwas schiefgelaufen.' }
		});
		expect(logger.error).toHaveBeenCalledWith({ err }, 'failed to complete shopping item');

		updateSpy.mockRestore();
	});
});

describe('uncompleteShoppingItem action', () => {
	it('reopens the item', async () => {
		db.insert(shoppingItem)
			.values({ id: '1', name: 'Milch', done: true, createdAt: new Date() })
			.run();

		const result = await actions.uncompleteShoppingItem(makeEvent({ id: '1' }));
		expect(result).toEqual({ action: 'uncompleteShoppingItem', uncompleted: true });
		expect(db.select().from(shoppingItem).all()[0].done).toBe(false);
	});

	it('returns 400 when the id is missing', async () => {
		const result = await actions.uncompleteShoppingItem(makeEvent({}));
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'uncompleteShoppingItem',
				userMessage: 'Eintrag konnte nicht verarbeitet werden.'
			}
		});
	});

	it('logs and returns 500 on an unexpected database error', async () => {
		const err = new Error('disk full');
		const updateSpy = vi.spyOn(db, 'update').mockImplementationOnce(() => {
			throw err;
		});

		const result = await actions.uncompleteShoppingItem(makeEvent({ id: '1' }));
		expect(result).toMatchObject({
			status: 500,
			data: { action: 'uncompleteShoppingItem', userMessage: 'Da ist etwas schiefgelaufen.' }
		});
		expect(logger.error).toHaveBeenCalledWith({ err }, 'failed to uncomplete shopping item');

		updateSpy.mockRestore();
	});
});

describe('renameShoppingItem action', () => {
	it('renames the item', async () => {
		db.insert(shoppingItem)
			.values({ id: '1', name: 'Milch', done: false, createdAt: new Date() })
			.run();

		const result = await actions.renameShoppingItem(makeEvent({ id: '1', name: 'Hafermilch' }));
		expect(result).toEqual({ action: 'renameShoppingItem', renamed: true });
		expect(db.select().from(shoppingItem).all()[0].name).toBe('Hafermilch');
	});

	it('returns 400 when the id is missing', async () => {
		const result = await actions.renameShoppingItem(makeEvent({ name: 'Hafermilch' }));
		expect(result).toMatchObject({
			status: 400,
			data: {
				action: 'renameShoppingItem',
				userMessage: 'Eintrag konnte nicht verarbeitet werden.'
			}
		});
	});

	it('rejects a missing name field the same way as an empty one', async () => {
		db.insert(shoppingItem)
			.values({ id: '1', name: 'Milch', done: false, createdAt: new Date() })
			.run();

		const result = await actions.renameShoppingItem(makeEvent({ id: '1' }));
		expect(result).toMatchObject({ status: 422, data: { action: 'renameShoppingItem' } });
	});

	it('rejects a too-short name with a validation error', async () => {
		db.insert(shoppingItem)
			.values({ id: '1', name: 'Milch', done: false, createdAt: new Date() })
			.run();

		const result = await actions.renameShoppingItem(makeEvent({ id: '1', name: 'ab' }));
		expect(result).toMatchObject({
			status: 422,
			data: {
				action: 'renameShoppingItem',
				userMessage: expect.stringContaining('Zeichen lang sein')
			}
		});
		expect(db.select().from(shoppingItem).all()[0].name).toBe('Milch');
	});

	it('logs and returns 500 on an unexpected database error', async () => {
		db.insert(shoppingItem)
			.values({ id: '1', name: 'Milch', done: false, createdAt: new Date() })
			.run();
		const err = new Error('disk full');
		const updateSpy = vi.spyOn(db, 'update').mockImplementationOnce(() => {
			throw err;
		});

		const result = await actions.renameShoppingItem(makeEvent({ id: '1', name: 'Hafermilch' }));
		expect(result).toMatchObject({
			status: 500,
			data: { action: 'renameShoppingItem', userMessage: 'Da ist etwas schiefgelaufen.' }
		});
		expect(logger.error).toHaveBeenCalledWith({ err }, 'failed to rename shopping item');

		updateSpy.mockRestore();
	});
});

describe('loadMoreDone action', () => {
	function seedDoneItems(count: number) {
		const now = Date.now();
		const rows = Array.from({ length: count }, (_, i) => ({
			id: `d${i}`,
			name: `Item ${i}`,
			done: true,
			// Strictly increasing createdAt so newest-first order is deterministic.
			createdAt: new Date(now + i * 1000)
		}));
		db.insert(shoppingItem).values(rows).run();
		return rows;
	}

	it('returns the first page without a cursor and flags further pages', async () => {
		seedDoneItems(3);

		const result = (await actions.loadMoreDone(makeEvent({}))) as {
			action: string;
			items: { id: string }[];
			hasMore: boolean;
			nextCursor?: string;
		};
		expect(result.action).toBe('loadMoreDone');
		expect(result.items).toHaveLength(3);
		expect(result.hasMore).toBe(false);
		expect(result.nextCursor).toBeDefined();
	});

	it('returns an empty page with no cursor when nothing is done', async () => {
		const result = (await actions.loadMoreDone(makeEvent({}))) as {
			items: unknown[];
			hasMore: boolean;
			nextCursor?: string;
		};
		expect(result.items).toEqual([]);
		expect(result.hasMore).toBe(false);
		expect(result.nextCursor).toBeUndefined();
	});

	it('paginates via the cursor of the last loaded item', async () => {
		seedDoneItems(51);

		const firstPage = (await actions.loadMoreDone(makeEvent({}))) as {
			items: { id: string }[];
			hasMore: boolean;
			nextCursor: string;
		};
		expect(firstPage.items).toHaveLength(50);
		expect(firstPage.hasMore).toBe(true);

		const secondPage = (await actions.loadMoreDone(
			makeEvent({ cursor: firstPage.nextCursor })
		)) as { items: { id: string }[]; hasMore: boolean };
		expect(secondPage.items).toHaveLength(1);
		expect(secondPage.hasMore).toBe(false);
	});

	it('logs and returns 500 on an unexpected database error', async () => {
		const err = new Error('disk full');
		const selectSpy = vi.spyOn(db, 'select').mockImplementationOnce(() => {
			throw err;
		});

		const result = await actions.loadMoreDone(makeEvent({}));
		expect(result).toMatchObject({
			status: 500,
			data: { action: 'loadMoreDone', userMessage: 'Da ist etwas schiefgelaufen.' }
		});
		expect(logger.error).toHaveBeenCalledWith({ err }, 'failed to load done shopping items');

		selectSpy.mockRestore();
	});
});

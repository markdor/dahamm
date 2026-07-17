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

describe('dashboard load', () => {
	it('returns the open shopping items', () => {
		db.insert(shoppingItem)
			.values({ id: '1', name: 'Milch', done: false, createdAt: new Date() })
			.run();

		const result = load({} as ServerLoadEvent) as { shoppingItems: unknown[] };
		expect(result.shoppingItems).toHaveLength(1);
	});

	it('excludes already completed items', () => {
		db.insert(shoppingItem)
			.values({ id: '1', name: 'Milch', done: true, createdAt: new Date() })
			.run();

		const result = load({} as ServerLoadEvent) as { shoppingItems: unknown[] };
		expect(result.shoppingItems).toEqual([]);
	});
});

describe('addShoppingItem action', () => {
	it('creates the item and reports success', async () => {
		const result = await actions.addShoppingItem(makeEvent({ name: 'Brot' }));
		expect(result).toEqual({ action: 'addShoppingItem', added: true });
		expect(db.select().from(shoppingItem).all()).toHaveLength(1);
	});

	it('rejects a too-short name with a validation error', async () => {
		const result = await actions.addShoppingItem(makeEvent({ name: 'ab' }));
		expect(result).toMatchObject({
			status: 422,
			data: { action: 'addShoppingItem', error: expect.stringContaining('Zeichen lang sein') }
		});
		expect(db.select().from(shoppingItem).all()).toHaveLength(0);
	});

	it('logs and returns 500 on an unexpected database error', async () => {
		const err = new Error('disk full');
		const insertSpy = vi.spyOn(db, 'insert').mockImplementationOnce(() => {
			throw err;
		});

		const result = await actions.addShoppingItem(makeEvent({ name: 'Brot' }));
		expect(result).toMatchObject({
			status: 500,
			data: { action: 'addShoppingItem', error: 'Da ist etwas schiefgelaufen.' }
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
			data: { action: 'completeShoppingItem', error: 'missing_id' }
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
			data: { action: 'completeShoppingItem', error: 'Da ist etwas schiefgelaufen.' }
		});
		expect(logger.error).toHaveBeenCalledWith({ err }, 'failed to complete shopping item');

		updateSpy.mockRestore();
	});
});

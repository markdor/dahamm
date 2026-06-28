import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { SHOPPING_ITEM_NAME_LENGTH, type ShoppingItem } from '@dahamm/shared';
import { shoppingItem, type ShoppingItemRow } from './db/schema';

type Schema = { shoppingItem: typeof shoppingItem };
type Db = BetterSQLite3Database<Schema>;

/**
 * Invalid shopping-item input. Carries a German `userMessage` for the UI/bot
 * separate from the technical `message` that goes to the logs.
 */
export class ShoppingItemValidationError extends Error {
	constructor(
		message: string,
		public readonly userMessage: string
	) {
		super(message);
		this.name = 'ShoppingItemValidationError';
	}
}

// Map a DB row to the shared domain type. createdAt crosses the JSON boundary
// (load → page, API → bot), so it is serialised as an ISO string.
function toDomain(row: ShoppingItemRow): ShoppingItem {
	return { id: row.id, name: row.name, done: row.done, createdAt: row.createdAt.toISOString() };
}

/** All still-open items, oldest first (insertion order). */
export function listOpenShoppingItems(db: Db): ShoppingItem[] {
	return db
		.select()
		.from(shoppingItem)
		.where(eq(shoppingItem.done, false))
		.orderBy(asc(shoppingItem.createdAt))
		.all()
		.map(toDomain);
}

/**
 * Creates a new open item from raw user input. Trims the name and enforces the
 * shared length bounds; throws {@link ShoppingItemValidationError} otherwise.
 */
export function createShoppingItem(db: Db, rawName: string): ShoppingItem {
	const name = rawName.trim();
	const { min, max } = SHOPPING_ITEM_NAME_LENGTH;
	if (name.length < min || name.length > max) {
		throw new ShoppingItemValidationError(
			`shopping item name length ${name.length} out of bounds [${min}, ${max}]`,
			`Der Name muss zwischen ${min} und ${max} Zeichen lang sein.`
		);
	}

	const row: ShoppingItemRow = { id: randomUUID(), name, done: false, createdAt: new Date() };
	db.insert(shoppingItem).values(row).run();
	return toDomain(row);
}

/**
 * Marks an item as done. Idempotent and silent if the id is unknown – the
 * caller (a checkbox tap) only cares that the item ends up off the open list.
 */
export function completeShoppingItem(db: Db, id: string): void {
	db.update(shoppingItem).set({ done: true }).where(eq(shoppingItem.id, id)).run();
}

import { fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { UNEXPECTED_ERROR_MESSAGE } from '$lib/server/errorMessages';
import { logger } from '$lib/server/logger';
import {
	completeShoppingItem,
	countDoneShoppingItems,
	createShoppingItem,
	listDoneShoppingItems,
	listOpenShoppingItems,
	renameShoppingItem,
	uncompleteShoppingItem,
	ShoppingItemValidationError
} from '$lib/server/shoppingItems';

const DONE_PAGE_SIZE = 50;

export const load: ServerLoad = () => {
	return { openItems: listOpenShoppingItems(db), doneCount: countDoneShoppingItems(db) };
};

const MISSING_ID_MESSAGE = 'Eintrag konnte nicht verarbeitet werden.';

export const actions: Actions = {
	addShoppingItem: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '');

		try {
			const item = createShoppingItem(db, name);
			return { action: 'addShoppingItem', item };
		} catch (err) {
			if (err instanceof ShoppingItemValidationError) {
				return fail(422, { action: 'addShoppingItem', userMessage: err.userMessage });
			}
			logger.error({ err }, 'failed to create shopping item');
			return fail(500, { action: 'addShoppingItem', userMessage: UNEXPECTED_ERROR_MESSAGE });
		}
	},

	completeShoppingItem: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { action: 'completeShoppingItem', userMessage: MISSING_ID_MESSAGE });

		try {
			completeShoppingItem(db, id);
		} catch (err) {
			logger.error({ err }, 'failed to complete shopping item');
			return fail(500, { action: 'completeShoppingItem', userMessage: UNEXPECTED_ERROR_MESSAGE });
		}

		return { action: 'completeShoppingItem', completed: true };
	},

	uncompleteShoppingItem: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id)
			return fail(400, { action: 'uncompleteShoppingItem', userMessage: MISSING_ID_MESSAGE });

		try {
			uncompleteShoppingItem(db, id);
		} catch (err) {
			logger.error({ err }, 'failed to uncomplete shopping item');
			return fail(500, {
				action: 'uncompleteShoppingItem',
				userMessage: UNEXPECTED_ERROR_MESSAGE
			});
		}

		return { action: 'uncompleteShoppingItem', uncompleted: true };
	},

	renameShoppingItem: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '');
		if (!id) return fail(400, { action: 'renameShoppingItem', userMessage: MISSING_ID_MESSAGE });

		try {
			renameShoppingItem(db, id, name);
		} catch (err) {
			if (err instanceof ShoppingItemValidationError) {
				return fail(422, { action: 'renameShoppingItem', userMessage: err.userMessage });
			}
			logger.error({ err }, 'failed to rename shopping item');
			return fail(500, { action: 'renameShoppingItem', userMessage: UNEXPECTED_ERROR_MESSAGE });
		}

		return { action: 'renameShoppingItem', renamed: true };
	},

	loadMoreDone: async ({ request }) => {
		const form = await request.formData();
		const rawCursor = form.get('cursor');
		const cursor = typeof rawCursor === 'string' && rawCursor ? new Date(rawCursor) : undefined;

		try {
			// Fetch one extra item to detect whether a further page remains,
			// without a separate count query.
			const page = listDoneShoppingItems(db, { limit: DONE_PAGE_SIZE + 1, cursor });
			const hasMore = page.length > DONE_PAGE_SIZE;
			const items = hasMore ? page.slice(0, DONE_PAGE_SIZE) : page;
			const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : undefined;

			return { action: 'loadMoreDone', items, nextCursor, hasMore };
		} catch (err) {
			logger.error({ err }, 'failed to load done shopping items');
			return fail(500, { action: 'loadMoreDone', userMessage: UNEXPECTED_ERROR_MESSAGE });
		}
	}
};

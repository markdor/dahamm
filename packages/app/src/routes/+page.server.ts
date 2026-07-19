import { fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import {
	completeShoppingItem,
	createShoppingItem,
	listOpenShoppingItems,
	ShoppingItemValidationError
} from '$lib/server/shoppingItems';

export const load: ServerLoad = () => {
	return { shoppingItems: listOpenShoppingItems(db) };
};

export const actions: Actions = {
	addShoppingItem: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '');

		try {
			createShoppingItem(db, name);
		} catch (err) {
			if (err instanceof ShoppingItemValidationError) {
				return fail(422, { action: 'addShoppingItem', userMessage: err.userMessage });
			}
			logger.error({ err }, 'failed to create shopping item');
			return fail(500, { action: 'addShoppingItem', userMessage: 'Da ist etwas schiefgelaufen.' });
		}

		return { action: 'addShoppingItem', added: true };
	},

	completeShoppingItem: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id)
			return fail(400, {
				action: 'completeShoppingItem',
				userMessage: 'Eintrag konnte nicht verarbeitet werden.'
			});

		try {
			completeShoppingItem(db, id);
		} catch (err) {
			logger.error({ err }, 'failed to complete shopping item');
			return fail(500, {
				action: 'completeShoppingItem',
				userMessage: 'Da ist etwas schiefgelaufen.'
			});
		}

		return { action: 'completeShoppingItem', completed: true };
	}
};

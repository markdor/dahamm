import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Page from './+page.svelte';

describe('Dashboard', () => {
	test('greets the logged-in user', async () => {
		render(Page, {
			data: { user: { id: '1', username: 'maxi', isAdmin: false }, shoppingItems: [] }
		});
		await expect.element(page.getByRole('heading', { name: /Hallo maxi/ })).toBeVisible();
	});

	test('renders the quick-add and the shopping card', async () => {
		render(Page, {
			data: {
				user: { id: '1', username: 'maxi', isAdmin: false },
				shoppingItems: [
					{ id: 's1', name: 'Milch', done: false, createdAt: '2026-06-25T07:00:00.000Z' }
				]
			}
		});
		await expect.element(page.getByPlaceholder('Schnell hinzufügen…')).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Einkaufsliste' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Milch abhaken' })).toBeVisible();
	});
});

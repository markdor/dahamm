import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import ShoppingCard from './ShoppingCard.svelte';

describe('ShoppingCard', () => {
	test('renders the module title', async () => {
		render(ShoppingCard);
		await expect.element(page.getByRole('heading', { name: 'Einkaufsliste' })).toBeVisible();
	});

	test('shows the open-count status pill', async () => {
		render(ShoppingCard);
		await expect.element(page.getByText('7 offen')).toBeVisible();
	});

	test('previews the first items with a "weitere" hint', async () => {
		render(ShoppingCard);
		await expect.element(page.getByText('Milch')).toBeVisible();
		await expect.element(page.getByText('Vollkornbrot')).toBeVisible();
		await expect.element(page.getByText('Kaffeebohnen')).toBeVisible();
		await expect.element(page.getByText('+ 4 weitere')).toBeVisible();
	});
});

import { test, expect, type Page } from '@playwright/test';

// Unique names per run, in case the test DB isn't reset between two local
// repeated runs.
const suffix = Date.now();
const ITEM_DONE = `Milch ${suffix}`;
const ITEM_OPEN = `Brot ${suffix}`;

async function addViaQuickAdd(page: Page, name: string) {
	await page.getByLabel('Schnell hinzufügen').fill(name);
	await page.getByRole('button', { name: 'Hinzufügen' }).click();
}

test.describe('Einkaufsliste – QuickAdd', () => {
	test('zwei Posten anlegen, einen abhaken – verschwindet nach der Gnadenfrist', async ({
		page
	}) => {
		await page.goto('/');

		await addViaQuickAdd(page, ITEM_DONE);
		await expect(page.getByRole('button', { name: `${ITEM_DONE} abhaken` })).toBeVisible();

		await addViaQuickAdd(page, ITEM_OPEN);
		await expect(page.getByRole('button', { name: `${ITEM_OPEN} abhaken` })).toBeVisible();

		await page.getByRole('button', { name: `${ITEM_DONE} abhaken` }).click();

		// Struck through immediately, but not gone yet due to the grace period (2s).
		await expect(
			page.getByRole('button', { name: `${ITEM_DONE} doch nicht abhaken` })
		).toBeVisible();
		await expect(page.getByText(ITEM_DONE, { exact: true })).toHaveClass(/line-through/);

		// Once the grace period expires, the checked-off item disappears entirely.
		await expect(page.getByRole('button', { name: `${ITEM_DONE} doch nicht abhaken` })).toBeHidden({
			timeout: 3000
		});

		// The unchecked item remains visible unchanged.
		await expect(page.getByRole('button', { name: `${ITEM_OPEN} abhaken` })).toBeVisible();
	});
});

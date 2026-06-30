import { test, expect, type Page } from '@playwright/test';

// Eindeutige Namen pro Lauf, falls die Test-DB nicht zwischen zwei lokalen
// Wiederholungen neu aufgesetzt wird.
const suffix = Date.now();
const ITEM_DONE = `Milch ${suffix}`;
const ITEM_OPEN = `Brot ${suffix}`;

async function addViaQuickAdd(page: Page, name: string) {
	await page.getByLabel('Schnell hinzufügen').fill(name);
	await page.getByRole('button', { name: 'Ziel wählen' }).click();
	await page.getByRole('menuitem', { name: 'Einkaufsliste' }).click();
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

		// Sofort durchgestrichen, aber wegen der Gnadenfrist (2s) noch nicht weg.
		await expect(
			page.getByRole('button', { name: `${ITEM_DONE} doch nicht abhaken` })
		).toBeVisible();
		await expect(page.getByText(ITEM_DONE, { exact: true })).toHaveClass(/line-through/);

		// Nach Ablauf der Gnadenfrist verschwindet der abgehakte Posten ganz.
		await expect(page.getByRole('button', { name: `${ITEM_DONE} doch nicht abhaken` })).toBeHidden({
			timeout: 3000
		});

		// Der nicht abgehakte Posten bleibt unverändert sichtbar.
		await expect(page.getByRole('button', { name: `${ITEM_OPEN} abhaken` })).toBeVisible();
	});
});

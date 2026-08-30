import { test, expect } from '@playwright/test';

// Unique name per run, in case the test DB isn't reset between two local
// repeated runs.
const suffix = Date.now();
const ITEM = `Nudeln ${suffix}`;

test.describe('Einkaufsliste – Detailseite', () => {
	test('Navigation von der Card, hinzufügen, abhaken, erledigte umschalten', async ({ page }) => {
		await page.goto('/');

		// Click the card's heading rather than the card itself: the card is one
		// large clickable area with many independently-clickable checkboxes
		// inside it, and Playwright's default click lands on the element's
		// center - which, with enough open items, can coincide with one of
		// those checkboxes instead of the card background.
		await page.getByRole('heading', { name: 'Einkaufsliste' }).click();
		await expect(page).toHaveURL(/\/shopping$/);
		await expect(page.getByRole('heading', { name: 'Einkaufsliste' })).toBeVisible();

		await page.getByLabel('Posten hinzufügen').fill(ITEM);
		await page.getByRole('button', { name: 'Hinzufügen' }).click();
		await expect(page.getByRole('button', { name: `${ITEM} abhaken` })).toBeVisible();

		await page.getByRole('button', { name: `${ITEM} abhaken` }).click();
		// Struck through immediately, but not gone yet due to the grace period (2s).
		await expect(page.getByRole('button', { name: `${ITEM} doch nicht abhaken` })).toBeVisible();

		// Once the grace period expires, the item leaves the open list.
		await expect(page.getByRole('button', { name: `${ITEM} doch nicht abhaken` })).toBeHidden({
			timeout: 3000
		});

		// Reveal the done list and find it there instead.
		await page.getByLabel('Erledigte anzeigen').click();
		await expect(page.getByRole('button', { name: `${ITEM} wieder öffnen` })).toBeVisible();
	});
});

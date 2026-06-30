import { test, expect } from '@playwright/test';
import { E2E_ADMIN_EMAIL, countMagicLinkLines, waitForNewMagicLink } from './magic-link';

// The e2e project's default storageState is the logged-in admin (see
// playwright.config.ts) — this test verifies the login flow itself, so it
// must start from a clean, unauthenticated session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Magic-Link-Login', () => {
	test('Admin meldet sich per Magic Link an und sieht die Begrüßungsseite', async ({
		page,
		baseURL
	}) => {
		expect(baseURL).toBeTruthy();

		// Closed app: ein nicht eingeloggter Aufruf von / landet auf /login.
		await page.goto('/');
		await expect(page).toHaveURL(/\/login$/);

		// Mailadresse eingeben und Link anfordern.
		await page.getByLabel('E-Mail').fill(E2E_ADMIN_EMAIL);
		const linesBefore = countMagicLinkLines();
		await page.getByRole('button', { name: 'Link anfordern' }).click();

		// Immer dieselbe (neutrale) Bestätigung – egal ob Whitelist-Hit oder -Miss.
		await expect(page.getByRole('status')).toContainText(/wurde ein Link verschickt/i);

		// Link aufrufen -> Session-Cookie gesetzt, Redirect aufs Dashboard.
		const magicLink = await waitForNewMagicLink(linesBefore);
		await page.goto(magicLink);
		await expect(page).toHaveURL(new URL('/', baseURL!).toString());

		// Begrüßungsseite prüft Username im Header und in der Überschrift.
		await expect(page.getByRole('heading', { name: /Hallo admin/i })).toBeVisible();
		await expect(page.getByRole('button', { name: 'admin' })).toBeVisible();
	});
});

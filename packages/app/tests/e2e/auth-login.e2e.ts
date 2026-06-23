import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

// Must match playwright.config.ts (ADMIN_EMAIL + MAGIC_LINK_DEBUG_PATH).
const ADMIN_EMAIL = 'admin@e2e.test';
const MAGIC_LINK_FILE = './e2e-magic-link.log';

// Tokens are stored hashed, so the plaintext is no longer recoverable from the
// DB. Instead the production build appends the full magic-link URL to a capture
// file when MAGIC_LINK_DEBUG_PATH is set (only the local Playwright config sets
// it). Against a deployed container (E2E_TARGET=docker) that file lives on the
// container and is unreachable, so we skip the flow there instead of failing.
const isContainerRun = process.env.E2E_TARGET === 'docker';

/**
 * The server appends one magic-link URL per request to the capture file. The
 * test only ever requests one link, so the last non-empty line is ours.
 */
function readLatestMagicLink(): string | null {
	if (!existsSync(MAGIC_LINK_FILE)) return null;
	const lines = readFileSync(MAGIC_LINK_FILE, 'utf8')
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);
	return lines.at(-1) ?? null;
}

test.describe('Magic-Link-Login', () => {
	test.skip(
		isContainerRun,
		'kein Host-Zugriff auf die Magic-Link-Capture-Datei — Lauf gegen Container'
	);

	test('Admin meldet sich per Magic Link an und sieht die Begrüßungsseite', async ({
		page,
		baseURL
	}) => {
		expect(baseURL).toBeTruthy();

		// Closed app: ein nicht eingeloggter Aufruf von / landet auf /login.
		await page.goto('/');
		await expect(page).toHaveURL(/\/login$/);

		// Mailadresse eingeben und Link anfordern.
		await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
		await page.getByRole('button', { name: 'Link anfordern' }).click();

		// Immer dieselbe (neutrale) Bestätigung – egal ob Whitelist-Hit oder -Miss.
		await expect(page.getByRole('status')).toContainText(/wurde ein Link verschickt/i);

		// Die Magic-Link-URL wird beim Request in die Capture-Datei geschrieben; kurz pollen.
		let magicLink: string | null = null;
		for (let i = 0; i < 30 && !magicLink; i++) {
			magicLink = readLatestMagicLink();
			if (!magicLink) await new Promise((r) => setTimeout(r, 100));
		}
		expect(magicLink, 'Magic-Link-URL sollte in der Capture-Datei landen').toBeTruthy();

		// Link aufrufen -> Session-Cookie gesetzt, Redirect aufs Dashboard.
		await page.goto(magicLink!);
		await expect(page).toHaveURL(new URL('/', baseURL!).toString());

		// Begrüßungsseite prüft Username im Header und in der Überschrift.
		await expect(page.getByRole('heading', { name: /Hallo admin/i })).toBeVisible();
		await expect(page.getByRole('button', { name: 'admin' })).toBeVisible();
	});
});

import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';

// Must match playwright.config.ts (ADMIN_EMAIL + DB_PATH).
const ADMIN_EMAIL = 'admin@e2e.test';
const DB_PATH = './e2e.db';

// The local Playwright config seeds ./e2e.db on the host so the test can read
// the magic-link token straight out of the verification table. Against a
// deployed container (E2E_TARGET=docker) the DB lives on a named volume and is
// unreachable, so we skip the flow there instead of failing. We also skip if no
// local DB exists at all (e.g. a run against a remote server).
const isContainerRun = process.env.E2E_TARGET === 'docker';
const hasLocalDb = !isContainerRun && existsSync(DB_PATH);

/**
 * Rebuild the verify URL the same way Better Auth's magic-link plugin does.
 * Our auth is mounted at basePath `/auth`, so the verify endpoint is
 * `/auth/magic-link/verify`. With `storeToken: "plain"` (the default) the
 * verification row stores the raw token in `identifier`.
 */
function buildVerifyUrl(token: string, baseURL: string): string {
	const url = new URL('/auth/magic-link/verify', baseURL);
	url.searchParams.set('token', token);
	url.searchParams.set('callbackURL', '/');
	url.searchParams.set('errorCallbackURL', '/login?error=invalid');
	return url.toString();
}

/**
 * In the verification table `identifier` is the plain token and `value` is JSON
 * holding the email ({ email, name }). Grab the newest row for this address.
 */
function readLatestTokenFor(email: string): string | null {
	const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
	try {
		const row = db
			.prepare(
				`SELECT identifier, value FROM verification
				 WHERE value LIKE ?
				 ORDER BY created_at DESC, expires_at DESC
				 LIMIT 1`
			)
			.get(`%${email}%`) as { identifier: string; value: string } | undefined;
		if (!row) return null;
		try {
			const parsed = JSON.parse(row.value);
			if (parsed?.email !== email) return null;
		} catch {
			return null;
		}
		return row.identifier;
	} finally {
		db.close();
	}
}

test.describe('Magic-Link-Login', () => {
	test.skip(
		!hasLocalDb,
		'kein Host-Zugriff auf die Magic-Link-DB — Lauf gegen Remote-Server oder Container'
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

		// Der Token wird vor dem Mailversand synchron in die DB geschrieben; kurz pollen.
		let token: string | null = null;
		for (let i = 0; i < 30 && !token; i++) {
			token = readLatestTokenFor(ADMIN_EMAIL);
			if (!token) await new Promise((r) => setTimeout(r, 100));
		}
		expect(token, 'Magic-Link-Token sollte in der verification-Tabelle landen').toBeTruthy();

		// Link aufrufen -> Session-Cookie gesetzt, Redirect aufs Dashboard.
		await page.goto(buildVerifyUrl(token!, baseURL!));
		await expect(page).toHaveURL(new URL('/', baseURL!).toString());

		// Begrüßungsseite prüft Username im Header und in der Überschrift.
		await expect(page.getByRole('heading', { name: /Hallo admin/i })).toBeVisible();
		await expect(page.getByRole('button', { name: 'admin' })).toBeVisible();
	});
});

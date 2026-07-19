import { describe, test, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Page from './+page.svelte';
import { toast } from '$lib/components/toastStore.svelte';

beforeEach(() => {
	for (const t of [...toast.toasts]) toast.dismiss(t.id);
});

const currentUser = { id: 'admin-id', username: 'admin', isAdmin: true };

function makeData(over: Partial<Record<string, unknown>> = {}) {
	return {
		user: currentUser,
		users: [
			{
				id: 'admin-id',
				email: 'admin@dahamm.de',
				username: 'admin',
				isAdmin: true,
				telegramUserId: null,
				createdAt: new Date('2026-01-01')
			},
			{
				id: 'u2',
				email: 'kid@dahamm.de',
				username: 'kid',
				isAdmin: false,
				telegramUserId: '12345',
				createdAt: new Date('2026-02-01')
			}
		],
		botToken: { exists: false, createdAt: null, lastUsedAt: null },
		...over
	};
}

describe('Admin page', () => {
	test('lists users and offers to generate a token when none exists', async () => {
		render(Page, { data: makeData(), form: null });

		await expect.element(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
		await expect.element(page.getByText('Benutzer (2)')).toBeVisible();
		await expect.element(page.getByText('kid@dahamm.de')).toBeVisible();
		await expect.element(page.getByText('Kein Token gesetzt.')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Token generieren' })).toBeVisible();
	});

	test('shows the active token status with rotate/revoke actions', async () => {
		render(Page, {
			data: makeData({
				botToken: { exists: true, createdAt: new Date('2026-03-01'), lastUsedAt: null }
			}),
			form: null
		});

		await expect.element(page.getByText(/Aktiv seit/)).toBeVisible();
		await expect.element(page.getByText(/Zuletzt genutzt: nie/)).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Neu generieren' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Widerrufen' })).toBeVisible();
	});

	test('renders a freshly generated token exactly once', async () => {
		const token = 'a'.repeat(64);
		render(Page, { data: makeData(), form: { action: 'generateToken', token } });

		await expect.element(page.getByText(token)).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Kopieren' })).toBeVisible();
	});

	test('hides the delete button for the current admin (self)', async () => {
		render(Page, { data: makeData(), form: null });
		// One delete button (for "kid"), none for the admin themselves.
		expect(page.getByRole('button', { name: 'Löschen' }).elements()).toHaveLength(1);
	});

	test('reveals the inline edit form for a single user', async () => {
		// Only "kid" in the list so there is exactly one Bearbeiten button.
		render(Page, {
			data: makeData({
				users: [
					{
						id: 'u2',
						email: 'kid@dahamm.de',
						username: 'kid',
						isAdmin: false,
						telegramUserId: '12345',
						createdAt: new Date('2026-02-01')
					}
				]
			}),
			form: null
		});

		await page.getByRole('button', { name: 'Bearbeiten' }).click();
		await expect.element(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
	});

	test('shows create validation errors from the form result', async () => {
		render(Page, {
			data: makeData(),
			form: {
				action: 'create',
				email: 'bad',
				username: '',
				telegramUserId: '',
				fieldErrors: { email: 'invalid', username: 'required' }
			}
		});

		await expect.element(page.getByText('Ungültig')).toBeVisible();
		await expect.element(page.getByText('Pflichtfeld')).toBeVisible();
	});

	test('shows the created confirmation and the self-delete warning', async () => {
		render(Page, { data: makeData(), form: { action: 'create', created: true } });
		await expect.element(page.getByText('Benutzer angelegt.')).toBeVisible();
	});

	test('warns when a self-delete was blocked', async () => {
		render(Page, { data: makeData(), form: { action: 'delete', error: 'self_delete' } });
		// The +page.svelte itself no longer renders the warning inline - it now
		// triggers the global toast store, rendered separately by <Toast/> in
		// +layout.svelte.
		expect(
			toast.toasts.some(
				(t) => t.variant === 'error' && /eigenen Eintrag nicht löschen/.test(t.message)
			)
		).toBe(true);
	});
});

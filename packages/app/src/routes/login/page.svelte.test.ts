import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const { magicLink } = vi.hoisted(() => ({
	magicLink: vi.fn(async () => ({ data: {}, error: null }))
}));
vi.mock('$lib/auth-client', () => ({ authClient: { signIn: { magicLink } } }));

import Page from './+page.svelte';

beforeEach(() => magicLink.mockClear());

describe('Login page', () => {
	test('renders the email form by default', async () => {
		render(Page, { data: { user: null, error: null } });
		await expect.element(page.getByRole('heading', { name: 'Dahamm' })).toBeVisible();
		await expect.element(page.getByLabelText('E-Mail')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Link anfordern' })).toBeVisible();
	});

	test('shows the generic error box when data.error is set', async () => {
		render(Page, { data: { user: null, error: 'invalid' } });
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent(/abgelaufen oder wurde bereits/);
	});

	test('rejects an invalid email without calling the API', async () => {
		render(Page, { data: { user: null, error: null } });
		await page.getByLabelText('E-Mail').fill('not-an-email');
		await page.getByRole('button', { name: 'Link anfordern' }).click();

		await expect.element(page.getByText(/gültige E-Mail-Adresse/)).toBeVisible();
		expect(magicLink).not.toHaveBeenCalled();
	});

	test('submits a valid email and shows the generic confirmation', async () => {
		render(Page, { data: { user: null, error: null } });
		await page.getByLabelText('E-Mail').fill('User@Example.de');
		await page.getByRole('button', { name: 'Link anfordern' }).click();

		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent(/Wenn die Adresse registriert ist/);
		// Normalised to lowercase, with the magic-link callback URLs.
		expect(magicLink).toHaveBeenCalledWith(
			expect.objectContaining({ email: 'user@example.de', callbackURL: '/' })
		);
	});
});

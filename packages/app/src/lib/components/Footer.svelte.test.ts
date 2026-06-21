import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Footer from './Footer.svelte';

describe('Footer', () => {
	test('shows the app version', async () => {
		render(Footer);

		// __APP_VERSION__ is injected by Vite at build time (vite.config.ts).
		await expect.element(page.getByText(`v${__APP_VERSION__}`)).toBeVisible();
	});

	test('shows the "Made with" note', async () => {
		render(Footer);

		await expect.element(page.getByText(/Made with/)).toBeVisible();
		await expect.element(page.getByRole('img', { name: 'Liebe' })).toBeVisible();
	});
});

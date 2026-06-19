import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Page from './+page.svelte';

describe('Dashboard', () => {
	test('greets the logged-in user', async () => {
		render(Page, { data: { user: { id: '1', username: 'maxi', isAdmin: false } } });
		await expect.element(page.getByRole('heading', { name: /Hallo maxi/ })).toBeVisible();
	});
});

import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import QuickAdd from './QuickAdd.svelte';

describe('QuickAdd', () => {
	test('renders the quick-add input', async () => {
		render(QuickAdd);
		await expect.element(page.getByPlaceholder('Schnell hinzufügen…')).toBeVisible();
	});

	test('keeps the target menu hidden until the "+" is clicked', async () => {
		render(QuickAdd);
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
	});

	test('disables the "+" button until at least 3 characters are entered', async () => {
		render(QuickAdd);
		const button = page.getByRole('button', { name: 'Ziel wählen' });
		await expect.element(button).toBeDisabled();

		await page.getByPlaceholder('Schnell hinzufügen…').fill('ab');
		await expect.element(button).toBeDisabled();

		await page.getByPlaceholder('Schnell hinzufügen…').fill('abc');
		await expect.element(button).toBeEnabled();
	});

	test('keeps the "+" button disabled for whitespace-only input', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('   ');
		await expect.element(page.getByRole('button', { name: 'Ziel wählen' })).toBeDisabled();
	});

	test('caps the input length at 64 characters', async () => {
		render(QuickAdd);
		await expect
			.element(page.getByPlaceholder('Schnell hinzufügen…'))
			.toHaveAttribute('maxlength', '64');
	});

	test('opens a target dropdown offering "Einkaufsliste"', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Ziel wählen' }).click();
		await expect.element(page.getByRole('menuitem', { name: 'Einkaufsliste' })).toBeVisible();
	});

	test('closes the dropdown after picking a target', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Ziel wählen' }).click();
		await page.getByRole('menuitem', { name: 'Einkaufsliste' }).click();
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
	});
});

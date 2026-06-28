import { describe, test, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import QuickAdd from './QuickAdd.svelte';

// The target menuitem is a real submit button. Stub `enhance` so submitting runs
// the component's submit logic (which closes the dropdown) without a network
// call against a server that doesn't exist in a unit test.
vi.mock('$app/forms', () => ({
	enhance: (form: HTMLFormElement, submit: (input: { cancel: () => void }) => unknown) => {
		const handler = (event: Event) => {
			event.preventDefault();
			submit({ cancel: () => {} });
		};
		form.addEventListener('submit', handler);
		return { destroy: () => form.removeEventListener('submit', handler) };
	}
}));

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

	test('submits new items to the addShoppingItem action', async () => {
		const { container } = render(QuickAdd);
		const form = container.querySelector('form');
		expect(form?.getAttribute('action')).toBe('?/addShoppingItem');

		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Ziel wählen' }).click();
		await expect
			.element(page.getByRole('menuitem', { name: 'Einkaufsliste' }))
			.toHaveAttribute('formaction', '?/addShoppingItem');
	});

	test('closes the dropdown after picking a target', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Ziel wählen' }).click();
		await page.getByRole('menuitem', { name: 'Einkaufsliste' }).click();
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
	});
});

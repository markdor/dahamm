import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import QuickAdd from './QuickAdd.svelte';

// Stub `enhance` so submitting the form runs the component's submit logic
// without a network call against a server that doesn't exist in a unit test,
// while letting tests observe how often a real submit happened.
let submitCount = 0;

vi.mock('$app/forms', () => ({
	enhance: (form: HTMLFormElement, submit: (input: { cancel: () => void }) => unknown) => {
		const handler = (event: Event) => {
			event.preventDefault();
			submitCount++;
			submit({ cancel: () => {} });
		};
		form.addEventListener('submit', handler);
		return { destroy: () => form.removeEventListener('submit', handler) };
	}
}));

beforeEach(() => {
	submitCount = 0;
});

describe('QuickAdd', () => {
	test('renders the quick-add input', async () => {
		render(QuickAdd);
		await expect.element(page.getByPlaceholder('Schnell hinzufügen…')).toBeVisible();
	});

	test('shows the current target on the icon button and keeps the menu hidden until clicked', async () => {
		render(QuickAdd);
		await expect.element(page.getByRole('button', { name: /Einkaufsliste/ })).toBeVisible();
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
	});

	test('opens the target dropdown when the icon button is clicked', async () => {
		render(QuickAdd);
		await page.getByRole('button', { name: /Einkaufsliste/ }).click();
		await expect.element(page.getByRole('menuitem', { name: 'Einkaufsliste' })).toBeVisible();
	});

	test('picking a target closes the menu without submitting', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: /Einkaufsliste/ }).click();
		await page.getByRole('menuitem', { name: 'Einkaufsliste' }).click();

		await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
		// Picking a target must not add anything - the input keeps its value
		// and no form submit happened.
		await expect.element(page.getByPlaceholder('Schnell hinzufügen…')).toHaveValue('Milch');
		expect(submitCount).toBe(0);
	});

	test('disables the "+" button until at least 3 characters are entered', async () => {
		render(QuickAdd);
		const button = page.getByRole('button', { name: 'Hinzufügen' });
		await expect.element(button).toBeDisabled();

		await page.getByPlaceholder('Schnell hinzufügen…').fill('ab');
		await expect.element(button).toBeDisabled();

		await page.getByPlaceholder('Schnell hinzufügen…').fill('abc');
		await expect.element(button).toBeEnabled();
	});

	test('keeps the "+" button disabled for whitespace-only input', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('   ');
		await expect.element(page.getByRole('button', { name: 'Hinzufügen' })).toBeDisabled();
	});

	test('caps the input length at 64 characters', async () => {
		render(QuickAdd);
		await expect
			.element(page.getByPlaceholder('Schnell hinzufügen…'))
			.toHaveAttribute('maxlength', '64');
	});

	test('form posts to the addShoppingItem action by default', async () => {
		const { container } = render(QuickAdd);
		const form = container.querySelector('form');
		expect(form?.getAttribute('action')).toBe('?/addShoppingItem');
	});

	test('clicking "+" submits the form directly, without going through the dropdown', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		expect(submitCount).toBe(1);
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
	});
});

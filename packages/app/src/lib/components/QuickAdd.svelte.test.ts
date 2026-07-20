import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import QuickAdd from './QuickAdd.svelte';
import { toast } from './toastStore.svelte';

// Stub `enhance` so submitting the form runs the component's submit logic
// without a network call against a server that doesn't exist in a unit test,
// while letting tests observe how often a real submit happened and control
// the after-submit callback (result.type) explicitly.
type PersistResult = { type: string; data?: Record<string, unknown> };
let submitCount = 0;
let lastCallback:
	((opts: { result: PersistResult; update: () => Promise<void> }) => unknown) | null = null;

vi.mock('$app/forms', () => ({
	enhance: (
		form: HTMLFormElement,
		submit: (input: {
			cancel: () => void;
		}) => (opts: { result: PersistResult; update: () => Promise<void> }) => unknown
	) => {
		const handler = (event: Event) => {
			event.preventDefault();
			submitCount++;
			lastCallback = submit({ cancel: () => {} });
		};
		form.addEventListener('submit', handler);
		return { destroy: () => form.removeEventListener('submit', handler) };
	}
}));

beforeEach(() => {
	submitCount = 0;
	lastCallback = null;
	for (const t of [...toast.toasts]) toast.dismiss(t.id);
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

	test('closes the dropdown when clicking outside it', async () => {
		render(QuickAdd);
		await page.getByRole('button', { name: /Einkaufsliste/ }).click();
		await expect.element(page.getByRole('menu')).toBeVisible();

		// The click-away backdrop, not a menu item.
		await page.getByRole('button', { name: 'Menü schließen' }).click();
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
	});

	test('clears the input after a successful submit', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		expect(submitCount).toBe(1);
		await lastCallback?.({ result: { type: 'success' }, update: async () => {} });
		await expect.element(page.getByPlaceholder('Schnell hinzufügen…')).toHaveValue('');
	});

	test('keeps the input value when the submit fails', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		await lastCallback?.({ result: { type: 'failure' }, update: async () => {} });
		await expect.element(page.getByPlaceholder('Schnell hinzufügen…')).toHaveValue('Milch');
	});

	test('shows the server-provided error message as a toast when the submit fails', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		await lastCallback?.({
			result: {
				type: 'failure',
				data: { userMessage: 'Der Name muss zwischen 3 und 64 Zeichen lang sein.' }
			},
			update: async () => {}
		});
		expect(
			toast.toasts.some(
				(t) =>
					t.variant === 'error' &&
					t.message === 'Der Name muss zwischen 3 und 64 Zeichen lang sein.'
			)
		).toBe(true);
	});

	test('falls back to a generic toast message when the failure carries no userMessage', async () => {
		render(QuickAdd);
		await page.getByPlaceholder('Schnell hinzufügen…').fill('Milch');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		await lastCallback?.({ result: { type: 'failure' }, update: async () => {} });
		expect(
			toast.toasts.some(
				(t) =>
					t.variant === 'error' &&
					t.message === 'Eintrag konnte nicht hinzugefügt werden. Bitte versuche es erneut.'
			)
		).toBe(true);
	});
});

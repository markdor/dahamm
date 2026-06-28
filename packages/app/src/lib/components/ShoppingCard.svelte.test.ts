import { describe, test, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { ShoppingItem } from '@dahamm/shared';
import ShoppingCard from './ShoppingCard.svelte';

const invalidateAll = vi.fn();

// Stub the persist path: enhance reports the (hidden) form submit as a success,
// so we can observe the item being removed after the grace period without a
// real server. invalidateAll is a no-op here (there is no data layer in a unit
// test).
vi.mock('$app/navigation', () => ({ invalidateAll: () => invalidateAll() }));
vi.mock('$app/forms', () => ({
	enhance: (form: HTMLFormElement, submit: () => (opts: { result: unknown }) => unknown) => {
		const handler = (event: Event) => {
			event.preventDefault();
			const callback = submit();
			void Promise.resolve().then(() => callback({ result: { type: 'success' } }));
		};
		form.addEventListener('submit', handler);
		return { destroy: () => form.removeEventListener('submit', handler) };
	}
}));

function item(name: string, over: Partial<ShoppingItem> = {}): ShoppingItem {
	return { id: name, name, done: false, createdAt: '2026-06-25T07:00:00.000Z', ...over };
}

describe('ShoppingCard', () => {
	test('renders the module title', async () => {
		render(ShoppingCard, { items: [] });
		await expect.element(page.getByRole('heading', { name: 'Einkaufsliste' })).toBeVisible();
	});

	test('shows an empty state when there are no open items', async () => {
		render(ShoppingCard, { items: [] });
		await expect.element(page.getByText(/Keine offenen Posten/)).toBeVisible();
		await expect.element(page.getByText('0 offen')).toBeVisible();
	});

	test('lists the open items with a check button each', async () => {
		render(ShoppingCard, { items: [item('Milch'), item('Brot')] });
		await expect.element(page.getByText('2 offen')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Milch abhaken' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Brot abhaken' })).toBeVisible();
	});

	test('caps the preview at 4 items and counts the rest as "weitere"', async () => {
		const items = ['a-Milch', 'b-Brot', 'c-Eier', 'd-Butter', 'e-Käse', 'f-Apfel'].map((n) =>
			item(n)
		);
		render(ShoppingCard, { items });
		await expect.element(page.getByText('6 offen')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'd-Butter abhaken' })).toBeVisible();
		await expect.element(page.getByText('+ 2 weitere')).toBeVisible();
		// The 5th open item is beyond the preview cap.
		await expect
			.element(page.getByRole('button', { name: 'e-Käse abhaken' }))
			.not.toBeInTheDocument();
	});

	test('strikes the item through immediately when its box is tapped', async () => {
		render(ShoppingCard, { items: [item('Milch')], removeDelayMs: 10_000 });
		const label = page.getByText('Milch');
		await expect.element(label).not.toHaveClass(/line-through/);

		await page.getByRole('button', { name: 'Milch abhaken' }).click();
		await expect.element(label).toHaveClass(/line-through/);
		await expect.element(label).toHaveClass(/italic/);
	});

	test('undoes the completion on a second tap within the grace period', async () => {
		render(ShoppingCard, { items: [item('Milch')], removeDelayMs: 10_000 });

		await page.getByRole('button', { name: 'Milch abhaken' }).click();
		// While struck through, the button advertises the undo action.
		const undo = page.getByRole('button', { name: 'Milch doch nicht abhaken' });
		await expect.element(undo).toBeVisible();

		await undo.click();
		await expect.element(page.getByText('Milch')).not.toHaveClass(/line-through/);
		// Never persisted, so no data refresh happened.
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	test('persists and removes the item after the grace period elapses', async () => {
		invalidateAll.mockClear();
		render(ShoppingCard, { items: [item('Milch')], removeDelayMs: 30 });

		await page.getByRole('button', { name: 'Milch abhaken' }).click();
		// After the short grace period the hidden form submits and the item leaves.
		await expect.element(page.getByText('Milch')).not.toBeInTheDocument();
		expect(invalidateAll).toHaveBeenCalled();
	});
});

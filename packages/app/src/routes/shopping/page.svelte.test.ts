import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import type { ShoppingItem } from '@dahamm/shared';
import Page from './+page.svelte';
import { toast } from '$lib/components/toastStore.svelte';
import { setGraceDelayMsForTests } from './graceDelay';

// Same enhance-mocking strategy as ShoppingCard.svelte.test.ts, generalized to
// several different forms on one page: the mock doesn't care which action a
// form posts to, it just runs the submit callback with whatever `nextResult`
// the test configured beforehand (defaulting to a plain success).
type PersistResult = { type: string; data?: Record<string, unknown> };
let holdCallbacks = false;
let heldCallbacks: Array<(opts: { result: PersistResult }) => unknown> = [];
let nextResult: PersistResult = { type: 'success' };

vi.mock('$app/forms', () => ({
	enhance: (
		form: HTMLFormElement,
		submit: (opts: { formData: FormData }) => (opts: { result: PersistResult }) => unknown
	) => {
		const handler = (event: Event) => {
			event.preventDefault();
			const formData = new FormData(form);
			const callback = submit({ formData });
			if (holdCallbacks) {
				heldCallbacks.push(callback);
			} else {
				const result = nextResult;
				void Promise.resolve().then(() => callback({ result }));
			}
		};
		form.addEventListener('submit', handler);
		return { destroy: () => form.removeEventListener('submit', handler) };
	}
}));

function item(name: string, over: Partial<ShoppingItem> = {}): ShoppingItem {
	return { id: name, name, done: false, createdAt: '2026-06-25T07:00:00.000Z', ...over };
}

function doneItem(name: string, over: Partial<ShoppingItem> = {}): ShoppingItem {
	return item(name, { done: true, ...over });
}

beforeEach(() => {
	holdCallbacks = false;
	heldCallbacks = [];
	nextResult = { type: 'success' };
	setGraceDelayMsForTests(10);
	for (const t of [...toast.toasts]) toast.dismiss(t.id);
});

// The grace delay defaults small so tests that wait for a commit don't need
// long timeouts; the "undo" test overrides it to a large value so the real
// click round-trip can't outrace the timer (mirrors ShoppingCard.svelte.test.ts).
function renderPage(openItems: ShoppingItem[] = [], doneCount = 0) {
	return render(Page, {
		data: { user: { id: '1', username: 'maxi', isAdmin: false }, openItems, doneCount }
	});
}

describe('Einkaufsliste-Detailseite', () => {
	test('shows the app bar with title, back link and open-count pill', async () => {
		renderPage([item('Milch'), item('Brot')]);

		await expect.element(page.getByRole('heading', { name: 'Einkaufsliste' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Zurück zum Dashboard' })).toBeVisible();
		await expect.element(page.getByText('2 offen')).toBeVisible();
	});

	test('shows the empty state when there are no open items', async () => {
		renderPage([]);
		await expect.element(page.getByText(/Keine offenen Posten/)).toBeVisible();
	});

	test('adding an item shows it immediately and updates the pill', async () => {
		nextResult = {
			type: 'success',
			data: { item: item('Käse', { id: 'server-id' }) }
		};
		renderPage([]);

		await page.getByLabelText('Posten hinzufügen').fill('Käse');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		await expect.element(page.getByText('Käse')).toBeVisible();
		await expect.element(page.getByText('1 offen')).toBeVisible();
		await expect.element(page.getByLabelText('Posten hinzufügen')).toHaveValue('');
	});

	test('rolls back the optimistic add and shows a toast on failure', async () => {
		nextResult = { type: 'failure', data: { userMessage: 'Da ist etwas schiefgelaufen.' } };
		renderPage([]);

		await page.getByLabelText('Posten hinzufügen').fill('Käse');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();

		await expect.element(page.getByText('0 offen')).toBeVisible();
		await expect.element(page.getByText('Käse')).not.toBeInTheDocument();
		expect(
			toast.toasts.some(
				(t) => t.variant === 'error' && t.message === 'Da ist etwas schiefgelaufen.'
			)
		).toBe(true);
	});

	test('undoes a checkbox tap within the grace period without submitting', async () => {
		setGraceDelayMsForTests(10_000);
		renderPage([item('Milch')]);

		await page.getByRole('button', { name: 'Milch abhaken' }).click();
		const undo = page.getByRole('button', { name: 'Milch doch nicht abhaken' });
		await expect.element(undo).toBeVisible();

		await undo.click();
		await expect.element(page.getByRole('button', { name: 'Milch abhaken' })).toBeVisible();
		await expect.element(page.getByText('1 offen')).toBeVisible();
	});

	test('completing an item removes it from the open list and pill after the grace period', async () => {
		renderPage([item('Milch')]);

		await page.getByRole('button', { name: 'Milch abhaken' }).click();
		await expect.element(page.getByText('Milch'), { timeout: 3000 }).not.toBeInTheDocument();
		await expect.element(page.getByText('0 offen')).toBeVisible();
	});

	test('keeps the item open and shows a toast when completing fails', async () => {
		holdCallbacks = true;
		renderPage([item('Milch')]);

		await page.getByRole('button', { name: 'Milch abhaken' }).click();
		await new Promise((r) => setTimeout(r, 40));
		expect(heldCallbacks.length).toBe(1);

		heldCallbacks[0]({ result: { type: 'failure' } });
		await expect.element(page.getByRole('button', { name: 'Milch abhaken' })).toBeVisible();
		expect(
			toast.toasts.some(
				(t) =>
					t.variant === 'error' &&
					t.message === 'Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.'
			)
		).toBe(true);
	});

	test('shows a toast when loading the done list fails', async () => {
		nextResult = { type: 'failure', data: { userMessage: 'Da ist etwas schiefgelaufen.' } };
		renderPage([], 0);

		await page.getByLabelText('Erledigte anzeigen').click();

		expect(
			toast.toasts.some(
				(t) => t.variant === 'error' && t.message === 'Da ist etwas schiefgelaufen.'
			)
		).toBe(true);
		expect(page.getByRole('button', { name: /wieder öffnen/ }).elements()).toHaveLength(0);
	});

	test('clicking "Mehr laden" appends the next page', async () => {
		nextResult = {
			type: 'success',
			data: { items: [doneItem('Kaffee')], nextCursor: '2026-06-24T07:00:00.000Z', hasMore: true }
		};
		renderPage([], 2);
		await page.getByLabelText('Erledigte anzeigen').click();
		await expect.element(page.getByRole('button', { name: 'Mehr laden' })).toBeVisible();

		nextResult = {
			type: 'success',
			data: { items: [doneItem('Tee')], nextCursor: undefined, hasMore: false }
		};
		await page.getByRole('button', { name: 'Mehr laden' }).click();

		await expect.element(page.getByRole('button', { name: 'Tee wieder öffnen' })).toBeVisible();
		expect(page.getByRole('button', { name: 'Mehr laden' }).elements()).toHaveLength(0);
	});

	test('completing an open item live-moves it into an already-visible done list', async () => {
		nextResult = {
			type: 'success',
			data: { items: [doneItem('Kaffee')], nextCursor: undefined, hasMore: false }
		};
		renderPage([item('Milch')], 1);
		await page.getByLabelText('Erledigte anzeigen').click();
		await expect.element(page.getByRole('button', { name: 'Kaffee wieder öffnen' })).toBeVisible();

		nextResult = { type: 'success' };
		await page.getByRole('button', { name: 'Milch abhaken' }).click();

		await expect
			.element(page.getByRole('button', { name: 'Milch wieder öffnen' }), { timeout: 3000 })
			.toBeVisible();
		await expect.element(page.getByText('Erledigt · 2')).toBeVisible();
	});

	test('reveals done items and a "Mehr laden" button when toggled on', async () => {
		nextResult = {
			type: 'success',
			data: { items: [doneItem('Kaffee')], nextCursor: '2026-06-24T07:00:00.000Z', hasMore: true }
		};
		renderPage([item('Milch')], 3);

		await page.getByLabelText('Erledigte anzeigen').click();

		await expect.element(page.getByText('Erledigt · 3')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Kaffee wieder öffnen' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Mehr laden' })).toBeVisible();
	});

	test('hides "Mehr laden" once there are no further pages', async () => {
		nextResult = {
			type: 'success',
			data: { items: [doneItem('Kaffee')], nextCursor: undefined, hasMore: false }
		};
		renderPage([], 1);

		await page.getByLabelText('Erledigte anzeigen').click();
		await expect.element(page.getByRole('button', { name: 'Kaffee wieder öffnen' })).toBeVisible();
		expect(page.getByRole('button', { name: 'Mehr laden' }).elements()).toHaveLength(0);
	});

	test('reopening a done item moves it back to the open list after the grace period', async () => {
		nextResult = {
			type: 'success',
			data: { items: [doneItem('Kaffee')], nextCursor: undefined, hasMore: false }
		};
		renderPage([], 1);
		await page.getByLabelText('Erledigte anzeigen').click();
		await expect.element(page.getByRole('button', { name: 'Kaffee wieder öffnen' })).toBeVisible();

		nextResult = { type: 'success' };
		await page.getByRole('button', { name: 'Kaffee wieder öffnen' }).click();

		await expect
			.element(page.getByRole('button', { name: 'Kaffee abhaken' }), { timeout: 3000 })
			.toBeVisible();
		await expect.element(page.getByText('Erledigt · 0')).toBeVisible();
	});

	test('clicking the item text opens inline edit, Enter saves the new name', async () => {
		renderPage([item('Milch')]);

		await page.getByRole('button', { name: 'Milch', exact: true }).click();
		const input = page.getByRole('textbox').nth(1);
		await input.fill('Hafermilch');
		await userEvent.keyboard('{Enter}');

		await expect
			.element(page.getByRole('button', { name: 'Hafermilch', exact: true }))
			.toBeVisible();
	});

	test('Escape cancels the inline edit without saving', async () => {
		renderPage([item('Milch')]);

		await page.getByRole('button', { name: 'Milch', exact: true }).click();
		const input = page.getByRole('textbox').nth(1);
		await input.fill('Hafermilch');
		await userEvent.keyboard('{Escape}');

		await expect.element(page.getByRole('button', { name: 'Milch', exact: true })).toBeVisible();
	});

	test('rolls back a failed rename and shows a toast', async () => {
		renderPage([item('Milch')]);

		await page.getByRole('button', { name: 'Milch', exact: true }).click();
		const input = page.getByRole('textbox').nth(1);
		await input.fill('Hafermilch2');
		nextResult = { type: 'failure', data: { userMessage: 'Der Name muss länger sein.' } };
		await userEvent.keyboard('{Enter}');

		await expect.element(page.getByRole('button', { name: 'Milch', exact: true })).toBeVisible();
		expect(
			toast.toasts.some((t) => t.variant === 'error' && t.message === 'Der Name muss länger sein.')
		).toBe(true);
	});
});

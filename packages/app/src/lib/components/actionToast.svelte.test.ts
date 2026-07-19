import { describe, test, expect, beforeEach } from 'vitest';
import type { ActionResult } from '@sveltejs/kit';
import { toastActionFailure } from './actionToast';
import { toast } from './toastStore.svelte';

const FALLBACK = 'Etwas ist schiefgelaufen.';

beforeEach(() => {
	for (const t of [...toast.toasts]) toast.dismiss(t.id);
});

describe('toastActionFailure', () => {
	test('shows nothing on a successful result', () => {
		toastActionFailure({ type: 'success', status: 200 } as ActionResult, FALLBACK);
		expect(toast.toasts.length).toBe(0);
	});

	test('shows the server-provided userMessage on a failure result', () => {
		toastActionFailure(
			{ type: 'failure', status: 400, data: { userMessage: 'Konkreter Grund.' } } as ActionResult,
			FALLBACK
		);
		expect(
			toast.toasts.some((t) => t.variant === 'error' && t.message === 'Konkreter Grund.')
		).toBe(true);
	});

	test('falls back to the given message when a failure carries no userMessage', () => {
		toastActionFailure({ type: 'failure', status: 500, data: {} } as ActionResult, FALLBACK);
		expect(toast.toasts.some((t) => t.variant === 'error' && t.message === FALLBACK)).toBe(true);
	});

	test('falls back to the given message on an unexpected error result', () => {
		toastActionFailure(
			{ type: 'error', status: 500, error: new Error('boom') } as ActionResult,
			FALLBACK
		);
		expect(toast.toasts.some((t) => t.variant === 'error' && t.message === FALLBACK)).toBe(true);
	});
});

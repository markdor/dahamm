import type { ActionResult } from '@sveltejs/kit';
import { toast } from './toastStore.svelte';

/**
 * Shows an error toast for a failed form action. Trusts `result.data.userMessage`
 * as already display-ready (server-side contract: every fail() payload either
 * carries a safe userMessage or none at all), falling back to a generic text
 * for results without one (e.g. unexpected 'error' type, network failure).
 */
export function toastActionFailure(result: ActionResult, fallback: string) {
	if (result.type === 'success') return;
	const message =
		result.type === 'failure' && typeof result.data?.userMessage === 'string'
			? result.data.userMessage
			: fallback;
	toast.show('error', message);
}

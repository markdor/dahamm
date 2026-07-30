/**
 * Length limits for the name of a shopping list item.
 *
 * Shared domain invariant (not just an API detail): used by the web UI
 * (`maxlength`/button enablement), the server validation in
 * `/api/shopping`, and later the bot – a single source so the limits
 * don't drift apart in three places.
 */
export const SHOPPING_ITEM_NAME_LENGTH = {
	min: 3,
	max: 64
} as const;

/**
 * A single shopping list item.
 *
 * Shared domain type: used by the app (dashboard card, detail page,
 * `/api/shopping`, Drizzle schema) and later the Telegram bot, so all
 * sides share the same definition.
 *
 * Deliberately **without** a quantity – the family only checks items off;
 * a quantity is simply written into the name when needed ("2x Milk").
 */
export interface ShoppingItem {
	id: string;
	/** Display name of the item (corresponds to the API field `item`). Length: see {@link SHOPPING_ITEM_NAME_LENGTH}. */
	name: string;
	/** Open (`false`) or done/checked off (`true`) – feeds the "open" count. */
	done: boolean;
	/** Creation timestamp as an ISO string, for stable sorting of the preview. */
	createdAt: string;
}

/** A target the dashboard quick-add can post an entry to. */
export interface QuickAddTarget {
	id: string;
	label: string;
	/** SvelteKit form action the quick-add form posts to. */
	action: string;
}

/**
 * Available quick-add targets.
 *
 * Shared list instead of local to `QuickAdd.svelte`, so later modules
 * (todos, meal planner) can be added here and the web UI and bot use the
 * same source. Currently only the shopping list.
 */
export const QUICK_ADD_TARGETS: QuickAddTarget[] = [
	{ id: 'shopping', label: 'Einkaufsliste', action: '?/addShoppingItem' }
];

/**
 * Length limit for email addresses.
 *
 * Shared validation constraint: used by the login form
 * (`login/+page.svelte`) and the admin user management (`admin/+page.server.ts`),
 * so client and server validation don't drift apart.
 */
export const EMAIL_LENGTH = { max: 254 } as const;

/** Regex for a roughly plausible email format (not a full RFC 5322 parser). */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks format ({@link EMAIL_REGEX}) and length ({@link EMAIL_LENGTH}) in one step. */
export function isValidEmail(value: string): boolean {
	return EMAIL_REGEX.test(value) && value.length <= EMAIL_LENGTH.max;
}

/**
 * Regex for valid usernames.
 *
 * Shared validation constraint: currently only used by the admin user
 * management, but lives here together with the other auth validation constraints.
 */
export const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,40}$/;

/**
 * Regex for a valid Telegram user ID (purely numeric; the field is optional when creating a user).
 *
 * Shared validation constraint: currently only used by the admin user
 * management, but lives here together with the other auth validation constraints
 * – once the bot checks the same ID, both sides will share this source.
 */
export const TELEGRAM_RE = /^\d{1,20}$/;

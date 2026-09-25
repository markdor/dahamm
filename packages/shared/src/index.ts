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
 * a quantity is simply written into the name when needed ("2x Milch").
 */
export interface ShoppingItem {
	id: string;
	/** Display name of the item (corresponds to the API field `item`). Length: see {@link SHOPPING_ITEM_NAME_LENGTH}. */
	name: string;
	/** Open (`false`) or done/checked off (`true`) – feeds the "open" count. */
	done: boolean;
	/** Creation timestamp as an ISO string, for stable sorting of the preview. */
	createdAt: string;
	/** Completion timestamp as an ISO string, `null` while open. Sort key for the "erledigt" list. */
	completedAt: string | null;
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

/*
 * Whisky blind tasting (`/glenidunno`).
 *
 * Shared domain constraints: the single source for the form attributes, the
 * server validation in `tastings.ts` and the CHECK constraints in the Drizzle
 * schema, so the three layers can't drift apart.
 */

/** Length limits for the name of a tasting (trimmed). */
export const TASTING_NAME_LENGTH = { min: 1, max: 60 } as const;

/** Length limits for the name of a participant (trimmed). */
export const TASTING_PARTICIPANT_NAME_LENGTH = { min: 1, max: 40 } as const;

/**
 * Number of participants per tasting. `default` is the number of name fields
 * the create form starts with. Participants are fixed once the tasting exists.
 */
export const TASTING_PARTICIPANT_COUNT = { min: 2, max: 10, default: 3 } as const;

/** Bottles each participant brings, fixed per tasting when it is created. */
export const TASTING_BOTTLES_PER_PARTICIPANT = { min: 1, max: 4, default: 2 } as const;

/**
 * Length limits for the alias of a bottle (trimmed) – the made-up name written
 * on the covered bottle. Unique per tasting, compared case-insensitively.
 */
export const TASTING_ALIAS_LENGTH = { min: 1, max: 30 } as const;

/** Length limits for the real name of a bottle (trimmed). */
export const TASTING_BOTTLE_NAME_LENGTH = { min: 1, max: 80 } as const;

/** Integer scale shared by smoke, cask influence and value. */
export const TASTING_RATING_RANGE = { min: 0, max: 5 } as const;

/** Alcohol by volume in percent, entered with at most one decimal place. */
export const TASTING_ABV = { min: 35, max: 75, step: 0.1 } as const;

/**
 * Time zone the tasting phases are computed in. The server derives the phase
 * from the wall clock in this zone (not from its own or the client's time
 * zone); the participant page also shows the times below.
 */
export const TASTING_TIME_ZONE = 'Europe/Berlin';

/** Local hour on the tasting day from which only the pour order (as aliases) is shown. */
export const TASTING_ORDER_HOUR = 18;

/** Local hour on the day after the tasting from which all bottles are revealed. */
export const TASTING_REVEAL_HOUR = 9;

/**
 * Format of a participant's link token: `randomBytes(24).toString('base64url')`
 * yields 32 characters from the base64url alphabet (192 bits). Used by the
 * route param matcher `src/params/tastingToken.ts`, which also runs in the
 * browser – so it must not come from a server-only module.
 */
export const TASTING_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/**
 * Phase of a tasting, derived solely from its date (no manual status):
 * - `entry`: participants enter their bottles; nobody sees foreign entries
 * - `order`: from {@link TASTING_ORDER_HOUR} on the tasting day – only the pour order as aliases
 * - `revealed`: from {@link TASTING_REVEAL_HOUR} on the following day – all bottles
 */
export type TastingPhase = 'entry' | 'order' | 'revealed';

/** What a participant enters for one bottle. Limits: see the `TASTING_*` constants above. */
export interface TastingBottle {
	/** Made-up name on the covered bottle, unique per tasting (case-insensitive). */
	alias: string;
	/** Real name of the whisky. */
	name: string;
	/** Smoke, 0 = none … 5 = Laphroaig/Ardbeg level. */
	smoke: number;
	/** Cask influence, 0 = barely any wood … 5 = sherry bomb. */
	cask: number;
	/** Alcohol by volume in percent, one decimal place. */
	abv: number;
	/** Value, 0 = everyday bottle … 5 = highlight of the evening. */
	value: number;
}

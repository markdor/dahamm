export type GuardContext = {
	authenticated: boolean;
	bearerAuthorized: boolean;
	/** SvelteKit route ID of the request (`event.route.id`); null when no route matched. */
	routeId: string | null;
};

/** Participant page of the blind tasting – reachable via its token link, without login. */
export const TASTING_PARTICIPANT_ROUTE_ID = '/glenidunno/[token=tastingToken]';

/**
 * Route IDs that are public despite the closed app. Exact IDs, never a prefix:
 * `/glenidunno` and `/glenidunno/admin/*` stay protected. A malformed token
 * fails the param matcher, so no route matches (route ID null) and the request
 * is protected like any unknown path.
 */
const PUBLIC_ROUTE_IDS: ReadonlySet<string> = new Set([TASTING_PARTICIPANT_ROUTE_ID]);

export type GuardDecision =
	{ action: 'resolve' } | { action: 'redirect'; location: string } | { action: 'unauthorized' };

/**
 * Exact segment-prefix match: matches the path itself or any sub-path, but not
 * an unrelated sibling. `/auth` and `/auth/x` match, `/author` does not. Using
 * a plain `startsWith('/auth')` would fail open – a future route like `/author`
 * would be treated as a public Better Auth endpoint and skip the session check.
 */
function underPrefix(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(prefix + '/');
}

/** The bot surface. Kept here so hooks.server.ts decides identically. */
export function isApiPath(pathname: string): boolean {
	return underPrefix(pathname, '/api');
}

/**
 * Pure decision for the global auth guard (see hooks.server.ts):
 *   - /api/*                   → bot surface, needs a valid bearer token (401 otherwise)
 *   - /login, /health, /auth/* → public (login page, container healthcheck + Better Auth endpoints)
 *   - PUBLIC_ROUTE_IDS         → public (tasting token links, access is checked by the page itself)
 *   - everything else          → requires a session, else redirect to /login
 */
export function evaluateGuard(pathname: string, ctx: GuardContext): GuardDecision {
	if (isApiPath(pathname)) {
		return ctx.bearerAuthorized ? { action: 'resolve' } : { action: 'unauthorized' };
	}

	const isPublic =
		pathname === '/login' ||
		pathname === '/health' ||
		underPrefix(pathname, '/auth') ||
		(ctx.routeId !== null && PUBLIC_ROUTE_IDS.has(ctx.routeId));
	if (!isPublic && !ctx.authenticated) {
		return { action: 'redirect', location: '/login' };
	}

	return { action: 'resolve' };
}

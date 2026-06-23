export type GuardContext = {
	authenticated: boolean;
	bearerAuthorized: boolean;
};

export type GuardDecision =
	| { action: 'resolve' }
	| { action: 'redirect'; location: string }
	| { action: 'unauthorized' };

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
 *   - /api/*          → bot surface, needs a valid bearer token (401 otherwise)
 *   - /login, /auth/* → public (login page + Better Auth endpoints)
 *   - everything else → requires a session, else redirect to /login
 */
export function evaluateGuard(pathname: string, ctx: GuardContext): GuardDecision {
	if (isApiPath(pathname)) {
		return ctx.bearerAuthorized ? { action: 'resolve' } : { action: 'unauthorized' };
	}

	const isPublic = pathname === '/login' || underPrefix(pathname, '/auth');
	if (!isPublic && !ctx.authenticated) {
		return { action: 'redirect', location: '/login' };
	}

	return { action: 'resolve' };
}

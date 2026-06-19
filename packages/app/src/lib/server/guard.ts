export type GuardContext = {
	authenticated: boolean;
	bearerAuthorized: boolean;
};

export type GuardDecision =
	| { action: 'resolve' }
	| { action: 'redirect'; location: string }
	| { action: 'unauthorized' };

/**
 * Pure decision for the global auth guard (see hooks.server.ts):
 *   - /api/*          → bot surface, needs a valid bearer token (401 otherwise)
 *   - /login, /auth/* → public (login page + Better Auth endpoints)
 *   - everything else → requires a session, else redirect to /login
 */
export function evaluateGuard(pathname: string, ctx: GuardContext): GuardDecision {
	if (pathname.startsWith('/api')) {
		return ctx.bearerAuthorized ? { action: 'resolve' } : { action: 'unauthorized' };
	}

	const isPublic = pathname === '/login' || pathname.startsWith('/auth');
	if (!isPublic && !ctx.authenticated) {
		return { action: 'redirect', location: '/login' };
	}

	return { action: 'resolve' };
}

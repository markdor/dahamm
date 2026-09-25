import { describe, it, expect } from 'vitest';
import { evaluateGuard, isApiPath, TASTING_PARTICIPANT_ROUTE_ID } from './guard';

describe('evaluateGuard', () => {
	describe('/api/* (bot surface)', () => {
		it('resolves when the bearer token is valid', () => {
			expect(
				evaluateGuard('/api/shopping', {
					authenticated: false,
					bearerAuthorized: true,
					routeId: null
				})
			).toEqual({ action: 'resolve' });
		});

		it('returns unauthorized without a valid bearer token', () => {
			expect(
				evaluateGuard('/api/shopping', {
					authenticated: false,
					bearerAuthorized: false,
					routeId: null
				})
			).toEqual({ action: 'unauthorized' });
		});

		it('does not fall back to the session for /api/* (no redirect)', () => {
			// Even a logged-in browser session must present the bearer token here.
			expect(
				evaluateGuard('/api/todos', { authenticated: true, bearerAuthorized: false, routeId: null })
			).toEqual({ action: 'unauthorized' });
		});
	});

	describe('public routes', () => {
		it('lets unauthenticated users reach /login', () => {
			expect(
				evaluateGuard('/login', {
					authenticated: false,
					bearerAuthorized: false,
					routeId: '/login'
				})
			).toEqual({ action: 'resolve' });
		});

		it('lets unauthenticated requests reach /health (container healthcheck)', () => {
			expect(
				evaluateGuard('/health', {
					authenticated: false,
					bearerAuthorized: false,
					routeId: '/health'
				})
			).toEqual({ action: 'resolve' });
		});

		it('lets Better Auth endpoints through', () => {
			expect(
				evaluateGuard('/auth/sign-in/magic-link', {
					authenticated: false,
					bearerAuthorized: false,
					routeId: null
				})
			).toEqual({ action: 'resolve' });
		});

		it('treats the bare /auth path as public', () => {
			expect(
				evaluateGuard('/auth', { authenticated: false, bearerAuthorized: false, routeId: null })
			).toEqual({ action: 'resolve' });
		});
	});

	describe('public tasting participant route (exact route ID)', () => {
		const anonymous = { authenticated: false, bearerAuthorized: false };
		const tokenPath = '/glenidunno/' + 'a'.repeat(32);

		it('lets anonymous participants reach their token page (incl. __data.json and actions)', () => {
			expect(
				evaluateGuard(tokenPath, { ...anonymous, routeId: TASTING_PARTICIPANT_ROUTE_ID })
			).toEqual({ action: 'resolve' });
		});

		it('keeps /glenidunno and the admin pages behind the login', () => {
			for (const routeId of [
				'/glenidunno',
				'/glenidunno/admin',
				'/glenidunno/admin/new',
				'/glenidunno/admin/[id]'
			]) {
				expect(evaluateGuard('/glenidunno/admin', { ...anonymous, routeId })).toEqual({
					action: 'redirect',
					location: '/login'
				});
			}
		});

		it('protects a malformed token: the matcher rejects it, so no route matches', () => {
			expect(evaluateGuard('/glenidunno/not-a-token', { ...anonymous, routeId: null })).toEqual({
				action: 'redirect',
				location: '/login'
			});
		});

		it('matches the route ID exactly, not as a prefix', () => {
			expect(
				evaluateGuard(tokenPath + '/edit', {
					...anonymous,
					routeId: TASTING_PARTICIPANT_ROUTE_ID + '/edit'
				})
			).toEqual({ action: 'redirect', location: '/login' });
		});

		it('still checks /api/* first', () => {
			expect(
				evaluateGuard('/api/shopping', { ...anonymous, routeId: TASTING_PARTICIPANT_ROUTE_ID })
			).toEqual({ action: 'unauthorized' });
		});
	});

	describe('prefix matching does not leak (fail-open) to sibling paths', () => {
		it('does not treat /author as a public Better Auth endpoint', () => {
			// startsWith('/auth') would wrongly let this through unauthenticated.
			expect(
				evaluateGuard('/author', { authenticated: false, bearerAuthorized: false, routeId: null })
			).toEqual({ action: 'redirect', location: '/login' });
		});

		it('does not treat /healthcheck as the public /health path', () => {
			expect(
				evaluateGuard('/healthcheck', {
					authenticated: false,
					bearerAuthorized: false,
					routeId: null
				})
			).toEqual({ action: 'redirect', location: '/login' });
		});

		it('does not treat /apidocs as the bot surface', () => {
			expect(isApiPath('/apidocs')).toBe(false);
			expect(
				evaluateGuard('/apidocs', { authenticated: false, bearerAuthorized: false, routeId: null })
			).toEqual({ action: 'redirect', location: '/login' });
		});

		it('recognises /api itself and sub-paths as the bot surface', () => {
			expect(isApiPath('/api')).toBe(true);
			expect(isApiPath('/api/shopping')).toBe(true);
		});
	});

	describe('protected routes', () => {
		it('redirects unauthenticated users to /login', () => {
			expect(
				evaluateGuard('/', { authenticated: false, bearerAuthorized: false, routeId: '/' })
			).toEqual({ action: 'redirect', location: '/login' });
		});

		it('redirects unauthenticated users away from /admin', () => {
			expect(
				evaluateGuard('/admin', {
					authenticated: false,
					bearerAuthorized: false,
					routeId: '/admin'
				})
			).toEqual({ action: 'redirect', location: '/login' });
		});

		it('resolves for an authenticated user', () => {
			expect(
				evaluateGuard('/admin', { authenticated: true, bearerAuthorized: false, routeId: '/admin' })
			).toEqual({ action: 'resolve' });
		});
	});
});

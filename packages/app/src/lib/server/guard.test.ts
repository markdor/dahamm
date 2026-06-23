import { describe, it, expect } from 'vitest';
import { evaluateGuard, isApiPath } from './guard';

describe('evaluateGuard', () => {
	describe('/api/* (bot surface)', () => {
		it('resolves when the bearer token is valid', () => {
			expect(
				evaluateGuard('/api/shopping', { authenticated: false, bearerAuthorized: true })
			).toEqual({ action: 'resolve' });
		});

		it('returns unauthorized without a valid bearer token', () => {
			expect(
				evaluateGuard('/api/shopping', { authenticated: false, bearerAuthorized: false })
			).toEqual({ action: 'unauthorized' });
		});

		it('does not fall back to the session for /api/* (no redirect)', () => {
			// Even a logged-in browser session must present the bearer token here.
			expect(evaluateGuard('/api/todos', { authenticated: true, bearerAuthorized: false })).toEqual(
				{ action: 'unauthorized' }
			);
		});
	});

	describe('public routes', () => {
		it('lets unauthenticated users reach /login', () => {
			expect(evaluateGuard('/login', { authenticated: false, bearerAuthorized: false })).toEqual({
				action: 'resolve'
			});
		});

		it('lets Better Auth endpoints through', () => {
			expect(
				evaluateGuard('/auth/sign-in/magic-link', { authenticated: false, bearerAuthorized: false })
			).toEqual({ action: 'resolve' });
		});

		it('treats the bare /auth path as public', () => {
			expect(evaluateGuard('/auth', { authenticated: false, bearerAuthorized: false })).toEqual({
				action: 'resolve'
			});
		});
	});

	describe('prefix matching does not leak (fail-open) to sibling paths', () => {
		it('does not treat /author as a public Better Auth endpoint', () => {
			// startsWith('/auth') would wrongly let this through unauthenticated.
			expect(evaluateGuard('/author', { authenticated: false, bearerAuthorized: false })).toEqual({
				action: 'redirect',
				location: '/login'
			});
		});

		it('does not treat /apidocs as the bot surface', () => {
			expect(isApiPath('/apidocs')).toBe(false);
			expect(evaluateGuard('/apidocs', { authenticated: false, bearerAuthorized: false })).toEqual({
				action: 'redirect',
				location: '/login'
			});
		});

		it('recognises /api itself and sub-paths as the bot surface', () => {
			expect(isApiPath('/api')).toBe(true);
			expect(isApiPath('/api/shopping')).toBe(true);
		});
	});

	describe('protected routes', () => {
		it('redirects unauthenticated users to /login', () => {
			expect(evaluateGuard('/', { authenticated: false, bearerAuthorized: false })).toEqual({
				action: 'redirect',
				location: '/login'
			});
		});

		it('redirects unauthenticated users away from /admin', () => {
			expect(evaluateGuard('/admin', { authenticated: false, bearerAuthorized: false })).toEqual({
				action: 'redirect',
				location: '/login'
			});
		});

		it('resolves for an authenticated user', () => {
			expect(evaluateGuard('/admin', { authenticated: true, bearerAuthorized: false })).toEqual({
				action: 'resolve'
			});
		});
	});
});

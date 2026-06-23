import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { verifyBotToken } from '$lib/server/botToken';
import { evaluateGuard, isApiPath } from '$lib/server/guard';

// Lets Better Auth own everything under /auth/* (sign-in, magic-link verify, …).
// For all other paths svelteKitHandler just calls resolve() and the chain
// continues to the session + guard handles below.
const authHandle: Handle = ({ event, resolve }) =>
	svelteKitHandler({ event, resolve, auth, building: false });

// Populates locals from the session cookie so downstream code (guard, layout,
// route loads) can read the current user without re-parsing the request.
const sessionHandle: Handle = async ({ event, resolve }) => {
	const result = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = result?.user ?? null;
	event.locals.session = result?.session ?? null;
	return resolve(event);
};

function isBearerAuthorized(request: Request): boolean {
	const header = request.headers.get('authorization');
	if (!header?.startsWith('Bearer ')) return false;
	return verifyBotToken(db, header.slice('Bearer '.length).trim());
}

// Closed app: nothing is public except the login page, the Better Auth
// endpoints and static assets. /api/* is the bot surface and uses a bearer
// token instead of a session redirect. The decision itself lives in
// evaluateGuard so it can be unit-tested without a full request.
const guardHandle: Handle = ({ event, resolve }) => {
	const decision = evaluateGuard(event.url.pathname, {
		authenticated: Boolean(event.locals.user),
		bearerAuthorized: isApiPath(event.url.pathname) && isBearerAuthorized(event.request)
	});

	switch (decision.action) {
		case 'unauthorized':
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		case 'redirect':
			throw redirect(302, decision.location);
		default:
			return resolve(event);
	}
};

export const handle = sequence(authHandle, sessionHandle, guardHandle);

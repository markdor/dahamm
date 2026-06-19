import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { user as userTable } from './db/schema';
import { logger } from './logger';
import { sendMagicLinkMail } from './mailer';

const baseURL = env.BASE_URL ?? 'http://localhost:5173';

export const auth = betterAuth({
	// Mounted at /auth so the /api/* namespace stays free for the bot endpoints.
	basePath: '/auth',
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	secret: env.AUTH_SECRET ?? 'dev-secret-do-not-use-in-production',
	baseURL,
	trustedOrigins: [baseURL],
	advanced: {
		// Behind Traefik the real client IP arrives in X-Forwarded-For; without
		// this the rate limiter would bucket every request under the proxy IP.
		ipAddress: {
			ipAddressHeaders: ['x-forwarded-for', 'x-real-ip']
		}
	},
	user: {
		additionalFields: {
			username: { type: 'string', required: true, input: false },
			isAdmin: { type: 'boolean', required: false, defaultValue: false, input: false },
			telegramUserId: { type: 'string', required: false, input: false }
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24
	},
	// Built-in rate limiter, persisted in the same SQLite DB (no extra storage).
	rateLimit: {
		enabled: true,
		storage: 'database',
		modelName: 'rateLimit',
		window: 10,
		max: 10, // default for all auth routes: 10 req / 10 s
		customRules: {
			'/sign-in/magic-link': { window: 15 * 60, max: 5 } // 5 req / 15 min per IP
		}
	},
	plugins: [
		magicLink({
			// Better Auth never creates users itself – the only way into the user
			// table is the admin bootstrap or the admin page.
			disableSignUp: true,
			expiresIn: 60 * 60 * 24, // link valid for 24 hours
			sendMagicLink: async ({ email, url }) => {
				// Whitelist enforcement: Better Auth would otherwise send a link to any
				// address. Only registered users (a row in `user`) get a mail. The
				// expensive token generation already happened identically for hit and
				// miss before this callback runs, so an indexed SELECT here does not
				// create a timing oracle for enumeration.
				const exists = db
					.select({ id: userTable.id })
					.from(userTable)
					.where(eq(userTable.email, email))
					.get();

				if (!exists) {
					logger.debug({ email }, 'magic link requested for non-whitelisted email (ignored)');
					return;
				}

				if (dev) {
					logger.info({ email, url }, 'magic link (dev console only, no SMTP)');
					return;
				}

				// Fire-and-forget: SMTP latency must not gate the auth response,
				// otherwise timing differences leak whitelist membership.
				sendMagicLinkMail(email, url).catch((err) => {
					logger.error({ err, email }, 'failed to send magic link email');
				});
			}
		}),
		sveltekitCookies(getRequestEvent)
	]
});

export type Auth = typeof auth;

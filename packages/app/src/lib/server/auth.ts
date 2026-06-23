import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { appendFileSync } from 'node:fs';
import { db } from './db';
import { user as userTable } from './db/schema';
import { logger } from './logger';
import { sendMagicLinkMail } from './mailer';
import { consumeEmailRateLimit } from './magicLinkThrottle';

const baseURL = env.BASE_URL ?? 'http://localhost:5173';

// Fail fast instead of silently signing cookies and tokens with a public,
// well-known fallback secret. In dev the placeholder is fine; in production a
// missing secret is a hard configuration error.
if (!env.AUTH_SECRET && !dev) {
	throw new Error('AUTH_SECRET must be set in production');
}
const secret = env.AUTH_SECRET ?? 'dev-secret-do-not-use-in-production';

// Test-only seam: with hashed token storage the plaintext token lives only in
// the email URL, so an e2e harness running a production build (no dev console
// log, no SMTP) can't recover it from the DB. When this path is set we append
// the magic-link URL to it. Off by default; scream if it is ever set in prod.
const magicLinkDebugPath = env.MAGIC_LINK_DEBUG_PATH;
if (magicLinkDebugPath && !dev) {
	logger.warn(
		'MAGIC_LINK_DEBUG_PATH is set outside dev – magic-link URLs are being written to disk. ' +
			'This is a test-only affordance and must never be enabled in production.'
	);
}

export const auth = betterAuth({
	// Mounted at /auth so the /api/* namespace stays free for the bot endpoints.
	basePath: '/auth',
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	secret,
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
			// Persist only a hash of the link token, not the plaintext, so a DB
			// read does not hand out usable 24h logins.
			storeToken: 'hashed',
			expiresIn: 60 * 60 * 24, // link valid for 24 hours
			sendMagicLink: async ({ email: rawEmail, url }) => {
				// Stored addresses are always lowercased (admin bootstrap + admin page),
				// and Better Auth looks users up case-insensitively at verify time. Match
				// that here so the whitelist gate is not stricter than the actual login.
				const email = rawEmail.trim().toLowerCase();

				// Per-email throttle (3/h) on top of Better Auth's per-IP rule. Runs for
				// every request, before the whitelist branch, so hit and miss share the
				// same code path and an over-quota request behaves exactly like a miss
				// (no mail, identical response) – no enumeration oracle.
				const allowed = consumeEmailRateLimit(db, email);

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

				if (!allowed) {
					logger.warn({ email }, 'magic link rate limit exceeded for email (ignored)');
					return;
				}

				if (dev) {
					logger.info({ email, url }, 'magic link (dev console only, no SMTP)');
					return;
				}

				if (magicLinkDebugPath) {
					try {
						appendFileSync(magicLinkDebugPath, url + '\n');
					} catch (err) {
						logger.error({ err }, 'failed to write magic link debug file');
					}
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

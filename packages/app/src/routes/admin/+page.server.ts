import { fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/authGuards';
import { generateBotToken, getBotTokenStatus, revokeBotToken } from '$lib/server/botToken';
import { logger } from '$lib/server/logger';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,40}$/;
const TELEGRAM_RE = /^\d{1,20}$/;

export const load: ServerLoad = ({ locals }) => {
	requireAdmin(locals);
	const users = db
		.select({
			id: user.id,
			email: user.email,
			username: user.username,
			isAdmin: user.isAdmin,
			telegramUserId: user.telegramUserId,
			createdAt: user.createdAt
		})
		.from(user)
		.orderBy(asc(user.createdAt))
		.all();
	return { users, botToken: getBotTokenStatus(db) };
};

type Fields = { email: string; username: string; telegramUserId: string | null };

function validate(
	rawEmail: string,
	rawUsername: string,
	rawTelegram: string
): Fields & { fieldErrors: Record<string, string> } {
	const email = rawEmail.trim().toLowerCase();
	const username = rawUsername.trim();
	const telegram = rawTelegram.trim();
	const fieldErrors: Record<string, string> = {};

	if (!email) fieldErrors.email = 'required';
	else if (!EMAIL_RE.test(email) || email.length > 254) fieldErrors.email = 'invalid';

	if (!username) fieldErrors.username = 'required';
	else if (!USERNAME_RE.test(username)) fieldErrors.username = 'invalid';

	// Telegram ID is optional (users without bot access are allowed).
	if (telegram && !TELEGRAM_RE.test(telegram)) fieldErrors.telegramUserId = 'invalid';

	return { email, username, telegramUserId: telegram || null, fieldErrors };
}

function uniqueColumn(message: string): 'email' | 'username' | 'telegramUserId' {
	if (message.includes('telegram')) return 'telegramUserId';
	if (message.includes('username')) return 'username';
	return 'email';
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const rawEmail = String(form.get('email') ?? '');
		const rawUsername = String(form.get('username') ?? '');
		const rawTelegram = String(form.get('telegramUserId') ?? '');
		const isAdmin = form.get('isAdmin') === 'on';

		const { email, username, telegramUserId, fieldErrors } = validate(
			rawEmail,
			rawUsername,
			rawTelegram
		);
		if (Object.keys(fieldErrors).length > 0) {
			return fail(400, {
				action: 'create',
				email: rawEmail,
				username: rawUsername,
				telegramUserId: rawTelegram,
				fieldErrors
			});
		}

		try {
			const now = new Date();
			db.insert(user)
				.values({
					id: randomUUID(),
					name: username,
					email,
					emailVerified: true,
					username,
					isAdmin,
					telegramUserId,
					createdAt: now,
					updatedAt: now
				})
				.run();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (message.includes('UNIQUE')) {
				return fail(409, {
					action: 'create',
					email: rawEmail,
					username: rawUsername,
					telegramUserId: rawTelegram,
					fieldErrors: { [uniqueColumn(message)]: 'taken' }
				});
			}
			logger.error({ err }, 'admin create user failed');
			throw err;
		}

		return { action: 'create', created: true };
	},

	update: async ({ request, locals }) => {
		const current = requireAdmin(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const rawEmail = String(form.get('email') ?? '');
		const rawUsername = String(form.get('username') ?? '');
		const rawTelegram = String(form.get('telegramUserId') ?? '');
		const isAdmin = form.get('isAdmin') === 'on';

		if (!id) return fail(400, { action: 'update', error: 'missing_id' });

		const { email, username, telegramUserId, fieldErrors } = validate(
			rawEmail,
			rawUsername,
			rawTelegram
		);
		if (Object.keys(fieldErrors).length > 0) {
			return fail(400, {
				action: 'update',
				id,
				email: rawEmail,
				username: rawUsername,
				telegramUserId: rawTelegram,
				fieldErrors
			});
		}

		// Self-protection: an admin must not be able to demote themselves.
		const targetIsCurrent = id === current.id;
		const finalIsAdmin = targetIsCurrent ? true : isAdmin;

		try {
			const result = db
				.update(user)
				.set({
					email,
					username,
					name: username,
					telegramUserId,
					isAdmin: finalIsAdmin,
					updatedAt: new Date()
				})
				.where(eq(user.id, id))
				.run();
			if (result.changes === 0) {
				return fail(404, { action: 'update', error: 'not_found' });
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (message.includes('UNIQUE')) {
				return fail(409, {
					action: 'update',
					id,
					email: rawEmail,
					username: rawUsername,
					telegramUserId: rawTelegram,
					fieldErrors: { [uniqueColumn(message)]: 'taken' }
				});
			}
			logger.error({ err }, 'admin update user failed');
			throw err;
		}

		return { action: 'update', updated: true, selfDemoteBlocked: targetIsCurrent && !isAdmin };
	},

	delete: async ({ request, locals }) => {
		const current = requireAdmin(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { action: 'delete', error: 'missing_id' });

		// Self-protection: an admin must not delete their own entry.
		if (id === current.id) {
			return fail(400, { action: 'delete', error: 'self_delete' });
		}

		// session.userId has ON DELETE CASCADE, so all of the user's active
		// sessions die with the row → forced logout on their next request.
		const result = db.delete(user).where(eq(user.id, id)).run();
		if (result.changes === 0) {
			return fail(404, { action: 'delete', error: 'not_found' });
		}

		return { action: 'delete', deleted: true };
	},

	generateToken: async ({ locals }) => {
		requireAdmin(locals);
		// Plaintext is returned exactly once; only the hash is stored.
		const token = generateBotToken(db);
		return { action: 'generateToken', token };
	},

	revokeToken: async ({ locals }) => {
		requireAdmin(locals);
		revokeBotToken(db);
		return { action: 'revokeToken', revoked: true };
	}
};

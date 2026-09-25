import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { tastingWriteThrottle } from './db/schema';
import type { ThrottleOptions } from './magicLinkThrottle';

type Schema = { tastingWriteThrottle: typeof tastingWriteThrottle };
type Db = BetterSQLite3Database<Schema>;

// Start value, tunable: a participant saves a handful of bottles and corrects a
// few of them. Deliberately per participant (= per token) and not per IP: the
// 192-bit tokens can't be guessed, and behind Traefik without ADDRESS_HEADER
// every request would share the proxy's IP anyway.
export const TASTING_WRITE_LIMIT: ThrottleOptions = {
	max: 30,
	windowMs: 10 * 60 * 1000
};

/**
 * Fixed-window write counter per participant, persisted in SQLite – the same
 * logic as `consumeEmailRateLimit`. Returns true if the save may proceed (and
 * records it), false once the participant has exhausted the current window.
 */
export function consumeTastingWriteLimit(
	db: Db,
	participantId: string,
	opts: ThrottleOptions = TASTING_WRITE_LIMIT,
	now: Date = new Date()
): boolean {
	const row = db
		.select()
		.from(tastingWriteThrottle)
		.where(eq(tastingWriteThrottle.participantId, participantId))
		.get();

	// No prior record, or the previous window has fully elapsed → start fresh.
	if (!row || now.getTime() - row.windowStart.getTime() > opts.windowMs) {
		db.insert(tastingWriteThrottle)
			.values({ participantId, count: 1, windowStart: now })
			.onConflictDoUpdate({
				target: tastingWriteThrottle.participantId,
				set: { count: 1, windowStart: now }
			})
			.run();
		return true;
	}

	if (row.count >= opts.max) return false;

	db.update(tastingWriteThrottle)
		.set({ count: row.count + 1 })
		.where(eq(tastingWriteThrottle.participantId, participantId))
		.run();
	return true;
}

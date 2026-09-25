import {
	TASTING_ORDER_HOUR,
	TASTING_REVEAL_HOUR,
	TASTING_TIME_ZONE,
	type TastingPhase
} from '@dahamm/shared';

// The container runs in UTC and the client's clock is irrelevant: the phase is
// always derived on the server from the wall clock in TASTING_TIME_ZONE. Intl
// (ICU, bundled with Node) applies the DST rules, so no dependency and no TZ
// setting is needed – the result is the same in prod, CI and dev.
const wallClockFormat = new Intl.DateTimeFormat('en-CA', {
	timeZone: TASTING_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	// Not `hour12: false`, which renders midnight as "24" in some ICU versions.
	hourCycle: 'h23'
});

function wallClock(now: Date): { date: string; hour: number } {
	const parts = Object.fromEntries(
		wallClockFormat.formatToParts(now).map((part) => [part.type, part.value])
	);
	return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** Pure calendar arithmetic on a `YYYY-MM-DD` date (in UTC, so DST can't interfere). */
function addDays(date: string, days: number): string {
	const day = new Date(`${date}T00:00:00Z`);
	day.setUTCDate(day.getUTCDate() + days);
	return day.toISOString().slice(0, 10);
}

/** Today's calendar date (`YYYY-MM-DD`) in Berlin – for "not in the past" and "heute". */
export function getBerlinDate(now: Date): string {
	return wallClock(now).date;
}

/** True for a real calendar date in `YYYY-MM-DD` format (rejects e.g. `2026-02-30`). */
export function isCalendarDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	// Month 13 is an invalid Date (toISOString would throw); Feb 30 rolls over to March.
	const day = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/**
 * Phase of a tasting on `tastingDate` (`YYYY-MM-DD`) at the instant `now`:
 * entry until TASTING_ORDER_HOUR on the tasting day, then order until
 * TASTING_REVEAL_HOUR on the following day, then revealed. The boundaries are
 * full hours, so comparing the Berlin date and hour is enough. Dates in
 * `YYYY-MM-DD` compare correctly as strings.
 */
export function getTastingPhase(tastingDate: string, now: Date): TastingPhase {
	const { date, hour } = wallClock(now);

	if (date < tastingDate) return 'entry';
	if (date === tastingDate) return hour < TASTING_ORDER_HOUR ? 'entry' : 'order';
	if (date === addDays(tastingDate, 1)) return hour < TASTING_REVEAL_HOUR ? 'order' : 'revealed';
	return 'revealed';
}

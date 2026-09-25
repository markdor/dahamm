import { describe, it, expect } from 'vitest';
import { getBerlinDate, getTastingPhase, isCalendarDate } from './tastingPhase';

// All instants are given in UTC: the result must not depend on the time zone of
// the machine running the tests (CI runs in UTC, dev machines usually in Berlin).
const at = (iso: string) => new Date(iso);

describe('getTastingPhase', () => {
	describe('summer time (CEST, UTC+2)', () => {
		const day = '2026-10-03';

		it('is entry before the tasting day', () => {
			expect(getTastingPhase(day, at('2026-09-20T12:00:00Z'))).toBe('entry');
			expect(getTastingPhase(day, at('2026-10-02T21:59:59Z'))).toBe('entry'); // 23:59:59 local
		});

		it('switches from entry to order at 18:00 on the tasting day', () => {
			expect(getTastingPhase(day, at('2026-10-02T22:00:00Z'))).toBe('entry'); // 00:00 local
			expect(getTastingPhase(day, at('2026-10-03T15:59:59Z'))).toBe('entry'); // 17:59:59
			expect(getTastingPhase(day, at('2026-10-03T16:00:00Z'))).toBe('order'); // 18:00:00
		});

		it('stays in order over midnight, while UTC still has the tasting day', () => {
			expect(getTastingPhase(day, at('2026-10-03T22:30:00Z'))).toBe('order'); // 00:30 next day
		});

		it('switches from order to revealed at 9:00 on the following day', () => {
			expect(getTastingPhase(day, at('2026-10-04T06:59:59Z'))).toBe('order'); // 08:59:59
			expect(getTastingPhase(day, at('2026-10-04T07:00:00Z'))).toBe('revealed'); // 09:00:00
		});

		it('stays revealed afterwards', () => {
			expect(getTastingPhase(day, at('2026-10-05T01:00:00Z'))).toBe('revealed');
			expect(getTastingPhase(day, at('2027-03-01T12:00:00Z'))).toBe('revealed');
		});
	});

	describe('winter time (CET, UTC+1)', () => {
		it('uses 17:00 UTC as 18:00 local and 08:00 UTC as 9:00 local', () => {
			const day = '2026-12-12';
			expect(getTastingPhase(day, at('2026-12-12T16:59:59Z'))).toBe('entry');
			expect(getTastingPhase(day, at('2026-12-12T17:00:00Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-12-13T07:59:59Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-12-13T08:00:00Z'))).toBe('revealed');
		});

		it('handles the turn of the year', () => {
			const day = '2026-12-31';
			expect(getTastingPhase(day, at('2026-12-31T23:30:00Z'))).toBe('order'); // Jan 1, 00:30
			expect(getTastingPhase(day, at('2027-01-01T08:00:00Z'))).toBe('revealed');
		});
	});

	describe('DST switch on 29.03.2026 (02:00 CET → 03:00 CEST)', () => {
		it('as tasting day: 18:00 local is already CEST (16:00 UTC)', () => {
			const day = '2026-03-29';
			expect(getTastingPhase(day, at('2026-03-29T15:59:59Z'))).toBe('entry');
			expect(getTastingPhase(day, at('2026-03-29T16:00:00Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-03-30T06:59:59Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-03-30T07:00:00Z'))).toBe('revealed');
		});

		it('as following day: 18:00 was CET (17:00 UTC), 9:00 is CEST (07:00 UTC)', () => {
			const day = '2026-03-28';
			expect(getTastingPhase(day, at('2026-03-28T16:59:59Z'))).toBe('entry');
			expect(getTastingPhase(day, at('2026-03-28T17:00:00Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-03-29T06:59:59Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-03-29T07:00:00Z'))).toBe('revealed');
		});
	});

	describe('DST switch on 25.10.2026 (03:00 CEST → 02:00 CET)', () => {
		it('as tasting day: 18:00 local is already CET (17:00 UTC)', () => {
			const day = '2026-10-25';
			expect(getTastingPhase(day, at('2026-10-25T16:59:59Z'))).toBe('entry');
			expect(getTastingPhase(day, at('2026-10-25T17:00:00Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-10-26T07:59:59Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-10-26T08:00:00Z'))).toBe('revealed');
		});

		it('as following day: 18:00 was CEST (16:00 UTC), 9:00 is CET (08:00 UTC)', () => {
			const day = '2026-10-24';
			expect(getTastingPhase(day, at('2026-10-24T15:59:59Z'))).toBe('entry');
			expect(getTastingPhase(day, at('2026-10-24T16:00:00Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-10-25T07:59:59Z'))).toBe('order');
			expect(getTastingPhase(day, at('2026-10-25T08:00:00Z'))).toBe('revealed');
		});
	});
});

describe('getBerlinDate', () => {
	it('returns the Berlin calendar date, not the UTC one', () => {
		expect(getBerlinDate(at('2026-10-03T21:59:59Z'))).toBe('2026-10-03');
		expect(getBerlinDate(at('2026-10-03T22:00:00Z'))).toBe('2026-10-04');
		expect(getBerlinDate(at('2026-01-15T23:00:00Z'))).toBe('2026-01-16');
	});
});

describe('isCalendarDate', () => {
	it('accepts real dates in YYYY-MM-DD format', () => {
		expect(isCalendarDate('2026-10-03')).toBe(true);
		expect(isCalendarDate('2028-02-29')).toBe(true);
	});

	it('rejects impossible dates and other formats', () => {
		for (const value of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-10-3', '03.10.2026', '']) {
			expect(isCalendarDate(value)).toBe(false);
		}
	});
});

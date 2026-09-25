import { describe, it, expect } from 'vitest';
import { getSecurityHeaders } from './securityHeaders';
import { TASTING_PARTICIPANT_ROUTE_ID } from './guard';

describe('getSecurityHeaders', () => {
	it('locks down the public tasting participant page', () => {
		expect(getSecurityHeaders(TASTING_PARTICIPANT_ROUTE_ID)).toEqual({
			'Referrer-Policy': 'no-referrer',
			'X-Robots-Tag': 'noindex, nofollow',
			'Cache-Control': 'no-store'
		});
	});

	it('disables caching on the tasting admin pages (links are shown once)', () => {
		for (const routeId of [
			'/glenidunno/admin',
			'/glenidunno/admin/new',
			'/glenidunno/admin/[id]'
		]) {
			expect(getSecurityHeaders(routeId)).toEqual({ 'Cache-Control': 'no-store' });
		}
	});

	it('adds nothing to other routes or when no route matched', () => {
		for (const routeId of [
			'/',
			'/shopping',
			'/admin',
			'/glenidunno',
			'/glenidunno/administrator',
			null
		]) {
			expect(getSecurityHeaders(routeId)).toEqual({});
		}
	});
});

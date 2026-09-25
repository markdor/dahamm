import { TASTING_PARTICIPANT_ROUTE_ID } from './guard';

function isTastingAdminRoute(routeId: string): boolean {
	return routeId === '/glenidunno/admin' || routeId.startsWith('/glenidunno/admin/');
}

/**
 * Extra response headers per SvelteKit route ID. hooks.server.ts applies them
 * after resolve(), so the page, its `__data.json`, action responses and the 404
 * for an unknown token are all covered. Pure function because hooks.server.ts
 * is excluded from the coverage.
 */
export function getSecurityHeaders(routeId: string | null): Record<string, string> {
	if (routeId === TASTING_PARTICIPANT_ROUTE_ID) {
		return {
			// The root layout always renders the footer with an external link – the
			// token URL must not leak via the Referer header.
			'Referrer-Policy': 'no-referrer',
			// Deliberately no robots.txt Disallow instead: crawlers must fetch the
			// page to see this header, otherwise a linked token URL could get indexed.
			'X-Robots-Tag': 'noindex, nofollow',
			// The content changes with the phase (18:00 / 9:00) – never a cached copy.
			'Cache-Control': 'no-store'
		};
	}
	if (routeId !== null && isTastingAdminRoute(routeId)) {
		// The admin pages show freshly generated links exactly once.
		return { 'Cache-Control': 'no-store' };
	}
	return {};
}

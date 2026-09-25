import { describe, it, expect, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createHandleError } from './handleError';

const TOKEN = 'TokenTokenTokenTokenTokenToken12';

function event(method: string, pathname: string, routeId: string | null): RequestEvent {
	const url = new URL(pathname, 'http://localhost');
	return {
		url,
		request: new Request(url, { method }),
		route: { id: routeId },
		params: routeId ? { token: TOKEN } : {}
	} as unknown as RequestEvent;
}

function setup() {
	const log = { error: vi.fn(), warn: vi.fn() };
	return { log, handleError: createHandleError(log as never) };
}

describe('createHandleError', () => {
	it('logs unexpected errors with the route ID instead of the pathname', async () => {
		const { log, handleError } = setup();
		const err = new Error('database is locked');

		const result = await handleError({
			error: err,
			event: event('POST', `/glenidunno/${TOKEN}`, '/glenidunno/[token=tastingToken]'),
			status: 500,
			message: 'Internal Error'
		});

		expect(log.error).toHaveBeenCalledWith(
			{ status: 500, method: 'POST', routeId: '/glenidunno/[token=tastingToken]', err },
			'unexpected server error'
		);
		expect(JSON.stringify(log.error.mock.calls)).not.toContain(TOKEN);
		expect(result).toEqual({ message: 'Internal Error' });
	});

	it('leaves the error out below 500 – an unmatched 404 carries the pathname', async () => {
		const { log, handleError } = setup();
		// What SvelteKit throws when no route matches, e.g. a truncated token.
		const notFound = new Error(`Not found: /glenidunno/${TOKEN.slice(0, 20)}`);

		const result = await handleError({
			error: notFound,
			event: event('GET', `/glenidunno/${TOKEN.slice(0, 20)}`, null),
			status: 404,
			message: 'Not Found'
		});

		expect(log.warn).toHaveBeenCalledWith(
			{ status: 404, method: 'GET', routeId: null },
			'request failed'
		);
		expect(JSON.stringify(log.warn.mock.calls)).not.toContain(TOKEN.slice(0, 20));
		expect(log.error).not.toHaveBeenCalled();
		expect(result).toEqual({ message: 'Not Found' });
	});
});

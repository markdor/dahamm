import type { HandleServerError } from '@sveltejs/kit';
import type { Logger } from 'pino';

/**
 * Replacement for SvelteKit's default `handleError`, which logs
 * `[status] METHOD <pathname>` for every unexpected error – on
 * `/glenidunno/<token>` that would write a participant's token into the log.
 * We log the route ID instead: it names the route, never a param value.
 *
 * Below 500 the error itself stays out of the log too: the 404 for an unmatched
 * path carries the pathname in its message (`Not found: /…`), e.g. a truncated
 * token of a logged-in user. Expected errors such as `error(404)` in a `load`
 * never reach this hook.
 */
export function createHandleError(log: Pick<Logger, 'error' | 'warn'>): HandleServerError {
	return ({ error, event, status, message }) => {
		const context = { status, method: event.request.method, routeId: event.route.id };

		if (status >= 500) {
			log.error({ ...context, err: error }, 'unexpected server error');
		} else {
			log.warn(context, 'request failed');
		}

		return { message };
	};
}

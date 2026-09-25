import type { ParamMatcher } from '@sveltejs/kit';
import { TASTING_TOKEN_RE } from '@dahamm/shared';

// Matcher for `/glenidunno/[token=tastingToken]`, the only anonymous route. A
// malformed token (or the static `admin` segment) never reaches that route:
// `event.route.id` stays null and the auth guard treats the request like any
// unknown path. Also runs in the browser for client-side routing – so shared
// imports only, nothing from `$lib/server`.
export const match: ParamMatcher = (param) => TASTING_TOKEN_RE.test(param);

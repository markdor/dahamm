/**
 * Grace period (ms) before a checkbox toggle actually persists. Pulled out of
 * +page.svelte into its own module so tests can shorten it (route components
 * may only accept SvelteKit's own props – `data`/`form` – so an extra
 * `graceDelayMs` prop like ShoppingCard.svelte's isn't an option here, see
 * `svelte/valid-prop-names-in-kit-pages`). Test seam, analogous to
 * `MAGIC_LINK_DEBUG_PATH` in auth.ts – not used by the app itself.
 */
let graceDelayMs = 2000;

export function getGraceDelayMs(): number {
	return graceDelayMs;
}

export function setGraceDelayMsForTests(ms: number): void {
	graceDelayMs = ms;
}

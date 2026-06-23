import { rmSync } from 'node:fs';

// Wipe any leftover E2E SQLite files so each run boots a clean DB (fresh
// migrations + admin bootstrap), plus the magic-link capture file. The paths
// match DB_PATH / MAGIC_LINK_DEBUG_PATH in playwright.config.ts.
const E2E_DB_FILES = [
	'./e2e.db',
	'./e2e.db-shm',
	'./e2e.db-wal',
	'./e2e.db-journal',
	'./e2e-magic-link.log'
];

export default async function globalSetup() {
	for (const f of E2E_DB_FILES) {
		try {
			rmSync(f, { force: true });
		} catch {
			// ignore — file did not exist or could not be removed
		}
	}
}

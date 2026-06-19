import { defineConfig } from '@playwright/test';

// Flags container runs so tests that need host-side DB access (the magic-link
// login flow) skip explicitly, instead of guessing from a possibly-stale local
// e2e.db file. Worker processes inherit this from the runner's env.
process.env.E2E_TARGET = 'docker';

// Runs the e2e suite against the production-like container from compose.yaml
// (repo root) instead of the Vite preview server. The magic-link login test
// self-skips here because the SQLite DB lives on the container volume and is
// unreachable from the host; the closed-app smoke checks still run.
// Keep the URL in sync with BASE_URL in packages/app/.env.
const baseURL = 'http://127.0.0.1:3000';

export default defineConfig({
	webServer: {
		command: 'docker compose -f ../../compose.yaml up --build --force-recreate',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 180_000
	},
	use: { baseURL },
	testMatch: '**/*.e2e.{ts,js}'
});

// Schreibt eine Version in alle Workspace-package.json-Dateien des Monorepos.
// Aufruf: node scripts/sync-workspace-versions.mjs <version>
// Wird von semantic-release (@semantic-release/exec, prepare) mit der neuen
// Release-Version aufgerufen, damit z. B. die App ihre Version anzeigen kann.

import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version) {
	console.error('Usage: node scripts/sync-workspace-versions.mjs <version>');
	process.exit(1);
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} file */
function readJson(file) {
	return JSON.parse(readFileSync(file, 'utf8'));
}

/** @param {string} file @param {object} data */
function writeJson(file, data) {
	writeFileSync(file, JSON.stringify(data, null, '\t') + '\n');
}

const rootPkg = readJson(join(rootDir, 'package.json'));
const patterns = (rootPkg.workspaces ?? []).map((p) => `${p}/package.json`);

const files = patterns.flatMap((pattern) =>
	globSync(pattern, { cwd: rootDir }).map((rel) => join(rootDir, rel))
);

for (const file of files) {
	const pkg = readJson(file);
	if (pkg.version === version) continue;
	pkg.version = version;
	writeJson(file, pkg);
	console.log(`synced ${pkg.name ?? file} -> ${version}`);
}

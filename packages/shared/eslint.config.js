import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import globals from 'globals';
import ts from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

// Lean TS-only lint setup for the shared types package – no Svelte,
// no browser globals. Mirrors the relevant rules from packages/app.
export default defineConfig(
	{ ignores: ['node_modules/'] },
	js.configs.recommended,
	ts.configs.recommended,
	prettier,
	{
		languageOptions: {
			globals: { ...globals.node },
			parserOptions: { tsconfigRootDir: import.meta.dirname }
		},
		rules: {
			// typescript-eslint recommends disabling no-undef in TS projects.
			'no-undef': 'off',
			// Allow deliberately unused identifiers with a `_` prefix.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			]
		}
	}
);

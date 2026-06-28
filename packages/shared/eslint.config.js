import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import globals from 'globals';
import ts from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

// Schlankes TS-only-Lint-Setup für das geteilte Typen-Package – kein Svelte,
// keine Browser-Globals. Spiegelt die relevanten Regeln aus packages/app.
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
			// typescript-eslint empfehlen, no-undef in TS-Projekten zu deaktivieren.
			'no-undef': 'off',
			// Bewusst ungenutzte Bezeichner mit `_`-Präfix erlauben.
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

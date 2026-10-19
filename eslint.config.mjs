import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import reactX from 'eslint-plugin-react-x';
import reactDom from 'eslint-plugin-react-dom';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
	// Vendored agent/skill tooling is not project code.
	{
		ignores: ['dist/', 'node_modules/', '.claude/', '.agents/', '.codex/', '.impeccable/'],
	},
	js.configs.recommended,
	{
		rules: {
			// `_`-prefixed names are deliberately unused bindings.
			'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
		},
	},

	// React islands: the eslint-react ("-x") plugins, which support ESLint 10.
	// Their configs ship no languageOptions, so JSX parsing and browser
	// globals are set here.
	{
		files: ['src/**/*.jsx'],
		languageOptions: {
			globals: globals.browser,
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
	},
	{
		files: ['src/**/*.jsx'],
		...reactX.configs.recommended,
		rules: {
			...reactX.configs.recommended.rules,
			// Same rationale as react-hooks/set-state-in-effect below: the
			// mount-effect setState pattern is how islands sync browser-only
			// state after hydrating from server-rendered HTML.
			'react-x/set-state-in-effect': 'off',
		},
	},
	{ files: ['src/**/*.jsx'], ...reactDom.configs.recommended },
	{
		files: ['src/**/*.jsx'],
		plugins: { 'react-hooks': reactHooks },
		rules: {
			...reactHooks.configs.recommended.rules,
			// Islands hydrate from server-rendered HTML, then sync browser-only
			// state (URL params, localStorage theme, fetched session) after
			// mount. Initializing that state in useState would mismatch the
			// server render, so the mount-effect setState pattern is deliberate.
			'react-hooks/set-state-in-effect': 'off',
		},
	},

	// Browser-side plain JS (API client, theme, stores, content, routes).
	{
		files: ['src/lib/**/*.js', 'src/content/**/*.js', 'src/app/**/*.js'],
		languageOptions: { globals: globals.browser },
	},

	// Node contexts: Harper resources, Vite config plugins, data scripts.
	{
		files: ['resources/**/*.ts', 'data/**/*.mjs', 'config/**/*.mjs', '*.mjs'],
		languageOptions: { globals: globals.node },
	},

	// Harper resources are TypeScript, run via Node type stripping.
	{
		files: ['**/*.ts'],
		languageOptions: { parser: tsParser },
		rules: {
			// The TS compiler owns undefined-name checking; espree-oriented
			// no-undef misfires on type positions.
			'no-undef': 'off',
		},
	},

	// Keep formatting concerns with Prettier.
	prettier,
];

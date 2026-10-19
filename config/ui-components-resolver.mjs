// @ts-check
// Resolution for @node-core/ui-components.
//
// The package ships array-fallback `exports`/`imports` patterns
// ("./dist/*" | "./dist/*.js" | "./dist/*/index.js") that bundler resolvers
// cannot walk. (Line comments on purpose: that last pattern contains `*` and
// `/` back to back, which would end a block comment early.) This plugin walks
// the fallbacks by hand — try each candidate under dist/ and return the first
// file that exists — covering the public subpaths and the package's internal
// `#ui/*` imports for the client build, SSR, and the dev server alike.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(
	new URL('../node_modules/@node-core/ui-components/dist', import.meta.url),
);

const UI_SPECIFIER = /^(?:@node-core\/ui-components|#ui)\/(.+)$/;

/** @type {Map<string, string | null>} */
const cache = new Map();

/**
 * Resolve a ui-components specifier to a concrete file under dist/, walking
 * the package's fallback patterns. Results are cached: dist/ does not change
 * within a dev-server or build run.
 *
 * @param {string} specifier
 * @returns {string | null}
 */
function resolveUiFile(specifier) {
	const cached = cache.get(specifier);
	if (cached !== undefined) return cached;

	const match = specifier.match(UI_SPECIFIER);
	let resolved = null;
	if (match) {
		const base = join(distDir, match[1]);
		for (const candidate of [base, `${base}.js`, join(base, 'index.js')]) {
			if (statSync(candidate, { throwIfNoEntry: false })?.isFile()) {
				resolved = candidate;
				break;
			}
		}
	}
	cache.set(specifier, resolved);
	return resolved;
}

/**
 * `enforce: 'post'` lets Vite's own resolver (and the 'rolldown' condition,
 * which steers `#ui/*` to compiled dist/ output) go first; this only catches
 * what they cannot resolve.
 *
 * @type {import('vite').Plugin}
 */
export const uiComponentsResolver = {
	name: 'ui-components-resolver',
	enforce: 'post',
	resolveId(id) {
		return resolveUiFile(id);
	},
};

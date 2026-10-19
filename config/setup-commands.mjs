// @ts-check
// Virtual module carrying the setup guide's shell commands, highlighted at
// build time with the same Shiki setup the server uses for task and guide
// markdown (resources/shared/render.ts). The page imports
// 'virtual:cl-setup-commands' and receives plain HTML strings — Shiki never
// reaches the browser, and no per-request highlighting runs on the server.
import { SETUP_COMMANDS } from '../src/content/setupCommands.js';

const VIRTUAL_ID = 'virtual:cl-setup-commands';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** @type {Promise<string> | null} */
let modulePromise = null;

async function buildModule() {
	// Deferred import: the highlighter loads its grammars at module init, so
	// only builds that reach the setup page's chunk pay for it.
	const { highlightToHtml } = await import('../resources/shared/render.ts');
	/** @type {Record<string, { html: string; language: string; lines: number }>} */
	const commands = {};
	for (const [key, entry] of Object.entries(SETUP_COMMANDS)) {
		const { code, language = 'bash' } = entry;
		commands[key] = {
			html: highlightToHtml(code, language),
			language,
			lines: code.split('\n').length,
		};
	}
	return `export const COMMANDS = ${JSON.stringify(commands)};`;
}

/** @returns {import('vite').Plugin} */
export function setupCommandsPlugin() {
	return {
		name: 'cl-setup-commands',
		resolveId(id) {
			return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
		},
		load(id) {
			if (id !== RESOLVED_ID) return undefined;
			modulePromise ??= buildModule();
			return modulePromise;
		},
	};
}

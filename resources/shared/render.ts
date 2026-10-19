/**
 * Markdown + syntax highlighting, all server-side. Task descriptions and
 * guide bodies are rendered to segments when they are written (import,
 * create, edit) and stored on the record; the SSR entry uses the same
 * highlighter for the setup page's command blocks. The browser ships no
 * markdown or highlighting code.
 *
 * The highlighter is the Node.js website's own (@node-core/rehype-shiki),
 * with the grammars the content actually uses. Themes are the package
 * defaults (github-light + accessible nord); the package's index.css flips
 * to the dark palette under [data-theme='dark'].
 */
import createHighlighter from '@node-core/rehype-shiki';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';

// The package's stock setup: its full language roster and the JavaScript
// regex engine. Heavier than a hand-picked grammar list, but this only ever
// runs on the server, so weight is irrelevant.
export const { highlightToHtml } = await createHighlighter();

// No language inference: content authors label their fences (the curated
// data files all do). An unknown or missing language falls back to plain
// text inside the highlighter.
const marked = new Marked(
	markedHighlight({
		langPrefix: 'language-',
		highlight: (code: string, lang: string) => highlightToHtml(code, lang || 'text'),
	}),
);

// A rendered document is a list of segments: prose HTML chunks interleaved
// with highlighted code blocks. The client maps code segments straight onto
// the design system's CodeBox with no parsing of its own — every rendering
// decision is made here, server-side.
export type RenderedSegment = { html: string } | { code: string; language: string; lines: number };

const CODE_BLOCK = /<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>\n?/g;

export function renderMarkdown(source: string): RenderedSegment[] {
	if (!source) return [];
	const html = String(marked.parse(source, { async: false }));
	const segments: RenderedSegment[] = [];
	let cursor = 0;
	for (const match of html.matchAll(CODE_BLOCK)) {
		if (match.index! > cursor) segments.push({ html: html.slice(cursor, match.index) });
		const code = match[2]!;
		segments.push({
			code,
			language: match[1] || 'text',
			lines: (code.match(/class="line"/g) ?? []).length || 1,
		});
		cursor = match.index! + match[0]!.length;
	}
	if (cursor < html.length) segments.push({ html: html.slice(cursor) });
	return segments;
}

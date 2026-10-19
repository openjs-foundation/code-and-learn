import CommandBlock from './CommandBlock.jsx';

// Renders the segment list produced server-side by resources/shared/render.ts:
// prose HTML chunks interleaved with highlighted code blocks, the code blocks
// mounted in the design system's CodeBox. Content is admin-authored and
// rendered by our own server, so it's injected as-is — the browser makes no
// rendering (or sanitization) decisions of its own. `fallback` covers records
// written before server-side rendering existed.
export default function Markdown({ segments, fallback }) {
	if (Array.isArray(segments) && segments.length > 0) {
		return (
			<div className="cl-prose">
				{segments.map((segment, index) =>
					segment.code !== undefined ? (
						<CommandBlock
							// eslint-disable-next-line react-x/no-array-index-key -- static segments, never reordered
							key={index}
							html={segment.code}
							language={segment.language}
							// nodejs.org's markdown pipeline drops line numbers on short
							// snippets; the footer (with the copy button) stays — attendees
							// copy one-line verify commands constantly.
							className={segment.lines < 5 ? 'no-line-numbers' : undefined}
						/>
					) : (
						// eslint-disable-next-line react-dom/no-dangerously-set-innerhtml, react-x/no-array-index-key -- trusted server-rendered content; static segments
						<div key={index} dangerouslySetInnerHTML={{ __html: segment.html }} />
					),
				)}
			</div>
		);
	}
	if (fallback) {
		return (
			<div className="cl-prose" style={{ whiteSpace: 'pre-wrap' }}>
				{fallback}
			</div>
		);
	}
	return null;
}

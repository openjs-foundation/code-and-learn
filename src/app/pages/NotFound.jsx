export default function NotFound() {
	return (
		<div className="cl-container cl-narrow">
			<h1>There's nothing at this address.</h1>
			<p style={{ color: 'var(--cl-fg-soft)' }}>
				The page may have moved, or the link was mistyped.{' '}
				<a href="/">Head back to the task directory</a>. Everything starts there.
			</p>
		</div>
	);
}

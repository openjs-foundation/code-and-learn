import BaseCodeBox from '@node-core/ui-components/Common/BaseCodeBox';

// The design system's code box (line numbers + copy button). `html` is
// Shiki-highlighted output produced server-side — never from user input — so
// it needs no sanitization here; BaseCodeBox passes a non-string <code> child
// through untouched and Shiki provides the .line spans. The wrapper class
// gives the box its block rhythm inside prose.
export default function CommandBlock({ html, language = 'bash', className }) {
	return (
		<div className="cl-codebox">
			<BaseCodeBox
				language={language}
				className={className}
				copyButtonLabel="Copy"
				copiedButtonLabel="Copied"
			>
				{/* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml -- trusted build/server output */}
				<code dangerouslySetInnerHTML={{ __html: html }} />
			</BaseCodeBox>
		</div>
	);
}

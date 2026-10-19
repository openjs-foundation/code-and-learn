import * as TabsPrimitive from '@radix-ui/react-tabs';
import CodeTabs from '@node-core/ui-components/Common/CodeTabs';
import CommandBlock from './CommandBlock.jsx';

// Variant commands (Docker vs Podman, one distro's install vs another's) as
// the design system's CodeTabs — the same treatment nodejs.org gives its
// package-manager install snippets. `variants` come pre-highlighted from the
// server: [{ key, label, html, language, lines }].
export default function CommandTabs({ variants }) {
	if (!variants?.length) return null;
	return (
		<div className="cl-codebox">
			<CodeTabs
				tabs={variants.map(({ key, label }) => ({ key, label }))}
				defaultValue={variants[0].key}
			>
				{variants.map(({ key, html, language, lines }) => (
					<TabsPrimitive.Content key={key} value={key}>
						<CommandBlock
							html={html}
							language={language}
							className={lines < 5 ? 'no-line-numbers' : undefined}
						/>
					</TabsPrimitive.Content>
				))}
			</CodeTabs>
		</div>
	);
}

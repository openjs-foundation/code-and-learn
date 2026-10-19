import { useState } from 'react';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import AlertBox from '@node-core/ui-components/Common/AlertBox';
import { getJson, postJson } from '../../lib/api.js';
import { refreshTasks } from '../../lib/taskStore.js';

const IMPORT_EXAMPLE = `[
  {
    "title": "Fix a typo in the fs docs",
    "summary": "One-line description shown in the directory",
    "description": "Full **markdown** body with steps.",
    "difficulty": "beginner",
    "area": "docs",
    "skills": ["markdown"],
    "estimatedMinutes": 20,
    "links": [{ "label": "Contributing guide", "url": "https://github.com/nodejs/node/blob/main/CONTRIBUTING.md" }]
  }
]`;

export default function ImportTab() {
	const [text, setText] = useState('');
	const [result, setResult] = useState(null);
	const [busy, setBusy] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [parseError, setParseError] = useState(null);

	async function exportPool() {
		setExporting(true);
		setParseError(null);
		try {
			const data = await getJson('/api/admin/export');
			const blob = new Blob([JSON.stringify(data, null, '\t')], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `code-and-learn-export-${new Date().toISOString().slice(0, 10)}.json`;
			link.click();
			URL.revokeObjectURL(url);
		} catch {
			setParseError('Export failed. Check your connection and try again.');
		} finally {
			setExporting(false);
		}
	}

	return (
		<div style={{ maxWidth: '46rem' }}>
			<p style={{ color: 'var(--cl-fg-soft)' }}>
				Paste a JSON array of tasks (the format below), or the curated event files —{' '}
				<code>data/contribution-tasks.json</code> and <code>data/contribution-guides.json</code>{' '}
				each paste in as-is. Every imported task starts as open; tasks append and never touch
				existing ones, while guides upsert by theme so re-importing updates them.
			</p>
			<div className="cl-field">
				<label htmlFor="import-json">Tasks JSON</label>
				<textarea
					id="import-json"
					className="cl-input"
					rows={14}
					placeholder={IMPORT_EXAMPLE}
					value={text}
					onChange={(event) => setText(event.target.value)}
				/>
			</div>
			<div className="cl-actions">
				<BaseButton
					as="button"
					disabled={busy || !text.trim()}
					onClick={async () => {
						setParseError(null);
						setResult(null);
						let parsed;
						try {
							parsed = JSON.parse(text);
						} catch {
							setParseError('That is not valid JSON. Check for trailing commas or missing quotes.');
							return;
						}
						setBusy(true);
						try {
							setResult(await postJson('/api/admin/import', parsed));
							refreshTasks();
						} catch (error) {
							setParseError(error.body?.error || 'Import failed.');
						} finally {
							setBusy(false);
						}
					}}
				>
					{busy ? 'Importing…' : 'Import tasks'}
				</BaseButton>
				<button type="button" className="cl-btn-quiet" onClick={() => setText(IMPORT_EXAMPLE)}>
					Insert example
				</button>
				<button
					type="button"
					className="cl-btn-quiet"
					disabled={exporting}
					onClick={exportPool}
					style={{ marginLeft: 'auto' }}
				>
					{exporting ? 'Exporting…' : 'Export pool (tasks + guides)'}
				</button>
			</div>
			{parseError ? <p className="cl-error-text">{parseError}</p> : null}
			{result ? (
				<div style={{ marginTop: '1rem' }}>
					<AlertBox level={result.errors?.length ? 'warning' : 'success'} title="Imported">
						<strong>
							{result.created} task{result.created === 1 ? '' : 's'}
							{result.importedGuides
								? ` and ${result.importedGuides} guide${result.importedGuides === 1 ? '' : 's'}`
								: ''}
							.
						</strong>{' '}
						{result.errors?.length ? (
							<ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
								{result.errors.map((item) => (
									<li key={item.index}>
										Item {item.index + 1}
										{item.title ? ` (“${item.title}”)` : ''}: {item.problem}
									</li>
								))}
							</ul>
						) : (
							'All rows validated cleanly.'
						)}
					</AlertBox>
				</div>
			) : null}
		</div>
	);
}

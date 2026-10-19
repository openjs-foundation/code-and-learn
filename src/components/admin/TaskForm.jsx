import { useState } from 'react';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import Select from '@node-core/ui-components/Common/Select';

export const EMPTY_FORM = {
	title: '',
	summary: '',
	description: '',
	difficulty: 'beginner',
	area: '',
	theme: '',
	skills: '',
	estimatedMinutes: 30,
	links: '',
};

export function toForm(task) {
	return {
		title: task.title ?? '',
		summary: task.summary ?? '',
		description: task.description ?? '',
		difficulty: task.difficulty ?? 'beginner',
		area: task.area ?? '',
		theme: task.theme ?? '',
		skills: (task.skills ?? []).join(', '),
		estimatedMinutes: task.estimatedMinutes ?? 30,
		links: (task.links ?? []).map((link) => `${link.label} | ${link.url}`).join('\n'),
	};
}

function fromForm(form) {
	return {
		title: form.title,
		summary: form.summary,
		description: form.description,
		difficulty: form.difficulty,
		area: form.area,
		theme: form.theme.trim(),
		skills: form.skills
			.split(',')
			.map((skill) => skill.trim())
			.filter(Boolean),
		estimatedMinutes: Number(form.estimatedMinutes),
		links: form.links
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => {
				const [label, url] = line.includes('|') ? line.split('|', 2) : [line, line];
				return { label: label.trim(), url: url.trim() };
			}),
	};
}

// The create/edit task form. The area and theme inputs suggest from the
// cl-area-list / cl-theme-list datalists rendered by TasksTab.
export default function TaskForm({ initial, heading, submitLabel, onSubmit, onCancel, style }) {
	const [form, setForm] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	const set = (patch) => setForm((current) => ({ ...current, ...patch }));

	return (
		<form
			className="cl-panel"
			style={style ?? { marginTop: '1rem' }}
			onSubmit={async (event) => {
				event.preventDefault();
				setBusy(true);
				setError(null);
				try {
					await onSubmit(fromForm(form));
				} catch (submitError) {
					setError(submitError.body?.error || 'Saving failed.');
					setBusy(false);
					return;
				}
				setBusy(false);
			}}
		>
			<h2>{heading}</h2>
			<div className="cl-form-grid">
				<div className="cl-field cl-field--wide">
					<label htmlFor="tf-title">Title</label>
					<input
						id="tf-title"
						className="cl-input"
						required
						value={form.title}
						onChange={(e) => set({ title: e.target.value })}
					/>
				</div>
				<div className="cl-field cl-field--wide">
					<label htmlFor="tf-summary">Summary (one line, shown in the directory)</label>
					<input
						id="tf-summary"
						className="cl-input"
						value={form.summary}
						onChange={(e) => set({ summary: e.target.value })}
					/>
				</div>
				<div className="cl-field cl-field--wide">
					<label htmlFor="tf-description">Description (markdown)</label>
					<textarea
						id="tf-description"
						className="cl-input"
						rows={8}
						value={form.description}
						onChange={(e) => set({ description: e.target.value })}
					/>
				</div>
				<div className="cl-field">
					<span className="cl-field-label">Difficulty</span>
					<Select
						values={[
							{ label: 'Beginner', value: 'beginner' },
							{ label: 'Intermediate', value: 'intermediate' },
							{ label: 'Advanced', value: 'advanced' },
						]}
						value={form.difficulty}
						onChange={(value) => set({ difficulty: value })}
					/>
				</div>
				<div className="cl-field">
					<label htmlFor="tf-area">Area (e.g. docs, test, lib)</label>
					<input
						id="tf-area"
						className="cl-input"
						list="cl-area-list"
						required
						value={form.area}
						onChange={(e) => set({ area: e.target.value })}
					/>
				</div>
				<div className="cl-field">
					<label htmlFor="tf-theme">Theme (guide it links to, optional)</label>
					<input
						id="tf-theme"
						className="cl-input"
						list="cl-theme-list"
						placeholder="e.g. doc-deprecation"
						value={form.theme}
						onChange={(e) => set({ theme: e.target.value })}
					/>
				</div>
				<div className="cl-field">
					<label htmlFor="tf-minutes">Estimated minutes</label>
					<input
						id="tf-minutes"
						className="cl-input"
						type="number"
						min="1"
						max="480"
						required
						value={form.estimatedMinutes}
						onChange={(e) => set({ estimatedMinutes: e.target.value })}
					/>
				</div>
				<div className="cl-field">
					<label htmlFor="tf-skills">Skills (comma-separated)</label>
					<input
						id="tf-skills"
						className="cl-input"
						placeholder="javascript, markdown"
						value={form.skills}
						onChange={(e) => set({ skills: e.target.value })}
					/>
				</div>
				<div className="cl-field cl-field--wide">
					<label htmlFor="tf-links">Links (one per line: label | url)</label>
					<textarea
						id="tf-links"
						className="cl-input"
						rows={3}
						placeholder="Contributing guide | https://github.com/nodejs/node/blob/main/CONTRIBUTING.md"
						value={form.links}
						onChange={(e) => set({ links: e.target.value })}
					/>
				</div>
			</div>
			{error ? <p className="cl-error-text">{error}</p> : null}
			<div className="cl-actions">
				<BaseButton as="button" type="submit" disabled={busy}>
					{busy ? 'Saving…' : submitLabel}
				</BaseButton>
				{onCancel ? (
					<button type="button" className="cl-btn-quiet" onClick={onCancel}>
						Cancel
					</button>
				) : null}
			</div>
		</form>
	);
}

import { useEffect, useState } from 'react';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import AlertBox from '@node-core/ui-components/Common/AlertBox';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import Select from '@node-core/ui-components/Common/Select';
import Switch from '@node-core/ui-components/Common/Switch';
import { getJson, postJson } from '../../lib/api.js';
import { refreshTasks } from '../../lib/taskStore.js';

const LEVEL_OPTIONS = [
	{ label: 'Info', value: 'info' },
	{ label: 'Success', value: 'success' },
	{ label: 'Warning', value: 'warning' },
	{ label: 'Danger', value: 'danger' },
];

const POOL_OPTIONS = [
	{ label: 'Open — attendees can claim', value: 'open' },
	{ label: 'Paused — pool visible, claiming closed', value: 'paused' },
	{ label: 'Hidden — attendees see no tasks at all', value: 'hidden' },
];

const POOL_NOTICE = {
	open: 'The pool is open — claiming is live.',
	paused: 'Claiming is paused.',
	hidden: 'The pool is hidden. Attendees see no tasks until you open it.',
};

const DANGER_ACTIONS = [
	{
		scope: 'claims',
		phrase: 'RELEASE',
		label: 'Release every claim',
		detail: 'Every in-progress task returns to open. Completed work is untouched.',
	},
	{
		scope: 'progress',
		phrase: 'RESET',
		label: 'Reset all progress',
		detail: 'Every task returns to open, with assignments, completions, and flags cleared.',
	},
	{
		scope: 'wipe',
		phrase: 'WIPE',
		label: 'Delete every task and guide',
		detail: 'Empties the pool completely. Participants and admins stay.',
	},
];

// Live event controls: the site announcement, the claim pause, and the
// danger-zone resets. Everything takes effect on save — no restart, ever.
export default function EventTab() {
	const [announcement, setAnnouncement] = useState(null);
	const [claims, setClaims] = useState(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	const [notice, setNotice] = useState(null);
	const [armed, setArmed] = useState(null); // danger scope awaiting typed confirm
	const [confirmText, setConfirmText] = useState('');

	useEffect(() => {
		getJson('/api/settings')
			.then((data) => {
				setAnnouncement(data.announcement);
				setClaims(data.claims);
			})
			.catch(() => setError('Could not load event settings.'));
	}, []);

	if (!announcement || !claims) {
		return (
			<Skeleton loading>
				<div style={{ height: '10rem' }} />
			</Skeleton>
		);
	}

	async function saveSettings(patch, message) {
		setBusy(true);
		setError(null);
		try {
			const result = await postJson('/api/admin/settings', patch);
			setAnnouncement(result.announcement);
			setClaims(result.claims);
			setNotice(message);
		} catch (saveError) {
			setError(saveError.body?.error || 'Saving failed.');
		} finally {
			setBusy(false);
		}
	}

	async function runDanger(entry) {
		if (confirmText.trim().toUpperCase() !== entry.phrase) {
			setError(`Type ${entry.phrase} to confirm.`);
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const result = await postJson('/api/admin/reset', { scope: entry.scope, confirm: true });
			refreshTasks();
			setArmed(null);
			setConfirmText('');
			const count = result.released ?? result.reopened ?? result.tasks ?? 0;
			setNotice(`${entry.label}: done (${count} task${count === 1 ? '' : 's'}).`);
		} catch {
			setError('That did not work. Try again.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<div style={{ maxWidth: '46rem' }}>
			<p style={{ color: 'var(--cl-fg-soft)' }}>
				Everything on this tab takes effect the moment you save it, even while the event is running.
			</p>
			{notice ? <p style={{ fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>{notice}</p> : null}
			{error ? <p className="cl-error-text">{error}</p> : null}

			<form
				className="cl-panel"
				style={{ marginBottom: '1rem' }}
				onSubmit={(event) => {
					event.preventDefault();
					saveSettings({ announcement }, 'Announcement saved. Visitors see it on their next page.');
				}}
			>
				<h2>Site announcement</h2>
				<p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>
					The banner at the top of every page.
				</p>
				<div className="cl-field" style={{ marginBottom: '0.75rem' }}>
					<Switch
						id="ev-announce-on"
						label="Show the announcement"
						checked={announcement.enabled}
						onChange={(event) =>
							setAnnouncement({ ...announcement, enabled: event.target.checked })
						}
					/>
				</div>
				<div className="cl-form-grid">
					<div className="cl-field">
						<span className="cl-field-label">Tone</span>
						<Select
							values={LEVEL_OPTIONS}
							value={announcement.level}
							onChange={(value) => setAnnouncement({ ...announcement, level: value })}
						/>
					</div>
					<div className="cl-field cl-field--wide">
						<label htmlFor="ev-announce-title">Title</label>
						<input
							id="ev-announce-title"
							className="cl-input"
							value={announcement.title}
							onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })}
						/>
					</div>
					<div className="cl-field cl-field--wide">
						<label htmlFor="ev-announce-body">Message</label>
						<textarea
							id="ev-announce-body"
							className="cl-input"
							rows={3}
							value={announcement.body}
							onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })}
						/>
					</div>
				</div>
				{announcement.enabled && announcement.title ? (
					<div style={{ margin: '0.75rem 0 0' }} aria-label="Announcement preview">
						<AlertBox level={announcement.level} size="small" title={announcement.title}>
							<p style={{ margin: 0, whiteSpace: 'pre-line' }}>{announcement.body}</p>
						</AlertBox>
					</div>
				) : null}
				<div className="cl-actions">
					<BaseButton as="button" type="submit" size="small" disabled={busy}>
						Save announcement
					</BaseButton>
				</div>
			</form>

			<form
				className="cl-panel"
				style={{ marginBottom: '1rem' }}
				onSubmit={(event) => {
					event.preventDefault();
					const mode = claims.hidden ? 'hidden' : claims.paused ? 'paused' : 'open';
					saveSettings({ claims }, POOL_NOTICE[mode]);
				}}
			>
				<h2>Pool</h2>
				<p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>
					Pause claiming while you have the room's attention, or keep the whole pool hidden until
					the event starts. Admins keep full access either way, including handing out tasks.
				</p>
				<div className="cl-field" style={{ marginBottom: '0.75rem' }}>
					<span className="cl-field-label">State</span>
					<Select
						values={POOL_OPTIONS}
						value={claims.hidden ? 'hidden' : claims.paused ? 'paused' : 'open'}
						onChange={(value) =>
							setClaims({ ...claims, paused: value === 'paused', hidden: value === 'hidden' })
						}
					/>
				</div>
				<div className="cl-field">
					<label htmlFor="ev-claims-message">
						Message shown to attendees while paused or hidden
					</label>
					<input
						id="ev-claims-message"
						className="cl-input"
						placeholder="Claiming opens after the intro."
						value={claims.message}
						onChange={(event) => setClaims({ ...claims, message: event.target.value })}
					/>
				</div>
				<div className="cl-actions">
					<BaseButton as="button" type="submit" size="small" disabled={busy}>
						Save pool state
					</BaseButton>
				</div>
			</form>

			<section className="cl-panel" aria-label="Danger zone">
				<h2 style={{ color: 'var(--color-danger-600, #de1a1b)' }}>Danger zone</h2>
				<p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>
					Big levers for event turnover. Each one asks you to type its word first.
				</p>
				{DANGER_ACTIONS.map((entry) => (
					<div key={entry.scope} className="cl-danger-row">
						<div>
							<strong style={{ fontSize: '0.9375rem' }}>{entry.label}</strong>
							<p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--cl-fg-faint)' }}>
								{entry.detail}
							</p>
						</div>
						{armed === entry.scope ? (
							<span className="cl-assign-form">
								<input
									className="cl-input"
									placeholder={`type ${entry.phrase}`}
									value={confirmText}
									onChange={(event) => setConfirmText(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter') runDanger(entry);
										if (event.key === 'Escape') setArmed(null);
									}}
									autoFocus
								/>
								<button
									type="button"
									className="cl-btn-quiet cl-btn-quiet--danger"
									disabled={busy}
									onClick={() => runDanger(entry)}
								>
									Confirm
								</button>
								<button
									type="button"
									className="cl-btn-quiet"
									onClick={() => {
										setArmed(null);
										setConfirmText('');
									}}
								>
									Cancel
								</button>
							</span>
						) : (
							<button
								type="button"
								className="cl-btn-quiet cl-btn-quiet--danger"
								onClick={() => {
									setArmed(entry.scope);
									setConfirmText('');
									setError(null);
								}}
							>
								{entry.label}…
							</button>
						)}
					</div>
				))}
			</section>
		</div>
	);
}

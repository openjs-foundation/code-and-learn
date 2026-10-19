import { useEffect, useState } from 'react';
import Badge from '@node-core/ui-components/Common/Badge';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import AlertBox from '@node-core/ui-components/Common/AlertBox';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import GitHub from '@node-core/ui-components/Icons/Social/GitHub';
import { getJson, postJson, signInHref } from '../lib/api.js';
import { useGuides } from '../lib/guides.js';
import Markdown from './Markdown.jsx';

const DIFFICULTY_BADGE = { beginner: 'default', intermediate: 'warning', advanced: 'error' };

function formatWhen(timestamp) {
	if (!timestamp) return '';
	return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function MyTask() {
	const guides = useGuides();
	const [me, setMe] = useState(undefined);
	const [evidenceUrl, setEvidenceUrl] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	const [confirmingRelease, setConfirmingRelease] = useState(false);
	const [justCompleted, setJustCompleted] = useState(null);
	const [reporting, setReporting] = useState(false);
	const [reportReason, setReportReason] = useState('');
	const [justReported, setJustReported] = useState(false);

	async function load() {
		try {
			setMe(await getJson('/api/me'));
		} catch {
			setMe({ user: null, activeTask: null, completed: [] });
		}
	}

	useEffect(() => {
		load();
	}, []);

	if (me === undefined) {
		return (
			<Skeleton loading>
				<div style={{ height: '12rem' }} />
			</Skeleton>
		);
	}

	if (!me.user) {
		return (
			<div>
				<p style={{ color: 'var(--cl-fg-soft)', maxWidth: '52ch' }}>
					Your claimed task and your finished contributions live here. Sign in with the GitHub
					account you will open your pull request from to get started.
				</p>
				<BaseButton as="a" href={signInHref()}>
					<GitHub width={16} height={16} aria-hidden="true" />
					Sign in with GitHub
				</BaseButton>
			</div>
		);
	}

	const active = me.activeTask;

	async function release() {
		setBusy(true);
		setError(null);
		try {
			await postJson('/api/release');
			setConfirmingRelease(false);
			setEvidenceUrl('');
			await load();
		} catch {
			setError('Releasing failed. Try again, or ask a mentor.');
		} finally {
			setBusy(false);
		}
	}

	async function reportUncompletable(event) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await postJson('/api/uncompletable', { reason: reportReason });
			setReporting(false);
			setReportReason('');
			setJustReported(true);
			await load();
		} catch (submitError) {
			if (submitError.body?.error === 'reason_required') {
				setError('Say what makes this task impossible to complete, so an organizer can verify it.');
			} else {
				setError('Reporting failed. Try again, or wave down a mentor.');
			}
		} finally {
			setBusy(false);
		}
	}

	async function complete(event) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const result = await postJson('/api/complete', { evidenceUrl });
			setJustCompleted(result?.task ?? null);
			setEvidenceUrl('');
			await load();
		} catch (submitError) {
			if (submitError.body?.error === 'evidence_url_required') {
				setError('That does not look like a link. Paste the full URL of your open pull request.');
			} else {
				setError('Submitting failed. Try again, or ask a mentor.');
			}
		} finally {
			setBusy(false);
		}
	}

	const restriction = me.user.restriction;

	return (
		<div>
			{restriction ? (
				<div style={{ marginBottom: '1.25rem' }}>
					<AlertBox level="danger" title={restriction.kind === 'timeout' ? 'Timeout' : 'Banned'}>
						<strong>
							{restriction.kind === 'timeout'
								? `Your account is paused until ${formatWhen(restriction.until)}.`
								: 'Your account cannot claim or complete tasks.'}
						</strong>{' '}
						{restriction.reason ? `Reason: ${restriction.reason}. ` : ''}
						Talk to an organizer if this seems wrong.
					</AlertBox>
				</div>
			) : null}

			{justReported ? (
				<div style={{ marginBottom: '1.25rem' }}>
					<AlertBox level="info" title="Reported">
						<strong>Thanks for the report.</strong> An organizer will review it. The pool is open
						for you again: <a href="/">claim another task</a>.
					</AlertBox>
				</div>
			) : null}

			{justCompleted ? (
				<div style={{ marginBottom: '1.25rem' }}>
					<AlertBox level="success" title="Shipped">
						<strong>Contribution submitted. Nice work!</strong> “{justCompleted.title}” is done. The
						pool is open again: <a href="/">claim your next task</a>.
					</AlertBox>
				</div>
			) : null}

			{active ? (
				<section className="cl-panel" aria-label="Your current task">
					<p style={{ margin: '0 0 0.25rem', fontSize: '0.8125rem', color: 'var(--cl-fg-faint)' }}>
						Claimed at {formatWhen(active.assignedAt)}
					</p>
					<h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>
						<a href={`/tasks/${active.id}`}>{active.title}</a>
					</h2>
					<p style={{ margin: '0 0 0.75rem', color: 'var(--cl-fg-soft)' }}>{active.summary}</p>
					<p
						style={{
							margin: '0 0 1.25rem',
							display: 'flex',
							gap: '0.5rem',
							flexWrap: 'wrap',
							alignItems: 'center',
						}}
					>
						<Badge size="small" kind={DIFFICULTY_BADGE[active.difficulty] ?? 'neutral'}>
							{active.difficulty}
						</Badge>
						{active.area ? <span className="cl-chip">{active.area}</span> : null}
						{active.estimatedMinutes ? (
							<span className="cl-time">~{active.estimatedMinutes} min</span>
						) : null}
					</p>

					{active.theme && guides?.[active.theme] ? (
						<details className="cl-mytask-guide">
							<summary>How-to: {guides[active.theme].title}</summary>
							<Markdown
								segments={guides[active.theme].bodyRendered}
								fallback={guides[active.theme].body}
							/>
						</details>
					) : null}

					<form onSubmit={complete}>
						<label
							htmlFor="cl-evidence"
							style={{
								display: 'block',
								fontWeight: 600,
								fontSize: '0.9375rem',
								marginBottom: '0.375rem',
							}}
						>
							Done? Paste the link to your work
						</label>
						<div className="cl-form-row">
							<input
								id="cl-evidence"
								className="cl-input"
								type="url"
								required
								placeholder="https://github.com/nodejs/node/pull/…"
								value={evidenceUrl}
								onChange={(event) => setEvidenceUrl(event.target.value)}
							/>
							<BaseButton as="button" type="submit" disabled={busy}>
								{busy ? 'Submitting…' : 'Mark completed'}
							</BaseButton>
						</div>
						<p className="cl-hint">
							Usually your open pull request. An issue or gist works too if the task says so.
						</p>
						{error ? <p className="cl-error-text">{error}</p> : null}
					</form>

					<div className="cl-actions">
						{confirmingRelease ? (
							<>
								<span style={{ fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>
									Put it back in the pool for someone else?
								</span>
								<BaseButton
									as="button"
									kind="warning"
									size="small"
									onClick={release}
									disabled={busy}
								>
									Yes, release it
								</BaseButton>
								<button
									type="button"
									className="cl-btn-quiet"
									onClick={() => setConfirmingRelease(false)}
								>
									Keep working
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									className="cl-btn-quiet"
									onClick={() => setConfirmingRelease(true)}
								>
									Not the right task? Release it
								</button>
								<button
									type="button"
									className="cl-btn-quiet"
									onClick={() => setReporting((value) => !value)}
								>
									Impossible to complete? Report it
								</button>
							</>
						)}
					</div>

					{reporting ? (
						<form onSubmit={reportUncompletable} style={{ marginTop: '1rem' }}>
							<label
								htmlFor="cl-report-reason"
								style={{
									display: 'block',
									fontWeight: 600,
									fontSize: '0.9375rem',
									marginBottom: '0.375rem',
								}}
							>
								What makes this task impossible?
							</label>
							<textarea
								id="cl-report-reason"
								className="cl-input"
								rows={3}
								required
								placeholder="For example: the pattern was already fixed in a recent commit."
								value={reportReason}
								onChange={(event) => setReportReason(event.target.value)}
							/>
							<p className="cl-hint">
								The task leaves the pool while an organizer verifies your report, and you can claim
								another right away.
							</p>
							<div className="cl-actions">
								<BaseButton as="button" type="submit" size="small" disabled={busy}>
									{busy ? 'Reporting…' : 'Report it uncompletable'}
								</BaseButton>
								<button type="button" className="cl-btn-quiet" onClick={() => setReporting(false)}>
									Cancel
								</button>
							</div>
						</form>
					) : null}
				</section>
			) : (
				<section className="cl-panel" aria-label="No current task">
					<h2 style={{ margin: '0 0 0.375rem', fontSize: '1.125rem' }}>
						No task claimed right now.
					</h2>
					<p style={{ margin: '0 0 1rem', color: 'var(--cl-fg-soft)' }}>
						Browse the pool, filter to what fits you, and claim one. It locks to you while you work.
					</p>
					<BaseButton as="a" href="/">
						Find a task
					</BaseButton>
				</section>
			)}

			<section style={{ marginTop: '2.5rem' }} aria-label="Your completed tasks">
				<h2 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem' }}>Completed</h2>
				{me.completed.length === 0 ? (
					<p style={{ color: 'var(--cl-fg-soft)', margin: 0 }}>
						Nothing yet. Finished contributions will stack up here.
					</p>
				) : (
					<ul className="cl-history">
						{me.completed.map((task) => (
							<li key={task.id}>
								<a href={`/tasks/${task.id}`}>{task.title}</a>
								{task.evidenceUrl ? (
									<a
										href={task.evidenceUrl}
										target="_blank"
										rel="noreferrer"
										style={{ fontSize: '0.8125rem' }}
									>
										view work
									</a>
								) : null}
								<span className="cl-time">{formatWhen(task.completedAt)}</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

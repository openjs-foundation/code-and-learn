import { useEffect, useMemo, useState } from 'react';
import Badge from '@node-core/ui-components/Common/Badge';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import AlertBox from '@node-core/ui-components/Common/AlertBox';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import GitHub from '@node-core/ui-components/Icons/Social/GitHub';
import { getJson, postJson, signInHref } from '../lib/api.js';
import { useTasks, refreshTasks } from '../lib/taskStore.js';
import { useGuides } from '../lib/guides.js';
import Markdown from './Markdown.jsx';

const DIFFICULTY_BADGE = { beginner: 'default', intermediate: 'warning', advanced: 'error' };

function taskIdFromLocation() {
	const match = location.pathname.match(/^\/tasks\/([^/]+)\/?$/);
	if (match) return decodeURIComponent(match[1]);
	return new URLSearchParams(location.search).get('id');
}

function titleCase(value) {
	return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

// Curated tasks derive their summary from the description's first sentence;
// showing both reads as a stutter, so the lede stands down when the
// description opens with the same words.
function descriptionRepeats(task) {
	if (!task.summary || !task.description) return false;
	const plain = task.description.replace(/`/g, '');
	return plain.startsWith(task.summary.slice(0, 60));
}

export default function TaskPage() {
	const { tasks } = useTasks();
	const guides = useGuides();
	const [taskId, setTaskId] = useState(null);
	// The single-record fetch carries the full task (rendered description
	// included); the live list keeps status fresh but carries no rendered
	// content, so the two are merged. undefined = loading, null = not found.
	const [detail, setDetail] = useState(undefined);
	const [me, setMe] = useState(undefined);
	const [claims, setClaims] = useState(null);
	const [claiming, setClaiming] = useState(false);
	const [claimError, setClaimError] = useState(null);

	useEffect(() => {
		const id = taskIdFromLocation();
		setTaskId(id);
		if (id) {
			getJson(`/api/tasks/${encodeURIComponent(id)}`)
				.then(setDetail)
				.catch(() => setDetail(null));
		} else {
			setDetail(null);
		}
		getJson('/api/me')
			.then(setMe)
			.catch(() => setMe({ user: null, activeTask: null, completed: [] }));
		getJson('/api/settings')
			.then((data) => setClaims(data.claims))
			.catch(() => {});
	}, []);

	const live = useMemo(
		() => (tasks ?? []).find((candidate) => String(candidate.id) === String(taskId)) ?? null,
		[tasks, taskId],
	);
	const task = detail ? { ...detail, ...(live ?? {}) } : live;

	if (!task) {
		// While the pool is hidden, non-admin task reads come back empty — say
		// that, rather than pretending the task was removed. (Waits for /api/me
		// so a signed-in admin never flashes it while their task loads.)
		if (claims?.hidden && me !== undefined && !me?.user?.isAdmin) {
			return (
				<div className="cl-narrow" style={{ paddingLeft: 0, paddingRight: 0 }}>
					<AlertBox level="info" title="Not yet">
						<strong>{claims.message || 'The task pool opens when the event starts.'}</strong>{' '}
						<a href="/">Back to the directory.</a>
					</AlertBox>
				</div>
			);
		}
		if (detail === null && !live) {
			return (
				<div className="cl-narrow" style={{ paddingLeft: 0, paddingRight: 0 }}>
					<AlertBox level="warning" title="Gone">
						<strong>This task does not exist anymore.</strong> It may have been removed by an
						organizer. <a href="/">Back to the directory.</a>
					</AlertBox>
				</div>
			);
		}
		return (
			<div className="cl-task-page">
				<div>
					<Skeleton loading>
						<div style={{ height: '14rem' }} />
					</Skeleton>
				</div>
				<div />
			</div>
		);
	}

	const signedIn = Boolean(me?.user);
	const mine = signedIn && task.assignedTo === me.user.login;
	const hasActive = Boolean(me?.activeTask);
	// Admins claim through the pause (they are the ones running it). A hidden
	// pool is closed for claiming too.
	const paused = Boolean(claims?.paused || claims?.hidden) && !me?.user?.isAdmin;

	async function claim() {
		setClaiming(true);
		setClaimError(null);
		try {
			await postJson('/api/claim', { taskId: task.id });
			location.assign('/me');
		} catch (error) {
			refreshTasks();
			const code = error.body?.error;
			if (code === 'already_claimed') {
				setClaimError(
					<>
						You already have a task in progress. Finish or release it from{' '}
						<a href="/me">your task page</a> first.
					</>,
				);
			} else if (code === 'task_unavailable') {
				setClaimError('Someone claimed this task moments ago. Pick another from the directory.');
			} else if (code === 'claims_paused') {
				setClaimError(
					error.body?.message || 'Claiming is paused right now. Watch for the go signal.',
				);
			} else if (error.body?.error === 'restricted') {
				setClaimError(
					error.body.kind === 'timeout'
						? 'Your account is in a timeout right now. Talk to an organizer if that seems wrong.'
						: 'Your account cannot claim tasks right now. Talk to an organizer if that seems wrong.',
				);
			} else if (error.status === 401) {
				setClaimError(
					<>
						Your session expired. <a href={signInHref()}>Sign in again</a> to claim.
					</>,
				);
			} else {
				setClaimError('Claiming failed. Check your connection and try again.');
			}
			setClaiming(false);
		}
	}

	return (
		<div className="cl-task-page">
			<article>
				<a href="/" style={{ fontSize: '0.875rem' }}>
					← All tasks
				</a>
				<h1>{task.title}</h1>
				{task.summary && !descriptionRepeats(task) ? (
					<p className="cl-lede" style={{ color: 'var(--cl-fg-soft)', maxWidth: '62ch' }}>
						{task.summary}
					</p>
				) : null}
				<Markdown segments={task.descriptionRendered} fallback={task.description} />
				{task.theme && guides?.[task.theme] ? (
					<section className="cl-guide" aria-label="How-to guide for this task type">
						<h2 style={{ fontSize: '1.0625rem', margin: '1.75rem 0 0.5rem' }}>
							How-to: {guides[task.theme].title}
						</h2>
						{guides[task.theme].summary ? (
							<p style={{ color: 'var(--cl-fg-soft)', margin: '0 0 0.5rem' }}>
								{guides[task.theme].summary}
							</p>
						) : null}
						<Markdown
							segments={guides[task.theme].bodyRendered}
							fallback={guides[task.theme].body}
						/>
					</section>
				) : null}
				{Array.isArray(task.links) && task.links.length > 0 ? (
					<section>
						<h2 style={{ fontSize: '1.0625rem', margin: '1.75rem 0 0.5rem' }}>Useful links</h2>
						<ul>
							{task.links.map((link) => (
								<li key={link.url}>
									<a href={link.url} target="_blank" rel="noreferrer">
										{link.label}
									</a>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</article>

			<aside className="cl-task-aside" aria-label="Task status and actions">
				<div className="cl-panel">
					<h2>About this task</h2>
					<dl className="cl-facts">
						<dt>Difficulty</dt>
						<dd>
							<Badge size="small" kind={DIFFICULTY_BADGE[task.difficulty] ?? 'neutral'}>
								{titleCase(task.difficulty)}
							</Badge>
						</dd>
						<dt>Area</dt>
						<dd>{task.area ? <span className="cl-chip">{task.area}</span> : '—'}</dd>
						<dt>Skills</dt>
						<dd>
							{(task.skills ?? []).length
								? task.skills.map((skill) => (
										<span key={skill} className="cl-chip" style={{ marginRight: '0.25rem' }}>
											{skill}
										</span>
									))
								: '—'}
						</dd>
						<dt>Time</dt>
						<dd className="cl-time">
							{task.estimatedMinutes ? `~${task.estimatedMinutes} min` : '—'}
						</dd>
					</dl>
				</div>

				<div className="cl-panel">
					{me === undefined ? (
						<Skeleton loading>
							<div style={{ height: '6rem' }} />
						</Skeleton>
					) : task.status === 'available' ? (
						paused ? (
							<>
								<AlertBox level="info" size="small" title="Paused">
									<strong>{claims?.message || 'Claiming is paused right now.'}</strong> This task
									stays open until claiming resumes.
								</AlertBox>
								{!signedIn ? (
									<div style={{ marginTop: '0.75rem' }}>
										<BaseButton as="a" href={signInHref()}>
											<GitHub width={16} height={16} aria-hidden="true" />
											Sign in to be ready
										</BaseButton>
									</div>
								) : null}
							</>
						) : !signedIn ? (
							<>
								<h2>Want this one?</h2>
								<p
									style={{
										margin: '0 0 0.75rem',
										fontSize: '0.875rem',
										color: 'var(--cl-fg-soft)',
									}}
								>
									Sign in with GitHub to claim it. You will open your pull request from that account
									anyway.
								</p>
								<BaseButton as="a" href={signInHref()}>
									<GitHub width={16} height={16} aria-hidden="true" />
									Sign in to claim
								</BaseButton>
							</>
						) : hasActive ? (
							<AlertBox level="info" size="small" title="Easy now">
								<strong>One task at a time.</strong> Finish or release{' '}
								<a href="/me">your current task</a> before claiming this one.
							</AlertBox>
						) : (
							<>
								<h2>This one is open.</h2>
								<p
									style={{
										margin: '0 0 0.75rem',
										fontSize: '0.875rem',
										color: 'var(--cl-fg-soft)',
									}}
								>
									Claiming locks it to you, one task per person at a time. If it doesn't fit, you
									can release it.
								</p>
								<BaseButton as="button" onClick={claim} disabled={claiming}>
									{claiming ? 'Claiming…' : 'Claim this task'}
								</BaseButton>
								{claimError ? <p className="cl-error-text">{claimError}</p> : null}
								{me?.user?.isAdmin && (claims?.hidden || claims?.paused) ? (
									<p
										style={{
											margin: '0.5rem 0 0',
											fontSize: '0.8125rem',
											color: 'var(--cl-fg-faint)',
										}}
									>
										{claims.hidden
											? 'Admin view — participants cannot see this task until the pool opens.'
											: 'For participants, claiming is paused.'}
									</p>
								) : null}
							</>
						)
					) : task.status === 'claimed' ? (
						mine ? (
							<AlertBox level="success" size="small" title="Yours">
								<strong>This task is yours.</strong> Work it, then submit your PR link from{' '}
								<a href="/me">your task page</a>.
							</AlertBox>
						) : (
							<AlertBox level="info" size="small" title="Taken">
								<strong>{task.assignedName || 'Someone'} is on it.</strong> If they release it, it
								goes back to open, so keep an eye on the directory.
							</AlertBox>
						)
					) : task.status === 'completed' ? (
						<AlertBox level="neutral" size="small" title="Done">
							<strong>This task has been completed.</strong>{' '}
							{task.evidenceUrl ? (
								<a href={task.evidenceUrl} target="_blank" rel="noreferrer">
									See the contribution.
								</a>
							) : null}
						</AlertBox>
					) : task.status === 'flagged' ? (
						<AlertBox level="warning" size="small" title="In review">
							<strong>A participant reported this task as uncompletable.</strong> It is out of the
							pool while an organizer reviews the report.
						</AlertBox>
					) : (
						<AlertBox level="neutral" size="small" title="Removed">
							<strong>This task cannot be completed</strong> and has been removed from the pool.{' '}
							<a href="/">Pick another from the directory.</a>
						</AlertBox>
					)}
				</div>
			</aside>
		</div>
	);
}

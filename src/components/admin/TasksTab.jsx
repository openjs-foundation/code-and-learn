import { Fragment, useEffect, useMemo, useState } from 'react';
import Badge from '@node-core/ui-components/Common/Badge';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import AlertBox from '@node-core/ui-components/Common/AlertBox';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import { getJson, postJson, putJson, deleteJson } from '../../lib/api.js';
import { useTasks, refreshTasks } from '../../lib/taskStore.js';
import TaskForm, { EMPTY_FORM, toForm } from './TaskForm.jsx';
import {
	DIFFICULTY_BADGE,
	STATUS_TEXT,
	titleCase,
	useParticipants,
	ParticipantDatalist,
} from './shared.jsx';

const STATUS_FILTERS = [
	{ key: 'all', label: 'All' },
	{ key: 'available', label: 'Open' },
	{ key: 'claimed', label: 'In progress' },
	{ key: 'completed', label: 'Done' },
	{ key: 'flagged', label: 'In review' },
	{ key: 'uncompletable', label: 'Removed' },
];

export default function TasksTab() {
	const { tasks, status } = useTasks();
	const participants = useParticipants();
	const [themes, setThemes] = useState([]);
	const [mode, setMode] = useState(null); // null | 'create' | { edit: task }
	const [pendingDelete, setPendingDelete] = useState(null);
	const [assigning, setAssigning] = useState(null); // task id with the assign form open
	const [assignLogin, setAssignLogin] = useState('');
	const [completing, setCompleting] = useState(null); // task id with the done form open
	const [completeUrl, setCompleteUrl] = useState('');
	const [completeCredit, setCompleteCredit] = useState('');
	const [filter, setFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [notice, setNotice] = useState(null);

	useEffect(() => {
		getJson('/api/guides')
			.then((data) => setThemes(Object.keys(data.guides ?? {}).sort()))
			.catch(() => {});
	}, []);

	async function act(action, doneNotice) {
		try {
			await action();
			refreshTasks();
			if (doneNotice) setNotice(doneNotice);
		} catch (error) {
			setNotice(error.body?.hint || error.body?.error || 'That did not work. Try again.');
		}
	}

	async function assign(task, force = false) {
		const login = assignLogin.trim().toLowerCase();
		if (!login) return;
		try {
			await postJson('/api/admin/assign', { taskId: task.id, login, force });
			refreshTasks();
			setAssigning(null);
			setAssignLogin('');
			setNotice(`Assigned “${task.title}” to ${login}.`);
		} catch (error) {
			if (error.body?.error === 'assignee_busy') {
				const holding = error.body.task?.title ? ` (“${error.body.task.title}”)` : '';
				const release = confirm(
					`${login} already holds a task${holding}. Release it and assign this one instead?`,
				);
				if (release) return assign(task, true);
			} else {
				setNotice(error.body?.hint || error.body?.error || 'Assigning failed. Try again.');
			}
		}
	}

	// Mark done / edit result with optional evidence link and credit. Keeps the
	// form open on a bad URL so the admin can fix it in place.
	async function completeWithDetails(task) {
		try {
			await postJson('/api/admin/status', {
				taskId: task.id,
				status: 'completed',
				evidenceUrl: completeUrl.trim() || null,
				completedBy: completeCredit.trim().toLowerCase() || null,
			});
			refreshTasks();
			setCompleting(null);
			setNotice(
				task.status === 'completed' ? `Updated “${task.title}”.` : `Marked “${task.title}” done.`,
			);
		} catch (error) {
			setNotice(
				error.body?.error === 'evidence_url_invalid'
					? 'That evidence link is not a valid URL.'
					: error.body?.hint || error.body?.error || 'That did not work. Try again.',
			);
		}
	}

	function openCompleteForm(task) {
		setCompleting(task.id);
		setCompleteUrl(task.evidenceUrl ?? '');
		setCompleteCredit(
			task.status === 'completed' ? (task.completedBy ?? '') : (task.assignedTo ?? ''),
		);
		setAssigning(null);
	}

	const sorted = useMemo(
		() => [...(tasks ?? [])].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
		[tasks],
	);

	const areas = useMemo(
		() => [...new Set(sorted.map((task) => task.area).filter(Boolean))].sort(),
		[sorted],
	);

	const statusCounts = useMemo(() => {
		const counts = { all: sorted.length };
		for (const task of sorted) counts[task.status] = (counts[task.status] ?? 0) + 1;
		return counts;
	}, [sorted]);

	const visible = useMemo(() => {
		const needle = filter.trim().toLowerCase();
		return sorted.filter((task) => {
			if (statusFilter !== 'all' && task.status !== statusFilter) return false;
			if (!needle) return true;
			return [
				task.title,
				task.area,
				task.status,
				STATUS_TEXT[task.status],
				task.assignedTo,
				task.assignedName,
				task.completedBy,
				task.difficulty,
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
				.includes(needle);
		});
	}, [sorted, filter, statusFilter]);

	if (status !== 'ready') {
		return (
			<Skeleton loading>
				<div style={{ height: '10rem' }} />
			</Skeleton>
		);
	}

	return (
		<div>
			<ParticipantDatalist id="cl-participant-list" participants={participants} />
			<datalist id="cl-area-list">
				{areas.map((area) => (
					<option key={area} value={area} />
				))}
			</datalist>
			<datalist id="cl-theme-list">
				{themes.map((theme) => (
					<option key={theme} value={theme} />
				))}
			</datalist>

			<div className="cl-actions" style={{ margin: '1rem 0' }}>
				<BaseButton
					as="button"
					size="small"
					onClick={() => setMode(mode === 'create' ? null : 'create')}
				>
					New task
				</BaseButton>
				<input
					className="cl-input"
					type="search"
					placeholder="Filter by title, area, status, login…"
					aria-label="Filter the task table"
					value={filter}
					onChange={(event) => setFilter(event.target.value)}
					style={{ maxWidth: '18rem' }}
				/>
				{notice ? (
					<span style={{ fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>{notice}</span>
				) : null}
			</div>

			<div className="cl-status-chips" role="group" aria-label="Filter by status">
				{STATUS_FILTERS.map((entry) => (
					<button
						key={entry.key}
						type="button"
						className="cl-btn-quiet"
						aria-pressed={statusFilter === entry.key}
						onClick={() => setStatusFilter(entry.key)}
					>
						{entry.label} <strong>{statusCounts[entry.key] ?? 0}</strong>
					</button>
				))}
			</div>

			{mode === 'create' ? (
				<TaskForm
					initial={EMPTY_FORM}
					heading="New task"
					submitLabel="Create task"
					onCancel={() => setMode(null)}
					onSubmit={async (payload) => {
						await postJson('/api/admin/tasks', payload);
						refreshTasks();
						setMode(null);
						setNotice('Task created.');
					}}
				/>
			) : null}

			{sorted.length === 0 ? (
				<div style={{ marginTop: '1rem' }}>
					<AlertBox level="info" title="Empty">
						<strong>No tasks yet.</strong> Create one above, or bulk-import the curated list from
						the Import tab.
					</AlertBox>
				</div>
			) : (
				<div className="cl-table-wrap" style={{ marginTop: '0.5rem' }}>
					{/* data-cards="false" opts out of the library's stacked-cards table
					    layout on phones — these are data grids that scroll in the wrap. */}
					<table className="cl-table" data-cards="false">
						<thead>
							<tr>
								<th>Task</th>
								<th>Status</th>
								<th>Assignee</th>
								<th>Difficulty</th>
								<th>Area</th>
								<th>Time</th>
								<th aria-label="Actions" />
							</tr>
						</thead>
						<tbody>
							{visible.length === 0 ? (
								<tr>
									<td colSpan={7} style={{ color: 'var(--cl-fg-faint)' }}>
										Nothing matches that filter.
									</td>
								</tr>
							) : null}
							{visible.map((task) => (
								<Fragment key={task.id}>
									<tr>
										<td>
											<a href={`/tasks/${task.id}`}>{task.title}</a>
										</td>
										<td>
											<span className={`cl-status cl-status--${task.status}`}>
												{STATUS_TEXT[task.status] ?? task.status}
											</span>
										</td>
										<td>
											{task.status === 'claimed' ? (
												task.assignedName || task.assignedTo
											) : task.status === 'completed' ? (
												<>
													{task.completedBy}
													{task.evidenceUrl ? (
														<>
															{' '}
															<a href={task.evidenceUrl} target="_blank" rel="noreferrer">
																evidence
															</a>
														</>
													) : null}
												</>
											) : (
												'—'
											)}
										</td>
										<td>
											<Badge size="small" kind={DIFFICULTY_BADGE[task.difficulty] ?? 'neutral'}>
												{titleCase(task.difficulty)}
											</Badge>
										</td>
										<td>{task.area}</td>
										<td className="cl-time">
											{task.estimatedMinutes ? `${task.estimatedMinutes}m` : '—'}
										</td>
										<td>
											<div className="cl-table-actions">
												<button
													type="button"
													className="cl-btn-quiet"
													onClick={() =>
														setMode(mode?.edit?.id === task.id ? null : { edit: task })
													}
												>
													{mode?.edit?.id === task.id ? 'Close' : 'Edit'}
												</button>
												{task.status === 'available' || task.status === 'claimed' ? (
													assigning === task.id ? (
														<span className="cl-assign-form">
															<input
																className="cl-input"
																placeholder="github login"
																list="cl-participant-list"
																value={assignLogin}
																onChange={(event) => setAssignLogin(event.target.value)}
																onKeyDown={(event) => {
																	if (event.key === 'Enter') assign(task);
																	if (event.key === 'Escape') setAssigning(null);
																}}
																autoFocus
															/>
															<button
																type="button"
																className="cl-btn-quiet"
																onClick={() => assign(task)}
															>
																Assign
															</button>
															<button
																type="button"
																className="cl-btn-quiet"
																onClick={() => setAssigning(null)}
															>
																Cancel
															</button>
														</span>
													) : (
														<button
															type="button"
															className="cl-btn-quiet"
															onClick={() => {
																setAssigning(task.id);
																setAssignLogin('');
																setCompleting(null);
															}}
														>
															{task.status === 'claimed' ? 'Reassign…' : 'Assign…'}
														</button>
													)
												) : null}
												{task.status === 'claimed' ? (
													<button
														type="button"
														className="cl-btn-quiet"
														onClick={() =>
															act(
																() => postJson('/api/admin/unassign', { taskId: task.id }),
																`Unassigned “${task.title}”.`,
															)
														}
													>
														Unassign
													</button>
												) : null}
												{task.status === 'available' ||
												task.status === 'claimed' ||
												task.status === 'completed' ? (
													completing === task.id ? (
														<span className="cl-assign-form">
															<input
																className="cl-input"
																placeholder="evidence link (optional)"
																value={completeUrl}
																onChange={(event) => setCompleteUrl(event.target.value)}
																onKeyDown={(event) => {
																	if (event.key === 'Enter') completeWithDetails(task);
																	if (event.key === 'Escape') setCompleting(null);
																}}
																autoFocus
															/>
															<input
																className="cl-input"
																placeholder="credit login (optional)"
																list="cl-participant-list"
																value={completeCredit}
																onChange={(event) => setCompleteCredit(event.target.value)}
																onKeyDown={(event) => {
																	if (event.key === 'Enter') completeWithDetails(task);
																	if (event.key === 'Escape') setCompleting(null);
																}}
															/>
															<button
																type="button"
																className="cl-btn-quiet"
																onClick={() => completeWithDetails(task)}
															>
																{task.status === 'completed' ? 'Save' : 'Done'}
															</button>
															<button
																type="button"
																className="cl-btn-quiet"
																onClick={() => setCompleting(null)}
															>
																Cancel
															</button>
														</span>
													) : (
														<button
															type="button"
															className="cl-btn-quiet"
															onClick={() => openCompleteForm(task)}
														>
															{task.status === 'completed' ? 'Edit result…' : 'Mark done…'}
														</button>
													)
												) : null}
												{task.status !== 'available' && task.status !== 'claimed' ? (
													<button
														type="button"
														className="cl-btn-quiet"
														onClick={() =>
															act(
																() =>
																	postJson('/api/admin/status', {
																		taskId: task.id,
																		status: 'available',
																	}),
																`Reopened “${task.title}”.`,
															)
														}
													>
														Reopen
													</button>
												) : null}
												{task.status === 'available' ? (
													<button
														type="button"
														className="cl-btn-quiet"
														onClick={() =>
															act(
																() =>
																	postJson('/api/admin/status', {
																		taskId: task.id,
																		status: 'uncompletable',
																	}),
																`Removed “${task.title}” from the pool.`,
															)
														}
													>
														Remove
													</button>
												) : null}
												{pendingDelete === task.id ? (
													<>
														<button
															type="button"
															className="cl-btn-quiet cl-btn-quiet--danger"
															onClick={async () => {
																await deleteJson(`/api/admin/tasks/${task.id}`);
																refreshTasks();
																setPendingDelete(null);
																setNotice(`Deleted “${task.title}”.`);
															}}
														>
															Confirm delete
														</button>
														<button
															type="button"
															className="cl-btn-quiet"
															onClick={() => setPendingDelete(null)}
														>
															Keep
														</button>
													</>
												) : (
													<button
														type="button"
														className="cl-btn-quiet cl-btn-quiet--danger"
														onClick={() => setPendingDelete(task.id)}
													>
														Delete
													</button>
												)}
											</div>
										</td>
									</tr>
									{mode?.edit?.id === task.id ? (
										// The editor expands right under the row it edits, so the
										// admin never loses their place in the table.
										<tr className="cl-editor-row">
											<td colSpan={7}>
												<TaskForm
													initial={toForm(mode.edit)}
													heading={`Edit: ${mode.edit.title}`}
													submitLabel="Save changes"
													style={{ margin: '0.25rem 0' }}
													onCancel={() => setMode(null)}
													onSubmit={async (payload) => {
														await putJson(`/api/admin/tasks/${mode.edit.id}`, payload);
														refreshTasks();
														setMode(null);
														setNotice('Task updated.');
													}}
												/>
											</td>
										</tr>
									) : null}
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

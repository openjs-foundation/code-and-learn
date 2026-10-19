import { useState } from 'react';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import { postJson } from '../../lib/api.js';
import { useTasks, refreshTasks } from '../../lib/taskStore.js';
import { formatWhen } from './shared.jsx';

export default function FlaggedTab() {
	const { tasks, status } = useTasks();
	const [notice, setNotice] = useState(null);

	if (status !== 'ready') {
		return (
			<Skeleton loading>
				<div style={{ height: '8rem' }} />
			</Skeleton>
		);
	}

	const flagged = (tasks ?? []).filter((task) => task.status === 'flagged');
	const removed = (tasks ?? []).filter((task) => task.status === 'uncompletable');

	async function review(task, action, message) {
		await postJson('/api/admin/review', { taskId: task.id, action });
		refreshTasks();
		setNotice(message);
	}

	return (
		<div style={{ maxWidth: '52rem' }}>
			<p style={{ color: 'var(--cl-fg-soft)' }}>
				Participants report tasks they believe cannot be completed. Confirming removes the task from
				the pool for good; rejecting returns it to open.
			</p>
			{notice ? <p style={{ fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>{notice}</p> : null}

			{flagged.length === 0 ? (
				<p style={{ color: 'var(--cl-fg-faint)' }}>No reports waiting for review.</p>
			) : (
				flagged.map((task) => (
					<div key={task.id} className="cl-panel" style={{ marginBottom: '0.75rem' }}>
						<h2 style={{ marginBottom: '0.25rem' }}>
							<a href={`/tasks/${task.id}`}>{task.title}</a>
						</h2>
						<p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>
							Reported by {task.uncompletableBy} at {formatWhen(task.uncompletableAt)}:
						</p>
						<blockquote
							style={{
								margin: '0 0 0.75rem',
								paddingLeft: '0.875rem',
								borderLeft: '1px solid var(--cl-border-strong)',
								color: 'var(--cl-fg)',
							}}
						>
							{task.uncompletableReason}
						</blockquote>
						<div className="cl-actions" style={{ marginTop: 0 }}>
							<BaseButton
								as="button"
								size="small"
								onClick={() => review(task, 'confirm', `Removed “${task.title}”.`)}
							>
								Confirm: remove it
							</BaseButton>
							<button
								type="button"
								className="cl-btn-quiet"
								onClick={() => review(task, 'reject', `Returned “${task.title}” to the pool.`)}
							>
								Reject: back to the pool
							</button>
						</div>
					</div>
				))
			)}

			{removed.length > 0 ? (
				<section style={{ marginTop: '1.5rem' }}>
					<h2 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem' }}>Removed as uncompletable</h2>
					<ul className="cl-history">
						{removed.map((task) => (
							<li key={task.id}>
								<a href={`/tasks/${task.id}`}>{task.title}</a>
								<span style={{ fontSize: '0.8125rem', color: 'var(--cl-fg-faint)' }}>
									{task.uncompletableBy}: {(task.uncompletableReason ?? '').slice(0, 60)}
								</span>
								<button
									type="button"
									className="cl-btn-quiet"
									style={{ marginLeft: 'auto' }}
									onClick={() => review(task, 'restore', `Restored “${task.title}”.`)}
								>
									Restore
								</button>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}

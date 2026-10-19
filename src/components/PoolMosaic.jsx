import Skeleton from '@node-core/ui-components/Common/Skeleton';
import { useTasks, poolTasks } from '../lib/taskStore.js';

const STATUS_LABEL = {
	available: 'open',
	claimed: 'in progress',
	completed: 'done',
};

// The whole task pool as one field of cells: green open, amber held,
// deep-green filled when done. Every cell is the task itself — hover names it,
// click opens it — and cells flash as claims and completions land live.
export default function PoolMosaic() {
	const { tasks, status, changedIds } = useTasks();

	if (status === 'loading' || status === 'idle' || tasks === null) {
		return (
			<div className="cl-pulse" aria-hidden="true">
				<Skeleton loading>
					<div style={{ height: '4.5rem' }} />
				</Skeleton>
			</div>
		);
	}

	if (status === 'error') return null;
	const pool = poolTasks(tasks);
	if (pool.length === 0) return null;

	const counts = { available: 0, claimed: 0, completed: 0 };
	for (const task of pool) {
		if (counts[task.status] !== undefined) counts[task.status] += 1;
	}

	return (
		<div className="cl-pulse">
			<ul className="cl-mosaic" aria-label="Every task in the pool, by status">
				{pool.map((task) => (
					<li key={task.id}>
						<a
							className={[
								'cl-cell',
								task.status === 'claimed' && 'cl-cell--claimed',
								task.status === 'completed' && 'cl-cell--completed',
								changedIds.has(task.id) && 'cl-cell--flash',
							]
								.filter(Boolean)
								.join(' ')}
							href={`/tasks/${task.id}`}
							title={`${task.title} — ${STATUS_LABEL[task.status] ?? task.status}`}
							aria-label={`${task.title} — ${STATUS_LABEL[task.status] ?? task.status}`}
						/>
					</li>
				))}
			</ul>
			<p className="cl-legend">
				<span className="cl-legend-item">
					<span className="cl-swatch" aria-hidden="true" />
					<strong>{counts.available}</strong> open
				</span>
				<span className="cl-legend-item">
					<span className="cl-swatch cl-swatch--claimed" aria-hidden="true" />
					<strong>{counts.claimed}</strong> in progress
				</span>
				<span className="cl-legend-item">
					<span className="cl-swatch cl-swatch--completed" aria-hidden="true" />
					<strong>{counts.completed}</strong> done
				</span>
			</p>
		</div>
	);
}

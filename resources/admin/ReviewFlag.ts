/**
 * Triage of uncompletable reports. POST /api/admin/review { taskId, action }.
 * Confirmed tasks stay in the database with their reason but leave the pool
 * for good; 'restore' puts a confirmed one back if it was removed by mistake.
 */
import { json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { SYSTEM, Task, type TaskRecord } from '../shared/harper.ts';

export class ReviewFlag extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const { taskId, action } = ((await data) ?? {}) as { taskId?: unknown; action?: unknown };
		if (!taskId) return json(400, { error: 'taskId is required' });

		const task = (await Task.get(String(taskId), SYSTEM)) as TaskRecord | undefined;
		if (!task) return json(404, { error: 'task_not_found' });

		if (action === 'confirm') {
			if (task.status !== 'flagged') return json(409, { error: 'task_not_flagged' });
			await Task.patch(task.id, { status: 'uncompletable' }, SYSTEM);
			return json(200, { ok: true });
		}
		if (action === 'reject' || action === 'restore') {
			if (task.status !== 'flagged' && task.status !== 'uncompletable') {
				return json(409, { error: 'task_not_flagged' });
			}
			await Task.patch(
				task.id,
				{
					status: 'available',
					uncompletableReason: null,
					uncompletableBy: null,
					uncompletableAt: null,
				},
				SYSTEM,
			);
			return json(200, { ok: true });
		}
		return json(400, { error: 'action must be confirm, reject, or restore' });
	}
}

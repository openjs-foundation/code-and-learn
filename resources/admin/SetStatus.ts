/**
 * Organizer override of a task's lifecycle. POST /api/admin/status
 * { taskId, status, evidenceUrl?, completedBy? }
 *
 * - 'available'     reopens the task: assignment, completion, and report
 *                   state are all cleared, whatever it was before.
 * - 'completed'     marks it truly done — with or without evidence. Credit
 *                   goes to `completedBy`, else the current assignee, else
 *                   the acting admin.
 * - 'uncompletable' removes it from the pool for good.
 *
 * 'claimed' comes from /api/admin/assign, and 'flagged' only from attendee
 * reports. Runs under the pool lock, like every other claim-state transition.
 */
import { currentUser, json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { isHttpUrl, withPoolLock } from '../shared/tasks.ts';
import { SYSTEM, Task, type TaskRecord } from '../shared/harper.ts';

export class SetStatus extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const body = ((await data) ?? {}) as {
			taskId?: unknown;
			status?: unknown;
			evidenceUrl?: unknown;
			completedBy?: unknown;
		};
		if (!body.taskId) return json(400, { error: 'taskId is required' });
		if (!['available', 'completed', 'uncompletable'].includes(body.status as string)) {
			return json(400, { error: 'status must be available, completed, or uncompletable' });
		}
		const evidenceUrl = body.evidenceUrl == null ? null : String(body.evidenceUrl);
		if (body.status === 'completed' && evidenceUrl && !isHttpUrl(evidenceUrl)) {
			return json(400, { error: 'evidence_url_invalid' });
		}
		// Resolved before the lock: inside it, getContext() is the lock's
		// transaction, not this request's session.
		const admin = await currentUser();

		const refusal = await withPoolLock(async (context) => {
			const task = (await Task.get(String(body.taskId), context)) as TaskRecord | undefined;
			if (!task) return json(404, { error: 'task_not_found' });

			if (body.status === 'available') {
				await Task.patch(
					task.id,
					{
						status: 'available',
						assignedTo: null,
						assignedName: null,
						assignedAt: null,
						completedBy: null,
						completedAt: null,
						evidenceUrl: null,
						uncompletableReason: null,
						uncompletableBy: null,
						uncompletableAt: null,
					},
					context,
				);
			} else if (body.status === 'completed') {
				const completedBy =
					String(body.completedBy ?? '')
						.trim()
						.toLowerCase() ||
					task.assignedTo ||
					admin?.id ||
					'organizer';
				await Task.patch(
					task.id,
					{
						status: 'completed',
						completedBy,
						completedAt: Date.now(),
						evidenceUrl,
						assignedTo: null,
						assignedName: null,
						assignedAt: null,
					},
					context,
				);
			} else {
				await Task.patch(
					task.id,
					{
						status: 'uncompletable',
						uncompletableReason: task.uncompletableReason ?? 'Removed by an organizer.',
						uncompletableBy: admin?.id ?? null,
						uncompletableAt: Date.now(),
						assignedTo: null,
						assignedName: null,
						assignedAt: null,
					},
					context,
				);
			}
			return null;
		});
		if (refusal) return refusal;
		if (body.status === 'completed') {
			return json(200, { ok: true, task: await Task.get(String(body.taskId), SYSTEM) });
		}
		return json(200, { ok: true });
	}
}

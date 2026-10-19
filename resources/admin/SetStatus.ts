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
 * reports.
 */
import { currentUser, json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { isHttpUrl } from '../shared/tasks.ts';
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

		const task = (await Task.get(String(body.taskId), SYSTEM)) as TaskRecord | undefined;
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
				SYSTEM,
			);
			return json(200, { ok: true });
		}

		if (body.status === 'completed') {
			const evidenceUrl = body.evidenceUrl == null ? null : String(body.evidenceUrl);
			if (evidenceUrl && !isHttpUrl(evidenceUrl)) {
				return json(400, { error: 'evidence_url_invalid' });
			}
			const admin = await currentUser();
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
				SYSTEM,
			);
			return json(200, { ok: true, task: await Task.get(task.id, SYSTEM) });
		}

		if (body.status === 'uncompletable') {
			const admin = await currentUser();
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
				SYSTEM,
			);
			return json(200, { ok: true });
		}

		return json(400, { error: 'status must be available, completed, or uncompletable' });
	}
}

/**
 * Organizer control over assignments.
 *
 * POST /api/admin/assign { taskId, login, force? } — hand an open task to a
 * participant, or reassign a claimed one to somebody else (the previous
 * holder simply loses it). If the assignee already holds a task, 409s unless
 * force, which releases their current task back to the pool first.
 * POST /api/admin/unassign { taskId } — take a claim back.
 *
 * Both run under the pool lock, like the attendee transitions they race with.
 */
import { currentUser, json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { findActiveTask, withPoolLock } from '../shared/tasks.ts';
import { SYSTEM, Task, User, type TaskRecord, type UserRecord } from '../shared/harper.ts';

// A fresh object per write: Harper stamps updatedAt onto the patch object it
// is given, so a shared constant would carry a stale timestamp into the next
// patch (and fail validation whenever that timestamp was fractional).
const releaseFields = () => ({
	status: 'available',
	assignedTo: null,
	assignedName: null,
	assignedAt: null,
});

export class AssignTask extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const body = ((await data) ?? {}) as { taskId?: unknown; login?: unknown; force?: unknown };
		const login = String(body.login ?? '')
			.trim()
			.toLowerCase();
		if (!body.taskId) return json(400, { error: 'taskId is required' });
		if (!login) return json(400, { error: 'login is required' });

		// Resolved before the lock: inside it, getContext() is the lock's
		// transaction, not this request's session.
		const assignee = (await User.get(login, SYSTEM)) as UserRecord | undefined;
		const admin = await currentUser();

		const refusal = await withPoolLock(async (context) => {
			const task = (await Task.get(String(body.taskId), context)) as TaskRecord | undefined;
			if (!task) return json(404, { error: 'task_not_found' });
			if (task.status !== 'available' && task.status !== 'claimed') {
				return json(409, {
					error: 'task_unavailable',
					hint: 'Only open or in-progress tasks can be assigned; reopen it first.',
				});
			}
			if (task.status === 'claimed' && task.assignedTo === login) {
				return json(409, { error: 'already_assigned', hint: `${login} already holds this task.` });
			}

			const active = await findActiveTask(login, context);
			if (active) {
				if (!body.force) {
					return json(409, {
						error: 'assignee_busy',
						task: { id: active.id, title: active.title },
						hint: 'They already hold a task. Retry with force to release it.',
					});
				}
				await Task.patch(active.id, releaseFields(), context);
			}

			await Task.patch(
				task.id,
				{
					status: 'claimed',
					assignedTo: login,
					assignedName: assignee?.name || login,
					assignedAt: Date.now(),
					assignedBy: admin?.id ?? null,
				},
				context,
			);
			return null;
		});
		if (refusal) return refusal;
		return json(200, { ok: true, task: await Task.get(String(body.taskId), SYSTEM) });
	}
}

export class UnassignTask extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const { taskId } = ((await data) ?? {}) as { taskId?: unknown };
		if (!taskId) return json(400, { error: 'taskId is required' });

		return withPoolLock(async (context) => {
			const task = (await Task.get(String(taskId), context)) as TaskRecord | undefined;
			if (!task) return json(404, { error: 'task_not_found' });
			if (task.status !== 'claimed') return json(409, { error: 'task_not_claimed' });

			await Task.patch(task.id, releaseFields(), context);
			return json(200, { ok: true });
		});
	}
}

/**
 * Organizer control over assignments.
 *
 * POST /api/admin/assign { taskId, login, force? } — hand an open task to a
 * participant, or reassign a claimed one to somebody else (the previous
 * holder simply loses it). If the assignee already holds a task, 409s unless
 * force, which releases their current task back to the pool first.
 * POST /api/admin/unassign { taskId } — take a claim back.
 */
import { currentUser, json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { findActiveTask } from '../shared/tasks.ts';
import { SYSTEM, Task, User, type TaskRecord, type UserRecord } from '../shared/harper.ts';

const RELEASE_FIELDS = {
	status: 'available',
	assignedTo: null,
	assignedName: null,
	assignedAt: null,
};

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

		const task = (await Task.get(String(body.taskId), SYSTEM)) as TaskRecord | undefined;
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

		const active = await findActiveTask(login);
		if (active) {
			if (!body.force) {
				return json(409, {
					error: 'assignee_busy',
					task: { id: active.id, title: active.title },
					hint: 'They already hold a task. Retry with force to release it.',
				});
			}
			await Task.patch(active.id, RELEASE_FIELDS, SYSTEM);
		}

		const assignee = (await User.get(login, SYSTEM)) as UserRecord | undefined;
		const admin = await currentUser();
		await Task.patch(
			task.id,
			{
				status: 'claimed',
				assignedTo: login,
				assignedName: assignee?.name || login,
				assignedAt: Date.now(),
				assignedBy: admin?.id ?? null,
			},
			SYSTEM,
		);
		return json(200, { ok: true, task: await Task.get(task.id, SYSTEM) });
	}
}

export class UnassignTask extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const { taskId } = ((await data) ?? {}) as { taskId?: unknown };
		if (!taskId) return json(400, { error: 'taskId is required' });

		const task = (await Task.get(String(taskId), SYSTEM)) as TaskRecord | undefined;
		if (!task) return json(404, { error: 'task_not_found' });
		if (task.status !== 'claimed') return json(409, { error: 'task_not_claimed' });

		await Task.patch(task.id, RELEASE_FIELDS, SYSTEM);
		return json(200, { ok: true });
	}
}

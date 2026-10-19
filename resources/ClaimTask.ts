/**
 * Self-serve claiming. POST /api/claim { taskId } — exclusive: a claimed task
 * is locked to its holder, and each attendee holds at most one active task.
 */
import { currentUser, json, restrictionOf, sessionLogin, OpenResource } from './shared/auth.ts';
import { findActiveTask } from './shared/tasks.ts';
import { getClaims } from './Settings.ts';
import { SYSTEM, Task, type TaskRecord } from './shared/harper.ts';

export class ClaimTask extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const login = sessionLogin();
		if (!login) return json(401, { error: 'sign_in_required' });

		const { taskId } = ((await data) ?? {}) as { taskId?: unknown };
		if (!taskId) return json(400, { error: 'taskId is required' });

		const user = await currentUser();
		const restriction = restrictionOf(user);
		if (restriction) return json(403, { error: 'restricted', ...restriction });

		// The event-wide pause blocks self-serve claiming, and a hidden pool is
		// closed by definition; admins keep working through both (and can still
		// hand tasks out via /api/admin/assign).
		if (!user?.isAdmin) {
			const claims = await getClaims();
			if (claims.paused || claims.hidden) {
				return json(403, { error: 'claims_paused', message: claims.message || null });
			}
		}

		const active = await findActiveTask(login);
		if (active) return json(409, { error: 'already_claimed', task: active });

		const task = (await Task.get(String(taskId), SYSTEM)) as TaskRecord | undefined;
		if (!task) return json(404, { error: 'task_not_found' });
		if (task.status !== 'available') {
			return json(409, { error: 'task_unavailable', status: task.status });
		}

		await Task.patch(
			task.id,
			{
				status: 'claimed',
				assignedTo: login,
				assignedName: user?.name || login,
				assignedAt: Date.now(),
			},
			SYSTEM,
		);
		return json(200, { ok: true, task: await Task.get(task.id, SYSTEM) });
	}
}

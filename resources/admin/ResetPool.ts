/**
 * The admin danger zone. POST /api/admin/reset { scope, confirm: true }
 *
 * - 'claims'   releases every claimed task back to open (holders keep their
 *              completed history).
 * - 'progress' reopens every task — assignments, completions, and flags all
 *              cleared. A fresh run of the same pool.
 * - 'wipe'     deletes every task and guide. The event starts over.
 *
 * The UI gates each scope behind a typed confirmation; `confirm: true` is the
 * server-side belt to keep a stray request from doing it by accident.
 */
import { json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { Guide, query, SYSTEM, Task, type TaskRecord } from '../shared/harper.ts';

const CLEARED = {
	assignedTo: null,
	assignedName: null,
	assignedAt: null,
	assignedBy: null,
	completedBy: null,
	completedAt: null,
	evidenceUrl: null,
	uncompletableReason: null,
	uncompletableBy: null,
	uncompletableAt: null,
};

export class ResetPool extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const body = ((await data) ?? {}) as { scope?: unknown; confirm?: unknown };
		if (body.confirm !== true) return json(400, { error: 'confirm_required' });

		if (body.scope === 'claims') {
			let released = 0;
			for await (const task of Task.search(
				query({ conditions: [{ attribute: 'status', value: 'claimed' }] }),
				SYSTEM,
			) as AsyncIterable<TaskRecord>) {
				await Task.patch(
					task.id,
					{ status: 'available', assignedTo: null, assignedName: null, assignedAt: null },
					SYSTEM,
				);
				released += 1;
			}
			return json(200, { ok: true, released });
		}

		if (body.scope === 'progress') {
			let reopened = 0;
			for await (const task of Task.search(
				query({ select: ['id', 'status'] }),
				SYSTEM,
			) as AsyncIterable<TaskRecord>) {
				if (task.status === 'available') continue;
				await Task.patch(task.id, { status: 'available', ...CLEARED }, SYSTEM);
				reopened += 1;
			}
			return json(200, { ok: true, reopened });
		}

		if (body.scope === 'wipe') {
			let tasks = 0;
			let guides = 0;
			for await (const task of Task.search(
				query({ select: ['id'] }),
				SYSTEM,
			) as AsyncIterable<TaskRecord>) {
				await Task.delete(task.id, null, SYSTEM);
				tasks += 1;
			}
			for await (const guide of Guide.search(query({ select: ['id'] }), SYSTEM) as AsyncIterable<{
				id: string;
			}>) {
				await Guide.delete(guide.id, null, SYSTEM);
				guides += 1;
			}
			return json(200, { ok: true, tasks, guides });
		}

		return json(400, { error: 'scope must be claims, progress, or wipe' });
	}
}

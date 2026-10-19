/**
 * Admin task CRUD. POST (create) / PUT /:id (edit) / DELETE /:id on
 * /api/admin/tasks.
 */
import { json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { validateTaskInput } from '../shared/tasks.ts';
import { SYSTEM, Task } from '../shared/harper.ts';

export class UpdateTask extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const { task, problem } = validateTaskInput(await data);
		if (problem) return json(400, { error: problem });

		const created = await Task.create({ ...task, status: 'available' }, SYSTEM);
		return json(201, { ok: true, task: created });
	}

	static async put(target: { id?: string }, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;
		if (!target.id) return json(400, { error: 'task id required' });

		const existing = await Task.get(target.id, SYSTEM);
		if (!existing) return json(404, { error: 'task_not_found' });

		const { task, problem } = validateTaskInput(await data, { partial: true });
		if (problem) return json(400, { error: problem });

		await Task.patch(target.id, task, SYSTEM);
		return json(200, { ok: true, task: await Task.get(target.id, SYSTEM) });
	}

	static async delete(target: { id?: string }) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;
		if (!target.id) return json(400, { error: 'task id required' });

		const existing = await Task.get(target.id, SYSTEM);
		if (!existing) return json(404, { error: 'task_not_found' });

		// delete's signature is (idOrQuery, data?, context?) — context is third.
		await Task.delete(target.id, null, SYSTEM);
		return json(200, { ok: true });
	}
}

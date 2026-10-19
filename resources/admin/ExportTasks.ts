/**
 * Bulk export (admin only). GET /api/admin/export
 *
 * Returns { tasks, guides } — the same shape the bulk importer accepts, so an
 * export re-imports as-is. Live pool state (status, assignment, completion,
 * evidence) rides along for backup purposes; the importer ignores fields it
 * doesn't know and every re-imported task starts as open. Derived HTML
 * (descriptionHtml/bodyHtml) is left out — it regenerates on import.
 */
import { requireAdmin, OpenResource } from '../shared/auth.ts';
import { Guide, query, SYSTEM, Task, type GuideRecord, type TaskRecord } from '../shared/harper.ts';

export class ExportTasks extends OpenResource {
	static async get() {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const tasks: Partial<TaskRecord>[] = [];
		for await (const task of Task.search(query({}), SYSTEM) as AsyncIterable<TaskRecord>) {
			const { descriptionRendered: _rendered, ...rest } = task as TaskRecord &
				Record<string, unknown>;
			delete (rest as Record<string, unknown>).descriptionHtml;
			tasks.push(rest);
		}
		tasks.sort((a, b) => String(a.id).localeCompare(String(b.id)));

		const guides: Partial<GuideRecord>[] = [];
		for await (const guide of Guide.search(query({}), SYSTEM) as AsyncIterable<GuideRecord>) {
			const { bodyRendered: _bodyRendered, ...rest } = guide as GuideRecord &
				Record<string, unknown>;
			delete (rest as Record<string, unknown>).bodyHtml;
			guides.push(rest);
		}
		guides.sort((a, b) => String(a.id).localeCompare(String(b.id)));

		return { exportedAt: new Date().toISOString(), tasks, guides };
	}
}

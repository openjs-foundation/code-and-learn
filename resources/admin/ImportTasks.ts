/**
 * Bulk import (admin only). POST /api/admin/import
 *
 * Accepts a JSON array of tasks, `{ "tasks": [...] }`, `{ "guides": [...] }`,
 * or both keys at once — so data/contribution-tasks.json and
 * data/contribution-guides.json each paste straight into the admin importer.
 * Tasks accept both the app shape and the official curated shape (see
 * shared/tasks.ts); every imported task starts as open. Guides upsert by id
 * (the theme), so editing a guide is just a re-import.
 */
import { json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { MAX_IMPORT_BATCH, validateTaskInput } from '../shared/tasks.ts';
import { validateGuideInput } from '../Guides.ts';
import { Guide, record, SYSTEM, Task } from '../shared/harper.ts';

interface ImportBody {
	tasks?: unknown[];
	guides?: unknown[];
}

export class ImportTasks extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const body = ((await data) ?? {}) as ImportBody | unknown[];
		const tasks = Array.isArray(body) ? body : (body.tasks ?? []);
		const guides = Array.isArray(body) ? [] : (body.guides ?? []);
		if (!Array.isArray(tasks) || !Array.isArray(guides) || (!tasks.length && !guides.length)) {
			return json(400, {
				error: 'Provide a JSON array of tasks, { "tasks": [...] }, or { "guides": [...] }.',
			});
		}
		if (tasks.length > MAX_IMPORT_BATCH || guides.length > MAX_IMPORT_BATCH) {
			return json(400, { error: `At most ${MAX_IMPORT_BATCH} entries per import.` });
		}

		let created = 0;
		let importedGuides = 0;
		const errors: { index: number; title: string | null; problem: string }[] = [];

		for (const [index, input] of tasks.entries()) {
			const { task, problem } = validateTaskInput(input);
			if (problem) {
				errors.push({
					index,
					title: (input as { title?: string })?.title ?? null,
					problem,
				});
				continue;
			}
			const id = (input as { id?: unknown })?.id;
			await Task.create(
				{ ...(id ? { id: String(id) } : {}), ...task, status: 'available' },
				SYSTEM,
			);
			created += 1;
		}

		for (const [index, input] of guides.entries()) {
			const { guide, problem } = validateGuideInput(input);
			if (problem) {
				errors.push({
					index,
					title: (input as { title?: string })?.title ?? null,
					problem: `guide: ${problem}`,
				});
				continue;
			}
			await Guide.put(record(guide!), SYSTEM);
			importedGuides += 1;
		}

		return json(errors.length && !created && !importedGuides ? 400 : 200, {
			ok: errors.length === 0,
			created,
			importedGuides,
			errors,
		});
	}
}

/**
 * Local development bootstrap.
 *
 * LOCAL_DATA_FILE=<path>[,<path>…]  loads one or more JSON task files (e.g.
 *                          data/contribution-tasks.json,data/manual.json — any
 *                          admin bulk-import shape) as the starting pool.
 * LOCAL_GUIDES_FILE=<path> loads the per-theme guides (data/contribution-guides.json).
 *
 * Deterministic ids keep both loads idempotent across Harper's worker threads
 * and restarts — existing records are never overwritten, so admin edits stick.
 * Real deployments leave these unset and import the curated files from /admin.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	Guide,
	query,
	record,
	SYSTEM,
	Task,
	User,
	type GuideRecord,
	type TaskRecord,
} from './shared/harper.ts';
import { LOCAL_DEV_LOGIN, LOCAL_DEV_USER } from './shared/auth.ts';
import { validateTaskInput } from './shared/tasks.ts';
import { validateGuideInput } from './Guides.ts';
import { renderMarkdown } from './shared/render.ts';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Heal records from before the current rendering model: anything with
// markdown but no stored segments gets rendered once at startup, and fields
// from retired formats are scrubbed. Runs on every boot and is idempotent,
// so upgraded databases never need a wipe.
(async () => {
	for await (const task of Task.search(query({}), SYSTEM) as AsyncIterable<TaskRecord>) {
		const patch: Record<string, unknown> = {};
		if (task.description && !task.descriptionRendered) {
			patch.descriptionRendered = renderMarkdown(task.description);
		}
		if ((task as Record<string, unknown>).descriptionHtml != null) patch.descriptionHtml = null;
		if (Object.keys(patch).length) await Task.patch(task.id, patch, SYSTEM);
	}
	for await (const guide of Guide.search(query({}), SYSTEM) as AsyncIterable<GuideRecord>) {
		const patch: Record<string, unknown> = {};
		if (guide.body && !guide.bodyRendered) {
			patch.bodyRendered = renderMarkdown(guide.body);
		}
		if ((guide as Record<string, unknown>).bodyHtml != null) patch.bodyHtml = null;
		if (Object.keys(patch).length) await Guide.patch(guide.id, patch, SYSTEM);
	}
})().catch((error) => console.error('render backfill failed:', error));

async function readJson(path: string): Promise<unknown> {
	const file = isAbsolute(path) ? path : join(rootDir, path);
	return JSON.parse(await readFile(file, 'utf8'));
}

if (process.env.LOCAL_DATA_FILE) {
	(async () => {
		const files = (process.env.LOCAL_DATA_FILE as string)
			.split(',')
			.map((path) => path.trim())
			.filter(Boolean);
		for (const [fileIndex, file] of files.entries()) {
			const parsed = (await readJson(file)) as { tasks?: unknown[] };
			const list = Array.isArray(parsed) ? parsed : parsed.tasks;
			if (!Array.isArray(list)) {
				throw new Error(`${file} is not a JSON array of tasks`);
			}
			for (const [index, input] of list.entries()) {
				const { task, problem } = validateTaskInput(input);
				if (problem) {
					console.warn(`${file} entry ${index + 1} skipped: ${problem}`);
					continue;
				}
				const rawId = (input as { id?: unknown })?.id;
				// The id-less fallback is namespaced per file only when several
				// files load, so single-file setups keep their historical ids.
				const id = rawId
					? String(rawId)
					: files.length > 1
						? `local-${fileIndex + 1}-${String(index + 1).padStart(2, '0')}`
						: `local-${String(index + 1).padStart(2, '0')}`;
				if (!(await Task.get(id, SYSTEM))) {
					await Task.put(record({ ...task, id, status: 'available' }), SYSTEM);
				}
			}
		}
	})().catch((error) => console.error('LOCAL_DATA_FILE load failed:', error));
}

if (process.env.LOCAL_GUIDES_FILE) {
	(async () => {
		const parsed = (await readJson(process.env.LOCAL_GUIDES_FILE as string)) as {
			guides?: unknown[];
		};
		const list = Array.isArray(parsed) ? parsed : parsed.guides;
		if (!Array.isArray(list)) {
			throw new Error(`${process.env.LOCAL_GUIDES_FILE} is not a JSON array of guides`);
		}
		for (const [index, input] of list.entries()) {
			const { guide, problem } = validateGuideInput(input);
			if (problem) {
				console.warn(`LOCAL_GUIDES_FILE entry ${index + 1} skipped: ${problem}`);
				continue;
			}
			if (!(await Guide.get(guide!.id, SYSTEM))) {
				await Guide.put(record(guide!), SYSTEM);
			}
		}
	})().catch((error) => console.error('LOCAL_GUIDES_FILE load failed:', error));
}

if (LOCAL_DEV_LOGIN) {
	(async () => {
		if (!(await User.get(LOCAL_DEV_USER, SYSTEM))) {
			await User.put(
				record({ id: LOCAL_DEV_USER, name: 'Local Dev', avatarUrl: null, isAdmin: true }),
				SYSTEM,
			);
		}
	})().catch((error) => console.error('LOCAL_DEV_LOGIN bootstrap failed:', error));
}

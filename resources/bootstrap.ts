/**
 * Local development bootstrap.
 *
 * LOCAL_DATA_FILE=<path>[,<path>…]  loads one or more JSON task files (e.g.
 *                          data/contribution-tasks.json,data/manual.json — any
 *                          admin bulk-import shape) as the starting pool.
 * LOCAL_GUIDES_FILE=<path> loads the per-theme guides (data/contribution-guides.json).
 * LOCAL_SEED=<dir>         loads a fixture set (fixtures/): tasks with their
 *                          live state (claims, completions, flags), guides,
 *                          users (including moderation), and settings. Local
 *                          instances only; see shared/local.ts.
 *
 * Deterministic ids keep every load idempotent across Harper's worker threads
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
	Setting,
	type GuideRecord,
	type TaskRecord,
	type TaskStatus,
} from './shared/harper.ts';
import { isLocalInstance } from './shared/local.ts';
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

// A fixture set keeps each task's live state, unlike LOCAL_DATA_FILE (which
// opens every task), and adds users and settings, so every claim, completion,
// flag, and moderation state is there to work with from the first boot.
const TASK_STATUSES: TaskStatus[] = [
	'available',
	'claimed',
	'completed',
	'flagged',
	'uncompletable',
];
const TASK_STATE_FIELDS = [
	'assignedTo',
	'assignedName',
	'assignedAt',
	'assignedBy',
	'completedBy',
	'completedAt',
	'evidenceUrl',
	'uncompletableReason',
	'uncompletableBy',
	'uncompletableAt',
];
const USER_FIELDS = ['name', 'avatarUrl', 'isAdmin', 'bannedAt', 'banReason', 'timeoutUntil'];

function pick(input: Record<string, unknown>, fields: string[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const field of fields) if (input[field] !== undefined) out[field] = input[field];
	return out;
}

// Reads `<dir>/<name>.json` as { [name]: [...] } (or a bare array); a missing
// file is an empty list, so a fixture set can leave parts out.
async function readSeedList(dir: string, name: string): Promise<Record<string, unknown>[]> {
	let parsed: unknown;
	try {
		parsed = await readJson(join(dir, `${name}.json`));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	const list = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>)[name];
	if (!Array.isArray(list)) throw new Error(`${dir}/${name}.json has no "${name}" array`);
	return list as Record<string, unknown>[];
}

if (process.env.LOCAL_SEED) {
	(async () => {
		const dir = process.env.LOCAL_SEED as string;
		if (!isLocalInstance()) {
			console.error(
				`LOCAL_SEED ignored: OAUTH_REDIRECT_URI (${process.env.OAUTH_REDIRECT_URI}) is not a local origin. Fixtures load on local instances only.`,
			);
			return;
		}
		const counts = { guides: 0, users: 0, settings: 0, tasks: 0, existing: 0 };

		for (const [index, input] of (await readSeedList(dir, 'guides')).entries()) {
			const { guide, problem } = validateGuideInput(input);
			if (problem) {
				console.warn(`LOCAL_SEED guides entry ${index + 1} skipped: ${problem}`);
				continue;
			}
			if (await Guide.get(guide!.id, SYSTEM)) {
				counts.existing++;
			} else {
				await Guide.put(record(guide!), SYSTEM);
				counts.guides++;
			}
		}

		for (const [index, input] of (await readSeedList(dir, 'users')).entries()) {
			const id = String(input.id ?? '')
				.trim()
				.toLowerCase();
			if (!id) {
				console.warn(`LOCAL_SEED users entry ${index + 1} skipped: id is required`);
				continue;
			}
			if (await User.get(id, SYSTEM)) {
				counts.existing++;
			} else {
				await User.put(record({ id, ...pick(input, USER_FIELDS) }), SYSTEM);
				counts.users++;
			}
		}

		for (const [index, input] of (await readSeedList(dir, 'settings')).entries()) {
			const id = String(input.id ?? '').trim();
			if (!id) {
				console.warn(`LOCAL_SEED settings entry ${index + 1} skipped: id is required`);
				continue;
			}
			if (await Setting.get(id, SYSTEM)) {
				counts.existing++;
			} else {
				await Setting.put(record({ id, value: input.value }), SYSTEM);
				counts.settings++;
			}
		}

		for (const [index, input] of (await readSeedList(dir, 'tasks')).entries()) {
			const id = String(input.id ?? '').trim();
			const { task, problem } = validateTaskInput(input);
			if (problem || !id) {
				console.warn(`LOCAL_SEED tasks entry ${index + 1} skipped: ${problem ?? 'id is required'}`);
				continue;
			}
			const status = TASK_STATUSES.includes(input.status as TaskStatus)
				? (input.status as TaskStatus)
				: 'available';
			if (await Task.get(id, SYSTEM)) {
				counts.existing++;
			} else {
				await Task.put(record({ ...task, ...pick(input, TASK_STATE_FIELDS), id, status }), SYSTEM);
				counts.tasks++;
			}
		}

		console.log(
			`LOCAL_SEED ${dir}: added ${counts.tasks} tasks, ${counts.guides} guides, ${counts.users} users, ${counts.settings} settings (${counts.existing} already present)`,
		);
	})().catch((error) => console.error('LOCAL_SEED load failed:', error));
}

// LOCAL_DEV_LOGIN (every request as one synthetic admin) was replaced by
// dev sign-in; say so rather than silently ignoring an old .env.
if (process.env.LOCAL_DEV_LOGIN) {
	console.warn(
		'LOCAL_DEV_LOGIN no longer does anything: set LOCAL_DEV_SIGN_IN=true and sign in from the Dev menu in the nav (see README).',
	);
}

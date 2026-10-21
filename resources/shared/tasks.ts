/**
 * Task validation + import normalization shared by the admin endpoints and
 * the local-data bootstrap, plus the pool lock every claim-state transition
 * runs under.
 */
import { transaction } from 'harper';
import { query, SYSTEM, Task, type Difficulty, type TaskLink, type TaskRecord } from './harper.ts';
import { renderMarkdown } from './render.ts';

export const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
export const MAX_IMPORT_BATCH = 500;

export function isHttpUrl(value: unknown): boolean {
	try {
		const url = new URL(String(value));
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

function normalizeLinks(links: unknown): TaskLink[] {
	if (!Array.isArray(links)) return [];
	return links
		.filter((link) => link && typeof link === 'object' && isHttpUrl(link.url))
		.map((link) => ({
			label: String(link.label || link.url).slice(0, 200),
			url: String(link.url),
		}))
		.slice(0, 20);
}

interface TaskInput {
	[key: string]: unknown;
}

// The official curated list (data/contribution-tasks.json) keeps tasks and
// guides separate: a task carries only its specifics plus a `theme` pointing
// at the shared how-to. Map that shape onto the app's task fields, folding the
// task-OWN specifics (files, verify command, commit prefix) into the
// description — the theme guide is looked up at render time, never copied in.
const TIER_TO_DIFFICULTY: Record<string, Difficulty> = {
	easy: 'beginner',
	medium: 'intermediate',
	hard: 'advanced',
};
const TIER_MINUTES: Record<Difficulty, number> = { beginner: 30, intermediate: 60, advanced: 90 };

export function isOfficialTask(input: TaskInput): boolean {
	return typeof input.detail === 'string' && !('description' in input);
}

export function fromOfficialTask(input: TaskInput): TaskInput {
	const difficulty = TIER_TO_DIFFICULTY[String(input.tier)] ?? 'intermediate';
	const detail = String(input.detail ?? '').trim();
	const parts = [detail];

	const files = Array.isArray(input.files) ? input.files.map(String) : [];
	if (files.length) {
		parts.push(`**Files**\n\n${files.map((file) => `- \`${file}\``).join('\n')}`);
	}
	if (typeof input.verifyCommand === 'string' && input.verifyCommand.trim()) {
		parts.push(`**Verify**\n\n\`\`\`bash\n${input.verifyCommand.trim()}\n\`\`\``);
	}
	if (typeof input.commitPrefix === 'string' && input.commitPrefix.trim()) {
		parts.push(`Commit prefix: \`${input.commitPrefix.trim()}\``);
	}
	if (typeof input.gotcha === 'string' && input.gotcha.trim()) {
		parts.push(`> ⚠️ ${input.gotcha.trim()}`);
	}

	// First sentence of the detail, stripped of code ticks, as the list summary.
	const summary = detail
		.replace(/`/g, '')
		.split(/(?<=\.)\s/)[0]
		.slice(0, 300);

	return {
		id: input.id,
		title: input.title,
		summary,
		description: parts.join('\n\n'),
		theme: input.theme,
		difficulty,
		area: String(input.theme ?? '').toLowerCase() || 'general',
		skills: input.subsystem ? [String(input.subsystem).toLowerCase()] : [],
		estimatedMinutes: TIER_MINUTES[difficulty],
		links: [],
	};
}

// Validates admin-supplied task content. Returns { task } or { problem }.
export function validateTaskInput(
	rawInput: unknown,
	{ partial = false } = {},
): { task?: Partial<TaskRecord>; problem?: string } {
	if (!rawInput || typeof rawInput !== 'object') return { problem: 'not an object' };
	const input = isOfficialTask(rawInput as TaskInput)
		? fromOfficialTask(rawInput as TaskInput)
		: (rawInput as TaskInput);
	const out: Partial<TaskRecord> = {};

	if (!partial || 'title' in input) {
		const title = String(input.title ?? '').trim();
		if (!title) return { problem: 'title is required' };
		out.title = title.slice(0, 300);
	}
	if (!partial || 'summary' in input) {
		out.summary = String(input.summary ?? '')
			.trim()
			.slice(0, 500);
	}
	if (!partial || 'description' in input) {
		out.description = String(input.description ?? '').slice(0, 20000);
		out.descriptionRendered = renderMarkdown(out.description);
	}
	if ('theme' in input) {
		const theme = String(input.theme ?? '').trim();
		out.theme = theme ? theme.slice(0, 80) : null;
	}
	if (!partial || 'difficulty' in input) {
		const difficulty = String(input.difficulty ?? '')
			.trim()
			.toLowerCase() as Difficulty;
		if (!DIFFICULTIES.includes(difficulty)) {
			return { problem: `difficulty must be one of: ${DIFFICULTIES.join(', ')}` };
		}
		out.difficulty = difficulty;
	}
	if (!partial || 'area' in input) {
		const area = String(input.area ?? '')
			.trim()
			.toLowerCase();
		if (!area) return { problem: 'area is required' };
		out.area = area.slice(0, 80);
	}
	if (!partial || 'skills' in input) {
		const skills = Array.isArray(input.skills) ? input.skills : [];
		out.skills = skills
			.map((skill) => String(skill).trim().toLowerCase())
			.filter(Boolean)
			.slice(0, 12);
	}
	if (!partial || 'estimatedMinutes' in input) {
		const minutes = Number(input.estimatedMinutes);
		if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 8 * 60) {
			return { problem: 'estimatedMinutes must be between 1 and 480' };
		}
		out.estimatedMinutes = Math.round(minutes);
	}
	if (!partial || 'links' in input) {
		out.links = normalizeLinks(input.links);
	}
	return { task: out };
}

export async function findActiveTask(
	login: string,
	context: object = SYSTEM,
): Promise<TaskRecord | null> {
	const results = Task.search(
		query({
			conditions: [
				{ attribute: 'assignedTo', value: login },
				{ attribute: 'status', value: 'claimed' },
			],
		}),
		context,
	) as AsyncIterable<TaskRecord>;
	for await (const task of results) return task;
	return null;
}

interface KeyLocks {
	tryLock(_key: string, _onUnlocked?: () => void): boolean;
	unlock(_key: string): boolean;
}

const POOL_LOCK = 'code-and-learn:pool-lock';
// A transition takes milliseconds. A lock held this long means its holder
// died (a crashed worker thread), so it is broken rather than waited on
// forever mid-event.
const POOL_LOCK_STALE_MS = 10_000;
let warnedNoLock = false;

/**
 * Runs one pool state transition (claim, release, complete, assign, …)
 * exclusively across Harper's worker threads, in its own transaction.
 *
 * Harper has no compare-and-set for application writes — a patch merges onto
 * whatever committed last — so a check-then-write ("is the task open?", "do
 * they already hold one?") is only safe if no other transition interleaves.
 * The table store's key lock is shared by every thread in the process; the
 * transaction commits before the lock is released, so the next holder reads
 * the result. Process-wide only: it does not coordinate replicated nodes.
 *
 * `body` must do all its reads and writes through the context it is given,
 * and must not read the session (getContext() is the transaction's inside):
 * resolve the caller before entering.
 */
export async function withPoolLock<T>(body: (_context: object) => Promise<T>): Promise<T> {
	const context = {};
	const store = (Task as unknown as { primaryStore?: Partial<KeyLocks> }).primaryStore;
	if (typeof store?.tryLock !== 'function' || typeof store.unlock !== 'function') {
		// The key lock is a storage-engine feature (RocksDB). Without it, run
		// unlocked, as transitions did before the lock existed, rather than fail.
		if (!warnedNoLock) console.warn('table store has no key lock; pool transitions run unlocked');
		warnedNoLock = true;
		return transaction(context, () => body(context));
	}
	const locks = store as KeyLocks;
	let staleAt = Date.now() + POOL_LOCK_STALE_MS;
	for (;;) {
		let wake: () => void = () => {};
		const released = new Promise<void>((resolve) => (wake = resolve));
		if (locks.tryLock(POOL_LOCK, () => wake())) break;
		const remaining = staleAt - Date.now();
		if (remaining <= 0) {
			console.warn('pool lock held past its stale limit; breaking it');
			locks.unlock(POOL_LOCK);
			// Restart the clock: whoever wins the freed lock is a live holder.
			staleAt = Date.now() + POOL_LOCK_STALE_MS;
			continue;
		}
		let timer: ReturnType<typeof setTimeout> | undefined;
		await Promise.race([
			released,
			new Promise((resolve) => (timer = setTimeout(resolve, remaining))),
		]);
		clearTimeout(timer);
	}
	try {
		return await transaction(context, () => body(context));
	} finally {
		locks.unlock(POOL_LOCK);
	}
}

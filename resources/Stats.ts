/** Pool status counts for the directory legend. GET /api/stats */
import { currentUser, OpenResource } from './shared/auth.ts';
import { getClaims } from './Settings.ts';
import { query, SYSTEM, Task, type TaskRecord } from './shared/harper.ts';

export class Stats extends OpenResource {
	static async get() {
		const counts: Record<string, number> = { available: 0, claimed: 0, completed: 0 };
		// A hidden pool keeps its size to itself, matching /api/tasks.
		const claims = await getClaims();
		if (claims.hidden && !(await currentUser())?.isAdmin) {
			return { ...counts, total: 0, localData: Boolean(process.env.LOCAL_DATA_FILE) };
		}
		for await (const task of Task.search(
			query({ select: ['id', 'status'] }),
			SYSTEM,
		) as AsyncIterable<TaskRecord>) {
			if (counts[task.status] !== undefined) counts[task.status] += 1;
		}
		return {
			...counts,
			total: counts.available + counts.claimed + counts.completed,
			// True when the pool was bootstrapped from LOCAL_DATA_FILE, so the UI
			// can label a file-loaded pool as such.
			localData: Boolean(process.env.LOCAL_DATA_FILE),
		};
	}
}

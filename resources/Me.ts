/**
 * The signed-in attendee: identity, active task, and completed history.
 * GET /api/me — { user: null, ... } for anonymous visitors, never an error.
 */
import { currentUser, restrictionOf, OpenResource } from './shared/auth.ts';
import { findActiveTask } from './shared/tasks.ts';
import { query, SYSTEM, Task, type TaskRecord } from './shared/harper.ts';

export class Me extends OpenResource {
	static async get() {
		const user = await currentUser();
		if (!user) return { user: null, activeTask: null, completed: [] };

		const completed: TaskRecord[] = [];
		const results = Task.search(
			query({ conditions: [{ attribute: 'completedBy', value: user.id }] }),
			SYSTEM,
		) as AsyncIterable<TaskRecord>;
		for await (const task of results) completed.push(task);
		completed.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

		return {
			user: {
				login: user.id,
				name: user.name,
				avatarUrl: user.avatarUrl,
				isAdmin: Boolean(user.isAdmin),
				restriction: restrictionOf(user),
			},
			activeTask: await findActiveTask(user.id),
			completed,
		};
	}
}

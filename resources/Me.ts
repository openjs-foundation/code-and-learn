/**
 * The signed-in attendee: identity, active task, and completed history.
 * GET /api/me — { user: null, ... } for anonymous visitors, never an error.
 * Adds `devSignIn: true` when local dev sign-in is on and this request may use
 * it, so the nav can offer it without probing for the dev routes on every page.
 */
import { currentUser, restrictionOf, OpenResource } from './shared/auth.ts';
import { findActiveTask } from './shared/tasks.ts';
import { query, SYSTEM, Task, type TaskRecord } from './shared/harper.ts';
import { devSignInAllowed } from './dev/DevSignIn.ts';

export class Me extends OpenResource {
	static async get() {
		const devFlag = devSignInAllowed() ? { devSignIn: true } : {};
		const user = await currentUser();
		if (!user) return { user: null, activeTask: null, completed: [], ...devFlag };

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
			...devFlag,
		};
	}
}

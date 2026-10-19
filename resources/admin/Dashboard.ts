/**
 * Participant roster + moderation for the admin section.
 * GET /api/admin/participants — everyone who signed in, with activity.
 * POST — ban / unban / timeout / clear-timeout.
 */
import { json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { query, SYSTEM, Task, User, type TaskRecord, type UserRecord } from '../shared/harper.ts';

export class Dashboard extends OpenResource {
	static async get() {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const activeByLogin = new Map<string, { id: string; title: string }>();
		const completedByLogin = new Map<string, number>();
		const taskFields = query({ select: ['id', 'title', 'status', 'assignedTo', 'completedBy'] });
		for await (const task of Task.search(taskFields, SYSTEM) as AsyncIterable<TaskRecord>) {
			if (task.status === 'claimed' && task.assignedTo) {
				activeByLogin.set(task.assignedTo, { id: task.id, title: task.title });
			}
			if (task.completedBy) {
				completedByLogin.set(task.completedBy, (completedByLogin.get(task.completedBy) ?? 0) + 1);
			}
		}

		const participants: {
			login: string;
			name?: string;
			avatarUrl?: string | null;
			isAdmin: boolean;
			bannedAt: number | null;
			banReason: string | null;
			timeoutUntil: number | null;
			joinedAt: number | null;
			activeTask: { id: string; title: string } | null;
			completedCount: number;
		}[] = [];
		for await (const user of User.search(
			query({
				select: [
					'id',
					'name',
					'avatarUrl',
					'isAdmin',
					'bannedAt',
					'banReason',
					'timeoutUntil',
					'createdAt',
				],
			}),
			SYSTEM,
		) as AsyncIterable<UserRecord>) {
			participants.push({
				login: user.id,
				name: user.name,
				avatarUrl: user.avatarUrl,
				isAdmin: Boolean(user.isAdmin),
				bannedAt: user.bannedAt ?? null,
				banReason: user.banReason ?? null,
				timeoutUntil:
					user.timeoutUntil && user.timeoutUntil > Date.now() ? user.timeoutUntil : null,
				joinedAt: user.createdAt ?? null,
				activeTask: activeByLogin.get(user.id) ?? null,
				completedCount: completedByLogin.get(user.id) ?? 0,
			});
		}
		participants.sort((a, b) => a.login.localeCompare(b.login));
		return { participants };
	}

	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const body = ((await data) ?? {}) as {
			login?: unknown;
			action?: unknown;
			reason?: unknown;
			minutes?: unknown;
		};
		const login = String(body.login ?? '')
			.trim()
			.toLowerCase();
		const action = body.action;
		if (!login) return json(400, { error: 'login is required' });

		const target = (await User.get(login, SYSTEM)) as UserRecord | undefined;
		if (!target) return json(404, { error: 'participant_not_found' });

		if (action === 'ban') {
			if (target.isAdmin) return json(409, { error: 'cannot_restrict_admin' });
			const reason = String(body.reason ?? '')
				.trim()
				.slice(0, 300);
			await User.patch(
				login,
				{ bannedAt: Date.now(), banReason: reason || null, timeoutUntil: null },
				SYSTEM,
			);
			return json(200, { ok: true });
		}
		if (action === 'unban') {
			await User.patch(login, { bannedAt: null, banReason: null }, SYSTEM);
			return json(200, { ok: true });
		}
		if (action === 'timeout') {
			if (target.isAdmin) return json(409, { error: 'cannot_restrict_admin' });
			const minutes = Number(body.minutes);
			if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) {
				return json(400, { error: 'minutes must be between 1 and 1440' });
			}
			await User.patch(login, { timeoutUntil: Date.now() + minutes * 60 * 1000 }, SYSTEM);
			return json(200, { ok: true });
		}
		if (action === 'clear-timeout') {
			await User.patch(login, { timeoutUntil: null }, SYSTEM);
			return json(200, { ok: true });
		}
		return json(400, { error: 'action must be ban, unban, timeout, or clear-timeout' });
	}
}

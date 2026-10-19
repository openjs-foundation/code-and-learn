/**
 * Attendee progress transitions on the active task:
 * - POST /api/release        — put it back in the pool
 * - POST /api/complete       — submit evidence (PR link) and finish
 * - POST /api/uncompletable  — report it impossible; parks it for admin review
 *
 * Each runs under the pool lock, so it can't interleave with a claim or an
 * organizer reassigning the same task.
 */
import { currentUser, json, restrictionOf, sessionLogin, OpenResource } from './shared/auth.ts';
import { findActiveTask, isHttpUrl, withPoolLock } from './shared/tasks.ts';
import { SYSTEM, Task } from './shared/harper.ts';

export class ReleaseTask extends OpenResource {
	static async post() {
		const login = sessionLogin();
		if (!login) return json(401, { error: 'sign_in_required' });

		return withPoolLock(async (context) => {
			const active = await findActiveTask(login, context);
			if (!active) return json(409, { error: 'no_active_task' });

			await Task.patch(
				active.id,
				{
					status: 'available',
					assignedTo: null,
					assignedName: null,
					assignedAt: null,
				},
				context,
			);
			return json(200, { ok: true });
		});
	}
}

export class CompleteTask extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const login = sessionLogin();
		if (!login) return json(401, { error: 'sign_in_required' });

		const restriction = restrictionOf(await currentUser());
		if (restriction) return json(403, { error: 'restricted', ...restriction });

		const { evidenceUrl } = ((await data) ?? {}) as { evidenceUrl?: unknown };
		if (!isHttpUrl(evidenceUrl)) {
			return json(400, {
				error: 'evidence_url_required',
				hint: 'Provide a link, e.g. your open pull request.',
			});
		}

		// Resolves to the completed task's id, or the refusal to send back.
		const outcome = await withPoolLock(async (context): Promise<string | Response> => {
			const active = await findActiveTask(login, context);
			if (!active) return json(409, { error: 'no_active_task' });

			await Task.patch(
				active.id,
				{
					status: 'completed',
					completedBy: login,
					completedAt: Date.now(),
					evidenceUrl: String(evidenceUrl),
					assignedTo: null,
					assignedName: null,
					assignedAt: null,
				},
				context,
			);
			return active.id;
		});
		if (outcome instanceof Response) return outcome;
		return json(200, { ok: true, task: await Task.get(outcome, SYSTEM) });
	}
}

export class ReportUncompletable extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const login = sessionLogin();
		if (!login) return json(401, { error: 'sign_in_required' });

		const restriction = restrictionOf(await currentUser());
		if (restriction) return json(403, { error: 'restricted', ...restriction });

		const body = ((await data) ?? {}) as { reason?: unknown };
		const reason = String(body.reason ?? '').trim();
		if (reason.length < 3) {
			return json(400, {
				error: 'reason_required',
				hint: 'Say what makes this task impossible to complete.',
			});
		}

		return withPoolLock(async (context) => {
			const active = await findActiveTask(login, context);
			if (!active) return json(409, { error: 'no_active_task' });

			await Task.patch(
				active.id,
				{
					status: 'flagged',
					uncompletableReason: reason.slice(0, 500),
					uncompletableBy: login,
					uncompletableAt: Date.now(),
					assignedTo: null,
					assignedName: null,
					assignedAt: null,
				},
				context,
			);
			return json(200, { ok: true });
		});
	}
}

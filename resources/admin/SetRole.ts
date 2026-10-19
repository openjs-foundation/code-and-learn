/**
 * Admin roster management. GET /api/admin/admins lists admins; POST promotes
 * a login; DELETE /:login demotes (guarding the env allowlist and the last
 * admin).
 */
import { adminAllowlist, json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { query, record, SYSTEM, User, type UserRecord } from '../shared/harper.ts';

export class SetRole extends OpenResource {
	static async get() {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const admins: { login: string; name?: string; avatarUrl?: string | null }[] = [];
		for await (const user of User.search(
			query({ conditions: [{ attribute: 'isAdmin', value: true }] }),
			SYSTEM,
		) as AsyncIterable<UserRecord>) {
			admins.push({ login: user.id, name: user.name, avatarUrl: user.avatarUrl });
		}
		admins.sort((a, b) => a.login.localeCompare(b.login));
		return { admins, seededFromEnv: adminAllowlist() };
	}

	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const body = ((await data) ?? {}) as { login?: unknown };
		const login = String(body.login ?? '')
			.trim()
			.toLowerCase();
		if (!login) return json(400, { error: 'login is required' });

		const existing = (await User.get(login, SYSTEM)) as UserRecord | undefined;
		// Patch an existing user so the rest of their record (moderation state)
		// survives; put only creates the placeholder for a not-yet-seen login.
		if (existing) {
			await User.patch(login, { isAdmin: true }, SYSTEM);
		} else {
			await User.put(record({ id: login, name: login, avatarUrl: null, isAdmin: true }), SYSTEM);
		}
		return json(200, { ok: true });
	}

	static async delete(target: { id?: string }) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const login = String(target.id ?? '')
			.trim()
			.toLowerCase();
		if (!login) return json(400, { error: 'login is required' });
		if (adminAllowlist().includes(login)) {
			return json(409, {
				error: 'seeded_admin',
				hint: 'Remove them from ADMIN_GITHUB_LOGINS first; the allowlist re-promotes on sign-in.',
			});
		}

		const existing = (await User.get(login, SYSTEM)) as UserRecord | undefined;
		if (!existing?.isAdmin) return json(404, { error: 'not_an_admin' });

		let adminCount = 0;
		for await (const _ of User.search(
			query({ conditions: [{ attribute: 'isAdmin', value: true }], select: ['id'] }),
			SYSTEM,
		) as AsyncIterable<UserRecord>) {
			adminCount += 1;
		}
		if (adminCount <= 1) return json(409, { error: 'last_admin' });

		await User.patch(login, { isAdmin: false }, SYSTEM);
		return json(200, { ok: true });
	}
}

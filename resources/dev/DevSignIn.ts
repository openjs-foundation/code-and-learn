/**
 * Local-only sign-in as a test user, standing in for GitHub OAuth during
 * development and tests.
 *
 * POST /api/dev/login { as } signs the caller's session in as that login. An
 * unknown login is created as a plain attendee; admins and restricted users
 * come from fixtures (LOCAL_SEED). GET /api/dev/users lists the users you can
 * sign in as. Sign out the usual way: POST /oauth/logout.
 *
 * Sign-in is a POST, not a link: the SSR handler claims every browser
 * navigation (Accept: text/html) outside /oauth, so a GET from the address bar
 * would never reach this resource. The nav's Dev menu posts, then reloads.
 *
 * Off unless LOCAL_DEV_SIGN_IN=true on a local instance (shared/local.ts), and
 * only for logins containing "_", which GitHub usernames can't: even switched
 * on in the wrong place, it can never act as a real account. When off, the
 * routes aren't registered at all (index.ts).
 */
import { getContext } from 'harper';
import { json, OpenResource } from '../shared/auth.ts';
import { isLocalInstance } from '../shared/local.ts';
import { query, record, SYSTEM, User, type UserRecord } from '../shared/harper.ts';

const requested = process.env.LOCAL_DEV_SIGN_IN === 'true';
export const DEV_SIGN_IN = requested && isLocalInstance();
if (requested && !DEV_SIGN_IN) {
	console.error(
		`LOCAL_DEV_SIGN_IN ignored: OAUTH_REDIRECT_URI (${process.env.OAUTH_REDIRECT_URI}) is not a local origin.`,
	);
}

// Lowercase alphanumerics and hyphens with at least one "_" separator, e.g.
// fx_alice: never a valid GitHub username.
const DEV_LOGIN = /^[a-z0-9-]+(_[a-z0-9-]+)+$/;

export function isDevLogin(login: string): boolean {
	return DEV_LOGIN.test(login);
}

interface SessionContext {
	session?: { update?: (_data: object) => Promise<void> };
}

export class DevSignIn extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		if (!DEV_SIGN_IN) return json(404, { error: 'not_found' });

		const body = ((await data) ?? {}) as { as?: unknown };
		const login = String(body.as ?? '')
			.trim()
			.toLowerCase();
		if (!isDevLogin(login)) {
			return json(400, {
				error: 'dev_login_invalid',
				hint: 'Dev sign-in only accepts logins with an underscore, like fx_alice.',
			});
		}

		if (!(await User.get(login, SYSTEM))) {
			await User.put(record({ id: login, name: login, avatarUrl: null, isAdmin: false }), SYSTEM);
		}

		const session = (getContext() as SessionContext | undefined)?.session;
		if (typeof session?.update !== 'function') {
			return json(500, {
				error: 'sessions_unavailable',
				hint: 'Enable sessions (authentication.enableSessions) to use dev sign-in.',
			});
		}
		await session.update({ user: login });

		return json(200, { ok: true, login });
	}
}

export class DevUsers extends OpenResource {
	static async get() {
		if (!DEV_SIGN_IN) return json(404, { error: 'not_found' });

		const users: { login: string; name?: string; isAdmin: boolean }[] = [];
		for await (const user of User.search(
			query({ select: ['id', 'name', 'isAdmin'] }),
			SYSTEM,
		) as AsyncIterable<UserRecord>) {
			if (isDevLogin(user.id)) {
				users.push({ login: user.id, name: user.name, isAdmin: Boolean(user.isAdmin) });
			}
		}
		users.sort((a, b) => a.login.localeCompare(b.login));
		return { users };
	}
}

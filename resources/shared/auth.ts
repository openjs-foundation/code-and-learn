/**
 * Session + authorization helpers.
 *
 * Harper's table RBAC is not applied to custom resource handlers — every
 * handler gates itself with these. There is no framework-level net beneath.
 */
import { getContext } from 'harper';
import { ResourceBase, SYSTEM, User, type UserRecord } from './harper.ts';

export function adminAllowlist(): string[] {
	return (process.env.ADMIN_GITHUB_LOGINS || '')
		.split(',')
		.map((login) => login.trim().toLowerCase())
		.filter(Boolean);
}

export function sessionLogin(): string | null {
	const context = getContext() as { session?: { user?: unknown } } | undefined;
	const login = context?.session?.user;
	if (typeof login === 'string' && login) return login.toLowerCase();
	return null;
}

export async function currentUser(): Promise<UserRecord | null> {
	const login = sessionLogin();
	if (!login) return null;
	return ((await User.get(login, SYSTEM)) as UserRecord | undefined) ?? null;
}

export interface Restriction {
	kind: 'banned' | 'timeout';
	reason?: string | null;
	until?: number;
}

// A banned or timed-out participant may browse and release, but not claim,
// complete, or file reports. Returns null when unrestricted.
export function restrictionOf(user: UserRecord | null): Restriction | null {
	if (!user) return null;
	if (user.bannedAt) return { kind: 'banned', reason: user.banReason ?? null };
	if (user.timeoutUntil && user.timeoutUntil > Date.now()) {
		return { kind: 'timeout', until: user.timeoutUntil };
	}
	return null;
}

// Base for every custom API resource: Harper's entry-level permission checks
// are waved through, because each handler performs its own authorization
// (sessionLogin / requireAdmin) and unimplemented methods 405 anyway.
export class OpenResource extends ResourceBase {
	allowRead() {
		return true;
	}
	allowCreate() {
		return true;
	}
	allowUpdate() {
		return true;
	}
	allowDelete() {
		return true;
	}
}

export function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

export async function requireAdmin(): Promise<{ user?: UserRecord; error?: Response }> {
	const user = await currentUser();
	if (!user) return { error: json(401, { error: 'sign_in_required' }) };
	if (!user.isAdmin) return { error: json(403, { error: 'admin_only' }) };
	return { user };
}

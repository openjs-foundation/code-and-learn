/**
 * GitHub OAuth integration: provision or refresh the User record on every
 * sign-in. Returning { user: login } sets the session identity every resource
 * reads back through sessionLogin().
 */
import { registerHooks } from '@harperfast/oauth';
import { record, SYSTEM, User, type UserRecord } from './shared/harper.ts';
import { adminAllowlist } from './shared/auth.ts';

interface OAuthUser {
	username?: string;
	name?: string;
	metadata?: { oauthClaims?: { login?: string; name?: string; avatar_url?: string } };
}

registerHooks({
	onLogin: async (oauthUser: OAuthUser) => {
		const claims = oauthUser?.metadata?.oauthClaims ?? {};
		const login = String(oauthUser?.username || claims.login || '')
			.trim()
			.toLowerCase();
		if (!login) return { status: 'denied', error: 'missing_github_login' };

		const existing = (await User.get(login, SYSTEM)) as UserRecord | undefined;
		const profile = {
			name: oauthUser?.name || claims.name || existing?.name || login,
			avatarUrl: claims.avatar_url || existing?.avatarUrl || null,
			isAdmin: Boolean(existing?.isAdmin) || adminAllowlist().includes(login),
		};
		// Patch, never put, a returning user: put replaces the whole record, which
		// would drop moderation state (ban, timeout) on every sign-in.
		if (existing) await User.patch(login, profile, SYSTEM);
		else await User.put(record({ id: login, ...profile }), SYSTEM);
		return { status: 'ok', user: login };
	},
});

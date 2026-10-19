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
		await User.put(
			record({
				id: login,
				name: oauthUser?.name || claims.name || existing?.name || login,
				avatarUrl: claims.avatar_url || existing?.avatarUrl || null,
				isAdmin: Boolean(existing?.isAdmin) || adminAllowlist().includes(login),
			}),
			SYSTEM,
		);
		return { status: 'ok', user: login };
	},
});

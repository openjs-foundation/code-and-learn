import { useEffect, useState } from 'react';
import { getJson, postJson } from '../lib/api.js';

// Local development only: sign in as, or switch to, any dev user
// (resources/dev/DevSignIn.ts). The nav renders this only when /api/me
// reports dev sign-in is on.
export default function DevSignInMenu({ currentLogin }) {
	const [users, setUsers] = useState(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		getJson('/api/dev/users')
			.then((data) => setUsers(data?.users ?? []))
			.catch(() => setUsers([]));
	}, []);

	if (!users?.length) return null;

	// On failure the select snaps back to the current user (it's controlled)
	// and the server's hint shows next to it.
	async function signInAs(login) {
		if (!login || login === currentLogin) return;
		setError(null);
		try {
			await postJson('/api/dev/login', { as: login });
			location.reload();
		} catch (failure) {
			setError(failure.body?.hint ?? failure.message ?? 'Dev sign-in failed.');
		}
	}

	const isDevUser = users.some((user) => user.login === currentLogin);
	return (
		<label className="cl-dev-signin">
			<span className="cl-dev-signin-badge">Dev</span>
			<select
				value={isDevUser ? currentLogin : ''}
				onChange={(event) => signInAs(event.target.value)}
				aria-label="Dev sign-in: sign in as a test user"
			>
				<option value="">{currentLogin ? 'Switch user…' : 'Sign in as…'}</option>
				{users.map((user) => (
					<option key={user.login} value={user.login}>
						{user.login}
						{user.isAdmin ? ' (admin)' : ''}
					</option>
				))}
			</select>
			{error ? (
				<span className="cl-dev-signin-error" role="alert">
					{error}
				</span>
			) : null}
		</label>
	);
}

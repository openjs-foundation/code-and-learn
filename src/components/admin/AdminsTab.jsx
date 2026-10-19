import { useEffect, useState } from 'react';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import { getJson, postJson, deleteJson } from '../../lib/api.js';
import { useParticipants, ParticipantDatalist } from './shared.jsx';

export default function AdminsTab({ myLogin }) {
	const participants = useParticipants();
	const [data, setData] = useState(null);
	const [login, setLogin] = useState('');
	const [error, setError] = useState(null);
	const [busy, setBusy] = useState(false);

	async function load() {
		try {
			setData(await getJson('/api/admin/admins'));
		} catch {
			setError('Could not load the admin list.');
		}
	}

	useEffect(() => {
		load();
	}, []);

	if (!data) {
		return (
			<Skeleton loading>
				<div style={{ height: '8rem' }} />
			</Skeleton>
		);
	}

	return (
		<div style={{ maxWidth: '36rem' }}>
			<p style={{ color: 'var(--cl-fg-soft)' }}>
				Admins can edit tasks, unassign people, and promote other admins. Logins listed in{' '}
				<code>ADMIN_GITHUB_LOGINS</code> are re-promoted every time they sign in.
			</p>
			<form
				className="cl-form-row"
				onSubmit={async (event) => {
					event.preventDefault();
					setBusy(true);
					setError(null);
					try {
						await postJson('/api/admin/admins', { login });
						setLogin('');
						await load();
					} catch (submitError) {
						setError(submitError.body?.error || 'Promoting failed.');
					} finally {
						setBusy(false);
					}
				}}
			>
				<ParticipantDatalist id="cl-promote-list" participants={participants} />
				<input
					className="cl-input"
					placeholder="github-login"
					aria-label="GitHub login to promote"
					list="cl-promote-list"
					required
					value={login}
					onChange={(event) => setLogin(event.target.value)}
				/>
				<BaseButton as="button" type="submit" size="small" disabled={busy}>
					Make admin
				</BaseButton>
			</form>
			{error ? <p className="cl-error-text">{error}</p> : null}
			<ul className="cl-history">
				{data.admins.map((admin) => (
					<li key={admin.login}>
						{admin.avatarUrl ? (
							<img className="cl-avatar" src={admin.avatarUrl} alt="" width="28" height="28" />
						) : null}
						<span>
							{admin.login}
							{admin.login === myLogin ? ' (you)' : ''}
							{data.seededFromEnv.includes(admin.login) ? (
								<span className="cl-chip" style={{ marginLeft: '0.5rem' }}>
									env
								</span>
							) : null}
						</span>
						{!data.seededFromEnv.includes(admin.login) && admin.login !== myLogin ? (
							<button
								type="button"
								className="cl-btn-quiet cl-btn-quiet--danger"
								style={{ marginLeft: 'auto' }}
								onClick={async () => {
									try {
										await deleteJson(`/api/admin/admins/${admin.login}`);
										await load();
									} catch (removeError) {
										setError(
											removeError.body?.error === 'last_admin'
												? 'You cannot remove the last admin.'
												: 'Removing failed.',
										);
									}
								}}
							>
								Remove
							</button>
						) : null}
					</li>
				))}
			</ul>
		</div>
	);
}

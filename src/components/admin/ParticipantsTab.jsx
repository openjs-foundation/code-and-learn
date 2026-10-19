import { useEffect, useState } from 'react';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import Select from '@node-core/ui-components/Common/Select';
import { getJson, postJson } from '../../lib/api.js';
import { formatWhen } from './shared.jsx';

const TIMEOUT_OPTIONS = [
	{ label: '15 minutes', value: '15' },
	{ label: '1 hour', value: '60' },
	{ label: 'Rest of the day', value: '480' },
];

export default function ParticipantsTab({ myLogin }) {
	const [data, setData] = useState(null);
	const [error, setError] = useState(null);
	const [banning, setBanning] = useState(null); // login being banned
	const [banReason, setBanReason] = useState('');
	const [timeoutFor, setTimeoutFor] = useState(null); // login being timed out
	const [timeoutMinutes, setTimeoutMinutes] = useState('15');

	async function load() {
		try {
			setData(await getJson('/api/admin/participants'));
		} catch {
			setError('Could not load participants.');
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

	async function act(login, action, extra = {}) {
		setError(null);
		try {
			await postJson('/api/admin/participants', { login, action, ...extra });
			setBanning(null);
			setBanReason('');
			setTimeoutFor(null);
			await load();
		} catch (actionError) {
			setError(
				actionError.body?.error === 'cannot_restrict_admin'
					? 'Admins cannot be banned or timed out. Demote them first.'
					: 'That action failed. Reload and try again.',
			);
		}
	}

	return (
		<div>
			<p style={{ color: 'var(--cl-fg-soft)', maxWidth: '62ch' }}>
				Everyone who has signed in. A ban blocks claiming, completing, and reporting until you lift
				it; a timeout does the same for a fixed stretch. Both leave browsing open.
			</p>
			{error ? <p className="cl-error-text">{error}</p> : null}
			<div className="cl-table-wrap">
				<table className="cl-table" data-cards="false">
					<thead>
						<tr>
							<th>Participant</th>
							<th>Status</th>
							<th>Working on</th>
							<th>Completed</th>
							<th aria-label="Actions" />
						</tr>
					</thead>
					<tbody>
						{data.participants.map((person) => (
							<tr key={person.login}>
								<td>
									<span className="cl-signin-cta">
										{person.avatarUrl ? (
											<img
												className="cl-avatar"
												src={person.avatarUrl}
												alt=""
												width="28"
												height="28"
											/>
										) : null}
										<span>
											{person.login}
											{person.login === myLogin ? ' (you)' : ''}
											{person.isAdmin ? (
												<span className="cl-chip" style={{ marginLeft: '0.5rem' }}>
													admin
												</span>
											) : null}
										</span>
									</span>
								</td>
								<td>
									{person.bannedAt ? (
										<span className="cl-status cl-status--flagged">
											Banned{person.banReason ? ` (${person.banReason.slice(0, 40)})` : ''}
										</span>
									) : person.timeoutUntil ? (
										<span className="cl-status cl-status--claimed">
											Timeout until {formatWhen(person.timeoutUntil)}
										</span>
									) : (
										<span style={{ color: 'var(--cl-fg-faint)' }}>Active</span>
									)}
								</td>
								<td>
									{person.activeTask ? (
										<a href={`/tasks/${person.activeTask.id}`}>
											{person.activeTask.title.slice(0, 40)}
										</a>
									) : (
										'—'
									)}
								</td>
								<td className="cl-time">{person.completedCount}</td>
								<td>
									<div className="cl-table-actions">
										{person.bannedAt ? (
											<button
												type="button"
												className="cl-btn-quiet"
												onClick={() => act(person.login, 'unban')}
											>
												Unban
											</button>
										) : person.timeoutUntil ? (
											<button
												type="button"
												className="cl-btn-quiet"
												onClick={() => act(person.login, 'clear-timeout')}
											>
												Clear timeout
											</button>
										) : person.isAdmin ? null : (
											<>
												<button
													type="button"
													className="cl-btn-quiet"
													onClick={() => {
														setTimeoutFor(person.login);
														setBanning(null);
													}}
												>
													Timeout
												</button>
												<button
													type="button"
													className="cl-btn-quiet cl-btn-quiet--danger"
													onClick={() => {
														setBanning(person.login);
														setTimeoutFor(null);
													}}
												>
													Ban
												</button>
											</>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{banning ? (
				<form
					className="cl-panel"
					style={{ marginTop: '1rem', maxWidth: '36rem' }}
					onSubmit={(event) => {
						event.preventDefault();
						act(banning, 'ban', { reason: banReason });
					}}
				>
					<h2>Ban {banning}</h2>
					<div className="cl-field">
						<label htmlFor="ban-reason">Reason (shown to other admins)</label>
						<input
							id="ban-reason"
							className="cl-input"
							value={banReason}
							onChange={(event) => setBanReason(event.target.value)}
						/>
					</div>
					<div className="cl-actions">
						<BaseButton as="button" type="submit" kind="warning" size="small">
							Ban participant
						</BaseButton>
						<button type="button" className="cl-btn-quiet" onClick={() => setBanning(null)}>
							Cancel
						</button>
					</div>
				</form>
			) : null}

			{timeoutFor ? (
				<form
					className="cl-panel"
					style={{ marginTop: '1rem', maxWidth: '36rem' }}
					onSubmit={(event) => {
						event.preventDefault();
						act(timeoutFor, 'timeout', { minutes: Number(timeoutMinutes) });
					}}
				>
					<h2>Timeout {timeoutFor}</h2>
					<div className="cl-field">
						<span className="cl-field-label">Length</span>
						<Select values={TIMEOUT_OPTIONS} value={timeoutMinutes} onChange={setTimeoutMinutes} />
					</div>
					<div className="cl-actions">
						<BaseButton as="button" type="submit" kind="warning" size="small">
							Start timeout
						</BaseButton>
						<button type="button" className="cl-btn-quiet" onClick={() => setTimeoutFor(null)}>
							Cancel
						</button>
					</div>
				</form>
			) : null}
		</div>
	);
}

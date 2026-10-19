import { useEffect, useMemo, useState } from 'react';
import Badge from '@node-core/ui-components/Common/Badge';
import Select from '@node-core/ui-components/Common/Select';
import Switch from '@node-core/ui-components/Common/Switch';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import AlertBox from '@node-core/ui-components/Common/AlertBox';
import { getJson } from '../lib/api.js';
import { useTasks, poolTasks } from '../lib/taskStore.js';

const DIFFICULTY_BADGE = { beginner: 'default', intermediate: 'warning', advanced: 'error' };
const STATUS_TEXT = { available: 'Open', claimed: 'In progress', completed: 'Done' };
const ANY = 'any';

const TIME_OPTIONS = [
	{ label: 'Any length', value: ANY },
	{ label: 'Up to 30 min', value: '30' },
	{ label: 'Up to 1 hour', value: '60' },
	{ label: 'Up to 2 hours', value: '120' },
];

function titleCase(value) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function StatusIcon({ status }) {
	// Drawn in one stroke vocabulary: open ring, half-filled ring, filled check.
	if (status === 'completed') {
		return (
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<circle
					cx="8"
					cy="8"
					r="6.5"
					fill="var(--cl-done)"
					stroke="var(--cl-done)"
					strokeWidth="1.5"
				/>
				<path
					d="M5 8.2l2.1 2.1L11 6.4"
					fill="none"
					stroke="var(--cl-bg)"
					strokeWidth="1.7"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}
	if (status === 'claimed') {
		return (
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<circle cx="8" cy="8" r="6.5" fill="none" stroke="var(--cl-held)" strokeWidth="1.5" />
				<path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="var(--cl-held)" />
			</svg>
		);
	}
	return (
		<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
			<circle cx="8" cy="8" r="6.5" fill="none" stroke="var(--cl-open)" strokeWidth="1.5" />
		</svg>
	);
}

function readFiltersFromUrl() {
	const params = new URLSearchParams(location.search);
	return {
		query: params.get('q') ?? '',
		difficulty: params.get('difficulty') ?? ANY,
		area: params.get('area') ?? ANY,
		skill: params.get('skill') ?? ANY,
		time: params.get('time') ?? ANY,
		openOnly: params.get('open') === '1',
	};
}

const DEFAULT_FILTERS = {
	query: '',
	difficulty: ANY,
	area: ANY,
	skill: ANY,
	time: ANY,
	openOnly: false,
};

export default function TaskDirectory() {
	const { tasks, status } = useTasks();
	const [filters, setFilters] = useState(DEFAULT_FILTERS);
	const [claims, setClaims] = useState(null);

	useEffect(() => {
		setFilters(readFiltersFromUrl());
	}, []);

	useEffect(() => {
		getJson('/api/settings')
			.then((data) => setClaims(data.claims))
			.catch(() => {});
	}, []);

	// Admins see the pool through a pause or hide, so tell them their screen
	// differs from the room's. /api/me is only fetched in those two states —
	// no polling, no extra weight on the ordinary path.
	const [isAdmin, setIsAdmin] = useState(false);
	useEffect(() => {
		if (!claims?.paused && !claims?.hidden) return;
		getJson('/api/me')
			.then((data) => setIsAdmin(Boolean(data?.user?.isAdmin)))
			.catch(() => {});
	}, [claims?.paused, claims?.hidden]);

	// Keep filters shareable: reflect them into the URL without history spam.
	useEffect(() => {
		const params = new URLSearchParams();
		if (filters.query) params.set('q', filters.query);
		if (filters.difficulty !== ANY) params.set('difficulty', filters.difficulty);
		if (filters.area !== ANY) params.set('area', filters.area);
		if (filters.skill !== ANY) params.set('skill', filters.skill);
		if (filters.time !== ANY) params.set('time', filters.time);
		if (filters.openOnly) params.set('open', '1');
		const search = params.toString();
		history.replaceState(null, '', search ? `?${search}` : location.pathname);
	}, [filters]);

	const areas = useMemo(() => {
		const set = new Set(
			poolTasks(tasks)
				.map((task) => task.area)
				.filter(Boolean),
		);
		return [...set].sort();
	}, [tasks]);

	const skills = useMemo(() => {
		const set = new Set(poolTasks(tasks).flatMap((task) => task.skills ?? []));
		return [...set].sort();
	}, [tasks]);

	const visible = useMemo(() => {
		if (!tasks) return [];
		const query = filters.query.trim().toLowerCase();
		const list = poolTasks(tasks).filter((task) => {
			if (filters.openOnly && task.status !== 'available') return false;
			if (filters.difficulty !== ANY && task.difficulty !== filters.difficulty) return false;
			if (filters.area !== ANY && task.area !== filters.area) return false;
			if (filters.skill !== ANY && !(task.skills ?? []).includes(filters.skill)) return false;
			if (filters.time !== ANY && (task.estimatedMinutes ?? 0) > Number(filters.time)) return false;
			if (query) {
				const haystack =
					`${task.title} ${task.summary} ${task.area} ${(task.skills ?? []).join(' ')}`.toLowerCase();
				if (!haystack.includes(query)) return false;
			}
			return true;
		});
		// Open tasks first, then in-progress, done last; stable by title inside groups.
		const rank = { available: 0, claimed: 1, completed: 2 };
		return list.sort(
			(a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.title.localeCompare(b.title),
		);
	}, [tasks, filters]);

	const set = (patch) => setFilters((current) => ({ ...current, ...patch }));

	// "Minutes to a fitting task": jump straight into a random open task that
	// matches the current filters, for people who would rather not browse.
	const openVisible = visible.filter((task) => task.status === 'available');
	function pickRandom() {
		if (!openVisible.length) return;
		const choice = openVisible[Math.floor(Math.random() * openVisible.length)];
		location.assign(`/tasks/${choice.id}`);
	}

	if (status === 'error') {
		return (
			<div style={{ margin: '2rem 0' }}>
				<AlertBox level="danger" title="Error">
					<strong>The task list could not be loaded.</strong> Check your connection and reload the
					page. If it keeps failing, wave down a mentor.
				</AlertBox>
			</div>
		);
	}

	const loading = status !== 'ready' || tasks === null;

	return (
		<section aria-label="Task directory">
			{isAdmin && (claims?.hidden || claims?.paused) ? (
				<p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--cl-fg-soft)' }}>
					{claims.hidden
						? 'Admin view — the pool is hidden from participants until you open it from the Event tab.'
						: 'For participants, claiming is paused right now.'}
				</p>
			) : null}
			<div className="cl-filters">
				<div className="cl-field cl-filter-search">
					<label htmlFor="cl-search">Search</label>
					<input
						id="cl-search"
						className="cl-input"
						type="search"
						placeholder="Search titles, areas, skills…"
						value={filters.query}
						onChange={(event) => set({ query: event.target.value })}
					/>
				</div>
				<div className="cl-field">
					<span className="cl-field-label" id="cl-difficulty-label">
						Difficulty
					</span>
					<Select
						values={[
							{ label: 'Any difficulty', value: ANY },
							{ label: 'Beginner', value: 'beginner' },
							{ label: 'Intermediate', value: 'intermediate' },
							{ label: 'Advanced', value: 'advanced' },
						]}
						value={filters.difficulty}
						onChange={(value) => set({ difficulty: value })}
					/>
				</div>
				<div className="cl-field">
					<span className="cl-field-label">Area</span>
					<Select
						values={[
							{ label: 'Any area', value: ANY },
							...areas.map((area) => ({ label: titleCase(area), value: area })),
						]}
						value={filters.area}
						onChange={(value) => set({ area: value })}
					/>
				</div>
				<div className="cl-field">
					<span className="cl-field-label">Skill</span>
					<Select
						values={[
							{ label: 'Any skill', value: ANY },
							...skills.map((skill) => ({ label: skill, value: skill })),
						]}
						value={filters.skill}
						onChange={(value) => set({ skill: value })}
					/>
				</div>
				<div className="cl-field">
					<span className="cl-field-label">Time</span>
					<Select
						values={TIME_OPTIONS}
						value={filters.time}
						onChange={(value) => set({ time: value })}
					/>
				</div>
				<div className="cl-filter-toggle">
					<Switch
						id="cl-open-only"
						label="Open tasks only"
						checked={filters.openOnly}
						onChange={(event) => set({ openOnly: event.target.checked })}
					/>
					<button
						type="button"
						className="cl-btn-quiet"
						disabled={openVisible.length === 0}
						title="Open a random task that matches your filters"
						onClick={pickRandom}
					>
						Pick one for me
					</button>
				</div>
			</div>

			{loading ? (
				<ul className="cl-worklist" aria-hidden="true">
					{Array.from({ length: 6 }, (_, index) => (
						<li key={index} className="cl-row">
							<div style={{ padding: '0.875rem 0.75rem' }}>
								<Skeleton loading>
									<div style={{ height: '2.6rem' }} />
								</Skeleton>
							</div>
						</li>
					))}
				</ul>
			) : visible.length === 0 ? (
				<div className="cl-empty">
					{poolTasks(tasks).length === 0 ? (
						claims?.hidden ? (
							<p>
								{claims.message || 'The task pool opens when the event starts.'} Reload this page
								when the organizers say go.
							</p>
						) : (
							<p>
								No tasks have been published yet. They appear here the moment an organizer adds
								them, no reload needed.
							</p>
						)
					) : (
						<>
							<p>Nothing matches those filters right now.</p>
							<button
								type="button"
								className="cl-btn-quiet"
								onClick={() => setFilters(DEFAULT_FILTERS)}
							>
								Clear all filters
							</button>
						</>
					)}
				</div>
			) : (
				<ul className="cl-worklist">
					{visible.map((task) => (
						<li
							key={task.id}
							className={`cl-row${task.status !== 'available' ? ' cl-row--muted' : ''}`}
						>
							<a href={`/tasks/${task.id}`}>
								<StatusIcon status={task.status} />
								<span>
									<span className="cl-row-title">{task.title}</span>
									{task.summary ? <p className="cl-row-summary">{task.summary}</p> : null}
								</span>
								<span className="cl-row-meta">
									{task.status !== 'available' ? (
										<span className={`cl-status cl-status--${task.status}`}>
											{STATUS_TEXT[task.status]}
											{task.status === 'claimed' && task.assignedName
												? ` — ${task.assignedName}`
												: ''}
										</span>
									) : null}
									<Badge size="small" kind={DIFFICULTY_BADGE[task.difficulty] ?? 'neutral'}>
										{titleCase(task.difficulty ?? 'unknown')}
									</Badge>
									{task.area ? <span className="cl-chip">{task.area}</span> : null}
									{task.estimatedMinutes ? (
										<span className="cl-time">~{task.estimatedMinutes} min</span>
									) : null}
								</span>
							</a>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

// Shared live task store. Module state is shared across islands on a page, so
// the mosaic and the directory ride one fetch and one WebSocket subscription.
// Strategy: fetch the full task list, then refetch (debounced) whenever the
// /api/tasks subscription reports any change — simple and always consistent.

import { useSyncExternalStore } from 'react';
import { getJson } from './api.js';

const state = {
	tasks: null,
	status: 'idle', // idle | loading | ready | error
	live: false,
	changedIds: new Set(),
};

const listeners = new Set();
let snapshot = { ...state, changedIds: new Set() };
let started = false;
let refetchTimer = null;
let reconnectDelay = 1000;
let flashTimer = null;

function emit() {
	snapshot = { ...state, tasks: state.tasks, changedIds: new Set(state.changedIds) };
	for (const listener of listeners) listener();
}

async function fetchTasks() {
	try {
		if (state.status === 'idle') {
			state.status = 'loading';
			emit();
		}
		const tasks = await getJson('/api/tasks/');
		const previous = state.tasks;
		state.tasks = Array.isArray(tasks) ? tasks : [];
		state.status = 'ready';

		if (previous) {
			const before = new Map(previous.map((task) => [task.id, task]));
			for (const task of state.tasks) {
				const old = before.get(task.id);
				if (!old || old.status !== task.status || old.updatedAt !== task.updatedAt) {
					state.changedIds.add(task.id);
				}
			}
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => {
				state.changedIds.clear();
				emit();
			}, 900);
		}
		emit();
	} catch {
		if (state.status !== 'ready') {
			state.status = 'error';
			emit();
		}
	}
}

function scheduleRefetch() {
	clearTimeout(refetchTimer);
	refetchTimer = setTimeout(fetchTasks, 200);
}

function connect() {
	let socket;
	try {
		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		socket = new WebSocket(`${protocol}//${location.host}/api/tasks/`);
	} catch {
		state.live = false;
		emit();
		return;
	}

	socket.addEventListener('open', () => {
		reconnectDelay = 1000;
		state.live = true;
		emit();
		// The socket was down for a while; catch up.
		scheduleRefetch();
	});
	socket.addEventListener('message', scheduleRefetch);
	socket.addEventListener('close', () => {
		state.live = false;
		emit();
		reconnectDelay = Math.min(reconnectDelay * 2, 15000);
		setTimeout(connect, reconnectDelay);
	});
	socket.addEventListener('error', () => socket.close());
}

function start() {
	if (started || typeof window === 'undefined') return;
	started = true;
	fetchTasks();
	connect();
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) scheduleRefetch();
	});
}

function subscribe(listener) {
	listeners.add(listener);
	start();
	return () => listeners.delete(listener);
}

const serverSnapshot = { tasks: null, status: 'loading', live: false, changedIds: new Set() };

export function useTasks() {
	return useSyncExternalStore(
		subscribe,
		() => snapshot,
		() => serverSnapshot,
	);
}

export function refreshTasks() {
	scheduleRefetch();
}

// Statuses that belong to the public pool. Flagged and uncompletable tasks
// stay in the data (admins work with them) but leave every public surface.
export const POOL_STATUSES = new Set(['available', 'claimed', 'completed']);

export function poolTasks(tasks) {
	return (tasks ?? []).filter((task) => POOL_STATUSES.has(task.status));
}

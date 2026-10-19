/**
 * The public task directory. GET + WebSocket subscribe on /api/tasks — the
 * live pool the mosaic and worklist render. Writes go through the /api/admin
 * endpoints, never through this surface.
 *
 * Collection reads drop the rendered description segments — the directory
 * never shows them, and shipping every task's rendered body to every visitor
 * is weight for nothing. Single-record reads (and the SSR data loader) stay
 * complete.
 *
 * While the pool is hidden (Event tab, before the event starts), non-admin
 * reads see nothing: the collection is empty and single records are absent,
 * and WebSocket subscribers receive no events. Admins keep the full view —
 * their console reads this same surface.
 */
import { currentUser } from './shared/auth.ts';
import { getClaims, isPoolHiddenNow } from './Settings.ts';
import { Task, type TaskRecord } from './shared/harper.ts';

interface SubscriptionRequest {
	eventFilter?: () => boolean;
}

export class AvailableTasks extends Task {
	// Harper consults these as instance methods (REST entry and WebSocket
	// re-authorization both): public read + subscribe, no REST writes.
	allowRead() {
		return true;
	}
	allowCreate() {
		return false;
	}
	allowUpdate() {
		return false;
	}
	allowDelete() {
		return false;
	}

	// WebSocket subscriptions never pass through get() below, and their events
	// carry full records, so the hidden gate has to live here too. It is checked
	// per event rather than once at connect: a socket opened while the pool was
	// open goes quiet the moment it is hidden, and resumes when it reopens.
	async subscribe(request: SubscriptionRequest) {
		if (!(await currentUser())?.isAdmin) {
			request.eventFilter = () => !isPoolHiddenNow();
		}
		return super.subscribe(request as never);
	}

	static async get(target: { id?: string | number }) {
		const claims = await getClaims();
		if (claims.hidden) {
			const user = await currentUser();
			if (!user?.isAdmin) {
				if (target?.id != null) return undefined;
				return (async function* () {})();
			}
		}
		const result = (await super.get(target as never)) as
			AsyncIterable<TaskRecord> | TaskRecord | undefined;
		if (target?.id != null || !result || !(Symbol.asyncIterator in result)) return result;
		return (async function* () {
			for await (const task of result as AsyncIterable<TaskRecord>) {
				const { descriptionRendered: _rendered, ...rest } = task;
				yield rest;
			}
		})();
	}
}

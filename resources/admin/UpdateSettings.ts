/**
 * Live event controls. POST /api/admin/settings
 * { announcement?: {...}, claims?: {...} } — patches only the keys provided
 * and returns the resolved settings, so the Event tab can render exactly what
 * every visitor now sees.
 */
import { json, requireAdmin, OpenResource } from '../shared/auth.ts';
import { record, Setting, SYSTEM } from '../shared/harper.ts';
import {
	ANNOUNCEMENT_LEVELS,
	getAnnouncement,
	getClaims,
	type AnnouncementLevel,
} from '../Settings.ts';

export class UpdateSettings extends OpenResource {
	static async post(_target: unknown, data: Promise<unknown>) {
		const gate = await requireAdmin();
		if (gate.error) return gate.error;

		const body = ((await data) ?? {}) as { announcement?: unknown; claims?: unknown };

		if (body.announcement !== undefined) {
			if (!body.announcement || typeof body.announcement !== 'object') {
				return json(400, { error: 'announcement must be an object' });
			}
			const input = body.announcement as Record<string, unknown>;
			const level = String(input.level ?? 'info') as AnnouncementLevel;
			if (!ANNOUNCEMENT_LEVELS.includes(level)) {
				return json(400, { error: `level must be one of: ${ANNOUNCEMENT_LEVELS.join(', ')}` });
			}
			const title = String(input.title ?? '')
				.trim()
				.slice(0, 200);
			const announcement = {
				enabled: Boolean(input.enabled),
				level,
				title,
				body: String(input.body ?? '')
					.trim()
					.slice(0, 2000),
			};
			if (announcement.enabled && !title) {
				return json(400, { error: 'title is required while the announcement is on' });
			}
			await Setting.put(record({ id: 'announcement', value: announcement }), SYSTEM);
		}

		if (body.claims !== undefined) {
			if (!body.claims || typeof body.claims !== 'object') {
				return json(400, { error: 'claims must be an object' });
			}
			const input = body.claims as Record<string, unknown>;
			const claims = {
				paused: Boolean(input.paused),
				hidden: Boolean(input.hidden),
				message: String(input.message ?? '')
					.trim()
					.slice(0, 500),
			};
			await Setting.put(record({ id: 'claims', value: claims }), SYSTEM);
		}

		return json(200, {
			ok: true,
			announcement: await getAnnouncement(),
			claims: await getClaims(),
		});
	}
}

/**
 * Event-wide switches, readable by everyone. GET /api/settings
 *
 * Two keys, both flipped live from the admin Event tab (no restart, ever):
 * - announcement: the site-wide banner. Defaults to the AI-usage notice the
 *   banner shipped with, so a fresh database behaves exactly as before.
 * - claims: the pool-wide claim pause, with an optional message shown on
 *   task pages while it holds. `hidden` goes further: the pool disappears
 *   from every non-admin surface (for before the event starts), and claiming
 *   is closed while it holds.
 */
import { OpenResource } from './shared/auth.ts';
import { Setting, SYSTEM, type SettingRecord } from './shared/harper.ts';

export type AnnouncementLevel = 'info' | 'success' | 'warning' | 'danger';

export interface AnnouncementSetting {
	enabled: boolean;
	level: AnnouncementLevel;
	title: string;
	body: string;
}

export interface ClaimsSetting {
	paused: boolean;
	hidden: boolean;
	message: string;
}

export const ANNOUNCEMENT_LEVELS: AnnouncementLevel[] = ['info', 'success', 'warning', 'danger'];

export const DEFAULT_ANNOUNCEMENT: AnnouncementSetting = {
	enabled: true,
	level: 'warning',
	title: "Please don't use AI for your contributions",
	body: "We've put a lot of work into these instructions so you can learn the manual contribution process first — thank you! Questions? Flag down a contributor in the room for help.",
};

export const DEFAULT_CLAIMS: ClaimsSetting = { paused: false, hidden: false, message: '' };

async function read(key: string): Promise<unknown> {
	const row = (await Setting.get(key, SYSTEM)) as SettingRecord | undefined;
	return row?.value ?? null;
}

export async function getAnnouncement(): Promise<AnnouncementSetting> {
	const value = (await read('announcement')) as Partial<AnnouncementSetting> | null;
	return value ? { ...DEFAULT_ANNOUNCEMENT, ...value } : DEFAULT_ANNOUNCEMENT;
}

export async function getClaims(): Promise<ClaimsSetting> {
	const value = (await read('claims')) as Partial<ClaimsSetting> | null;
	return value ? { ...DEFAULT_CLAIMS, ...value } : DEFAULT_CLAIMS;
}

export class Settings extends OpenResource {
	static async get() {
		return { announcement: await getAnnouncement(), claims: await getClaims() };
	}
}

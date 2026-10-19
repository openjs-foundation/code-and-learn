/**
 * Typed table handles + hand-written record types mirroring
 * schema/tables.graphql. Keep them in sync.
 */
import { Resource, tables } from 'harper';

export const { Task, User, Guide, Setting } = tables;

// Harper's Resource statics are typed with framework metadata (e.g.
// reliesOnPrototype) that plain static get/post handlers cannot redeclare.
// Runtime behavior is unaffected — loosen the static side so endpoint classes
// can define static handlers the way the framework actually consumes them.
export const ResourceBase = Resource as unknown as new (
	..._args: unknown[]
) => InstanceType<typeof Resource>;

// A fresh context for programmatic table access. Handlers do their own
// authorization (session + User.isAdmin); without this, table calls inherit
// the anonymous request context and Harper's permission checks reject them.
export const SYSTEM = {};

// Harper's search() runtime accepts a plain query object, but its type
// signature only admits Id | RequestTarget — bridge the two.
export interface SearchQuery {
	select?: string[];
	conditions?: { attribute: string; value: unknown }[];
}

export function query(q: SearchQuery): Parameters<typeof Task.search>[0] {
	return q as unknown as Parameters<typeof Task.search>[0];
}

// Same bridge for writes: put()'s runtime accepts a plain record as its
// first argument, but its type signature only admits Id | RequestTarget.
export function record(data: object): Parameters<typeof Task.put>[0] {
	return data as unknown as Parameters<typeof Task.put>[0];
}

export type TaskStatus = 'available' | 'claimed' | 'completed' | 'flagged' | 'uncompletable';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface TaskLink {
	label: string;
	url: string;
}

export interface TaskRecord {
	id: string;
	title: string;
	summary?: string;
	description?: string;
	descriptionRendered?: unknown[];
	theme?: string | null;
	difficulty: Difficulty;
	area: string;
	skills?: string[];
	estimatedMinutes?: number;
	links?: TaskLink[];
	status: TaskStatus;
	assignedTo?: string | null;
	assignedName?: string | null;
	assignedAt?: number | null;
	assignedBy?: string | null;
	completedBy?: string | null;
	completedAt?: number | null;
	evidenceUrl?: string | null;
	uncompletableReason?: string | null;
	uncompletableBy?: string | null;
	uncompletableAt?: number | null;
	createdAt?: number;
	updatedAt?: number;
}

export interface UserRecord {
	id: string;
	name?: string;
	avatarUrl?: string | null;
	isAdmin?: boolean;
	bannedAt?: number | null;
	banReason?: string | null;
	timeoutUntil?: number | null;
	createdAt?: number;
	updatedAt?: number;
}

export interface GuideRecord {
	id: string; // = the theme it applies to
	title: string;
	summary?: string;
	body: string;
	bodyRendered?: unknown[];
	updatedAt?: number;
}

export interface SettingRecord {
	id: string; // the setting key
	value: unknown;
	updatedAt?: number;
}

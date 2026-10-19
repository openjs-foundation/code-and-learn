/**
 * The shared per-task-type instruction sets. GET /api/guides
 *
 * Returns every guide keyed by theme. There are only a handful (one per
 * theme), so the client fetches them once and looks up the guide for a task
 * by its `theme` — the task itself carries only its specifics.
 */
import { OpenResource } from './shared/auth.ts';
import { Guide, query, SYSTEM, type GuideRecord } from './shared/harper.ts';
import { renderMarkdown } from './shared/render.ts';

export class Guides extends OpenResource {
	static async get() {
		const guides: Record<string, GuideRecord> = {};
		for await (const guide of Guide.search(
			query({ select: ['id', 'title', 'summary', 'body', 'bodyRendered'] }),
			SYSTEM,
		) as AsyncIterable<GuideRecord>) {
			guides[guide.id] = guide;
		}
		return { guides };
	}
}

// Validates one guide from an import payload. Returns { guide } or { problem }.
export function validateGuideInput(input: unknown): { guide?: GuideRecord; problem?: string } {
	if (!input || typeof input !== 'object') return { problem: 'not an object' };
	const raw = input as Record<string, unknown>;
	const id = String(raw.id ?? '').trim();
	if (!id) return { problem: 'id (the theme it applies to) is required' };
	const title = String(raw.title ?? '').trim();
	if (!title) return { problem: 'title is required' };
	const body = String(raw.body ?? '');
	if (!body.trim()) return { problem: 'body is required' };
	const trimmedBody = body.slice(0, 50000);
	return {
		guide: {
			id: id.slice(0, 80),
			title: title.slice(0, 300),
			summary: String(raw.summary ?? '')
				.trim()
				.slice(0, 500),
			body: trimmedBody,
			bodyRendered: renderMarkdown(trimmedBody),
		},
	};
}

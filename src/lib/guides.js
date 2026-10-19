import { useEffect, useState } from 'react';
import { getJson } from './api.js';

/**
 * The per-task-type instruction sets, fetched once and cached for the session.
 * Guides are enrichment shown alongside a task's specifics, so a fetch failure
 * degrades gracefully to just the specifics rather than blocking the screen.
 */
let cache = null;

export function useGuides() {
	const [guides, setGuides] = useState(cache);

	useEffect(() => {
		if (cache) return;
		let cancelled = false;
		getJson('/api/guides')
			.then((res) => {
				cache = res?.guides ?? {};
				if (!cancelled) setGuides(cache);
			})
			.catch(() => {
				/* guides are optional enrichment — ignore */
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return guides;
}

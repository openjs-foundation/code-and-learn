import { useEffect, useState } from 'react';
import AlertBox from '@node-core/ui-components/Common/AlertBox';
import { getJson } from '../lib/api.js';

/**
 * The site-wide announcement banner. Content, tone, and visibility come from
 * /api/settings, which admins edit live from the Event tab (the default is
 * the workshop's AI-usage notice). It can be minimized to just its title bar
 * (never fully closed), and the minimized state is remembered across visits.
 */
const COLLAPSE_KEY = 'cl.announceCollapsed';

export default function AnnouncementBox() {
	const [announcement, setAnnouncement] = useState(null);
	const [collapsed, setCollapsed] = useState(() => {
		try {
			return localStorage.getItem(COLLAPSE_KEY) === '1';
		} catch {
			return false;
		}
	});

	useEffect(() => {
		getJson('/api/settings')
			.then((data) => setAnnouncement(data.announcement))
			.catch(() => {});
	}, []);

	if (!announcement?.enabled || !announcement.title) return null;

	function toggle() {
		const next = !collapsed;
		setCollapsed(next);
		try {
			localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
		} catch {
			/* storage disabled — still toggles for this session */
		}
	}

	return (
		<div className={`cl-announce${collapsed ? ' is-collapsed' : ''}`}>
			<AlertBox level={announcement.level} title={announcement.title}>
				{!collapsed && announcement.body ? (
					<p style={{ whiteSpace: 'pre-line' }}>{announcement.body}</p>
				) : null}
			</AlertBox>
			<button
				type="button"
				className="cl-announce-toggle"
				aria-expanded={!collapsed}
				aria-label={collapsed ? 'Expand announcement' : 'Minimize announcement'}
				onClick={toggle}
			>
				{collapsed ? '+' : '−'}
			</button>
		</div>
	);
}

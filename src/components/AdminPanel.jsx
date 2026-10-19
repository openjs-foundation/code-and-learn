// The organizer console: sign-in gating plus tab composition. Each tab's
// implementation lives in admin/ — one file per tab.
import { useEffect, useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import Tabs from '@node-core/ui-components/Common/Tabs';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import AlertBox from '@node-core/ui-components/Common/AlertBox';
import Skeleton from '@node-core/ui-components/Common/Skeleton';
import GitHub from '@node-core/ui-components/Icons/Social/GitHub';
import { getJson, signInHref } from '../lib/api.js';
import TasksTab from './admin/TasksTab.jsx';
import FlaggedTab from './admin/FlaggedTab.jsx';
import ParticipantsTab from './admin/ParticipantsTab.jsx';
import ImportTab from './admin/ImportTab.jsx';
import EventTab from './admin/EventTab.jsx';
import AdminsTab from './admin/AdminsTab.jsx';

export default function AdminPanel() {
	const [me, setMe] = useState(undefined);

	useEffect(() => {
		getJson('/api/me')
			.then(setMe)
			.catch(() => setMe({ user: null }));
	}, []);

	if (me === undefined) {
		return (
			<Skeleton loading>
				<div style={{ height: '12rem' }} />
			</Skeleton>
		);
	}

	if (!me.user) {
		return (
			<div>
				<p style={{ color: 'var(--cl-fg-soft)' }}>The organizer tools live behind a sign-in.</p>
				<BaseButton as="a" href={signInHref()}>
					<GitHub width={16} height={16} aria-hidden="true" />
					Sign in with GitHub
				</BaseButton>
			</div>
		);
	}

	if (!me.user.isAdmin) {
		return (
			<AlertBox level="warning" title="Organizers">
				<strong>This area is for workshop organizers.</strong> Signed in as {me.user.login}. If you
				should have access, ask an existing admin to promote you from this page.
			</AlertBox>
		);
	}

	return (
		<Tabs
			defaultValue="tasks"
			tabs={[
				{ key: 'tasks', label: 'Tasks' },
				{ key: 'flagged', label: 'Flagged' },
				{ key: 'participants', label: 'Participants' },
				{ key: 'import', label: 'Bulk import' },
				{ key: 'event', label: 'Event' },
				{ key: 'admins', label: 'Admins' },
			]}
		>
			<TabsPrimitive.Content value="tasks">
				<TasksTab />
			</TabsPrimitive.Content>
			<TabsPrimitive.Content value="flagged">
				<FlaggedTab />
			</TabsPrimitive.Content>
			<TabsPrimitive.Content value="participants">
				<ParticipantsTab myLogin={me.user.login} />
			</TabsPrimitive.Content>
			<TabsPrimitive.Content value="import">
				<ImportTab />
			</TabsPrimitive.Content>
			<TabsPrimitive.Content value="event">
				<EventTab />
			</TabsPrimitive.Content>
			<TabsPrimitive.Content value="admins">
				<AdminsTab myLogin={me.user.login} />
			</TabsPrimitive.Content>
		</Tabs>
	);
}

/**
 * Endpoint composition — the one file config.yaml's jsResource loads.
 *
 * Export name = URL path, so this barrel is the routing table; the endpoint
 * implementations live in per-concern files alongside it (one file per
 * surface, shared helpers under shared/).
 */
import './oauthHooks.ts';
import './bootstrap.ts';

import { AvailableTasks } from './AvailableTasks.ts';
import { Stats } from './Stats.ts';
import { Me } from './Me.ts';
import { ClaimTask } from './ClaimTask.ts';
import { CompleteTask, ReleaseTask, ReportUncompletable } from './UpdateProgress.ts';
import { Guides } from './Guides.ts';
import { Settings } from './Settings.ts';
import { ImportTasks } from './admin/ImportTasks.ts';
import { ExportTasks } from './admin/ExportTasks.ts';
import { UpdateTask } from './admin/UpdateTask.ts';
import { UpdateSettings } from './admin/UpdateSettings.ts';
import { AssignTask, UnassignTask } from './admin/AssignTask.ts';
import { SetStatus } from './admin/SetStatus.ts';
import { SetRole } from './admin/SetRole.ts';
import { Dashboard } from './admin/Dashboard.ts';
import { ReviewFlag } from './admin/ReviewFlag.ts';
import { ResetPool } from './admin/ResetPool.ts';
import { DEV_SIGN_IN, DevSignIn, DevUsers } from './dev/DevSignIn.ts';

export const api = {
	tasks: AvailableTasks,
	stats: Stats,
	me: Me,
	claim: ClaimTask,
	release: ReleaseTask,
	complete: CompleteTask,
	uncompletable: ReportUncompletable,
	guides: Guides,
	settings: Settings,
	admin: {
		tasks: UpdateTask,
		settings: UpdateSettings,
		assign: AssignTask,
		unassign: UnassignTask,
		status: SetStatus,
		import: ImportTasks,
		export: ExportTasks,
		admins: SetRole,
		review: ReviewFlag,
		participants: Dashboard,
		reset: ResetPool,
	},
	// Local-only test sign-in (dev/DevSignIn.ts); not registered unless enabled.
	...(DEV_SIGN_IN ? { dev: { login: DevSignIn, users: DevUsers } } : {}),
};

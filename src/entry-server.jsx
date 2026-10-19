// Server render entry, executed inside Harper by @harperfast/vite for every
// text/html navigation. Pages import statically here — only the client pays
// for code splitting.
import { renderToString } from 'react-dom/server';
import App from './app/App.jsx';
import { matchRoute } from './app/routes.js';
import Home from './app/pages/Home.jsx';
import Task from './app/pages/Task.jsx';
import Me from './app/pages/Me.jsx';
import Setup from './app/pages/Setup.jsx';
import Admin from './app/pages/Admin.jsx';
import NotFound from './app/pages/NotFound.jsx';

const PAGES = {
	home: Home,
	task: Task,
	me: Me,
	setup: Setup,
	admin: Admin,
	'not-found': NotFound,
};

export function render(url) {
	// The URL is attacker-controllable; nothing beyond the parsed pathname is
	// used, and unknown paths fall through to the not-found page.
	const pathname = new URL(url, 'http://internal').pathname;
	const route = matchRoute(pathname);
	const Page = PAGES[route.key];
	return renderToString(
		<App route={route} pathname={pathname}>
			<Page />
		</App>,
	);
}

// Client hydration entry. Styles are linked from index.html, so the page is
// styled before any of this runs. The page module loads through a dynamic
// import so each route ships only its own chunk (the admin panel never
// reaches attendees); the server-rendered markup stays visible while it
// loads.
import { hydrateRoot } from 'react-dom/client';
import App from './app/App.jsx';
import { matchRoute } from './app/routes.js';

const PAGE_LOADERS = {
	home: () => import('./app/pages/Home.jsx'),
	task: () => import('./app/pages/Task.jsx'),
	me: () => import('./app/pages/Me.jsx'),
	setup: () => import('./app/pages/Setup.jsx'),
	admin: () => import('./app/pages/Admin.jsx'),
	'not-found': () => import('./app/pages/NotFound.jsx'),
};

// Prose-only pages hydrate at idle: their server-rendered markup is already
// complete, and hydration only powers chrome (nav state, theme, copy
// buttons). Data-driven pages hydrate immediately.
const IDLE_ROUTES = new Set(['setup', 'not-found']);

const route = matchRoute(location.pathname);

function hydrate() {
	PAGE_LOADERS[route.key]().then(({ default: Page }) => {
		hydrateRoot(
			document.getElementById('app'),
			<App route={route} pathname={location.pathname}>
				<Page />
			</App>,
		);
	});
}

if (IDLE_ROUTES.has(route.key) && 'requestIdleCallback' in window) {
	requestIdleCallback(hydrate);
} else {
	hydrate();
}

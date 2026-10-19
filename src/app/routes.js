// The route table shared by the server render (entry-server) and client
// hydration (entry-client). Titles live in index.html's inline script so they
// apply before first paint — keep the two in step.
export const ROUTES = [
	{ key: 'home', pattern: /^\/$/, announcement: true },
	{ key: 'task', pattern: /^\/tasks\/[^/]+\/?$/, announcement: true },
	{ key: 'me', pattern: /^\/me\/?$/, announcement: true },
	{ key: 'setup', pattern: /^\/setup\/?$/, announcement: true },
	{ key: 'admin', pattern: /^\/admin\/?$/, announcement: false },
];

export const NOT_FOUND = { key: 'not-found', announcement: false };

export function matchRoute(pathname) {
	return ROUTES.find((route) => route.pattern.test(pathname)) ?? NOT_FOUND;
}

/**
 * Whether this instance is a local development one. Dev-only features
 * (fixture seeding, and anything else that must never run against real
 * users) gate on it.
 *
 * Every deployed environment sets OAUTH_REDIRECT_URI to its public origin;
 * locally it is unset (the OAuth plugin then defaults to localhost) or points
 * at a loopback host.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalInstance(): boolean {
	const redirect = process.env.OAUTH_REDIRECT_URI;
	if (!redirect) return true;
	try {
		const { hostname } = new URL(redirect);
		return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
	} catch {
		return false;
	}
}

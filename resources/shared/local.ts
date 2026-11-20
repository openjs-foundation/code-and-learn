/**
 * Whether this instance is a local development one. Dev-only features
 * (fixture seeding, and anything else that must never run against real
 * users) gate on it.
 *
 * Every deployed environment sets OAUTH_REDIRECT_URI to its public origin;
 * locally it is unset (the OAuth plugin then defaults to localhost) or points
 * at a loopback host. HARPER_CLI_TARGET is checked too: `harper deploy` ships
 * the working directory's .env, so a .env that names a remote deploy target
 * is a deploy .env, even if its OAuth settings look local.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLoopbackHost(hostname: string): boolean {
	return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

// Unset counts as local; anything that isn't a URL with a loopback host doesn't.
function isLocalUrl(value: string | undefined): boolean {
	if (!value) return true;
	try {
		return isLoopbackHost(new URL(value).hostname);
	} catch {
		return false;
	}
}

export function isLocalInstance(): boolean {
	return isLocalUrl(process.env.OAUTH_REDIRECT_URI) && isLocalUrl(process.env.HARPER_CLI_TARGET);
}

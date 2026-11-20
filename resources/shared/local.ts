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

/**
 * Whether a request started on this machine: a loopback peer address, a
 * loopback Host, no proxy headers, and a loopback Origin if the browser sent
 * one. Dev-only endpoints check it on every request, so even a deploy that
 * ships a local .env can't expose them: a remote caller fails the peer
 * address, a reverse proxy on the same host adds forwarding headers, and
 * another site's page fails the Origin.
 */
export interface RequestLike {
	ip?: string;
	host?: string;
	headers?: unknown;
}

const LOOPBACK_IP = /^(?:127(?:\.\d{1,3}){3}|::1|::ffff:127(?:\.\d{1,3}){3})$/;
const PROXY_HEADERS = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip'];

function headerOf(headers: unknown, name: string): string | null {
	if (!headers || typeof headers !== 'object') return null;
	const get = (headers as { get?: unknown }).get;
	const value =
		typeof get === 'function'
			? get.call(headers, name)
			: (headers as Record<string, unknown>)[name];
	return typeof value === 'string' ? value : null;
}

function hostnameOf(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

export function isLocalRequest(request: RequestLike | undefined): boolean {
	if (!request?.ip || !LOOPBACK_IP.test(request.ip)) return false;
	if (PROXY_HEADERS.some((name) => headerOf(request.headers, name) !== null)) return false;
	const host = hostnameOf(`http://${request.host ?? ''}`);
	if (!host || !isLoopbackHost(host)) return false;
	const origin = headerOf(request.headers, 'origin');
	if (origin === null) return true;
	const originHost = hostnameOf(origin);
	return originHost !== null && isLoopbackHost(originHost);
}

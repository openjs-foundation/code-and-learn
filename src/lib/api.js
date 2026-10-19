// Thin fetch helpers for the Harper-backed API. All endpoints are same-origin.

async function parse(response) {
	const text = await response.text();
	let body;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = null;
	}
	if (!response.ok) {
		const error = new Error(body?.error || `Request failed (${response.status})`);
		error.status = response.status;
		error.body = body;
		throw error;
	}
	return body;
}

export function getJson(path) {
	return fetch(path, { headers: { accept: 'application/json' } }).then(parse);
}

export function postJson(path, body) {
	return fetch(path, {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify(body ?? {}),
	}).then(parse);
}

export function putJson(path, body) {
	return fetch(path, {
		method: 'PUT',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify(body ?? {}),
	}).then(parse);
}

export function deleteJson(path) {
	return fetch(path, { method: 'DELETE', headers: { accept: 'application/json' } }).then(parse);
}

export function signInHref() {
	const here = `${location.pathname}${location.search}`;
	return `/oauth/github/login?redirect=${encodeURIComponent(here)}`;
}

export async function signOut() {
	// Logout is provider-agnostic in @harperfast/oauth: it serves POST /oauth/logout,
	// not /oauth/<provider>/logout (unlike login/callback, which are per-provider).
	await postJson('/oauth/logout');
	location.reload();
}

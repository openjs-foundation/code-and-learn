#!/usr/bin/env bash
# Post-deploy check: waits for the site to serve pages again.
#
# A fresh deploy sometimes leaves a node serving
# "ENOENT … node_modules/.harper-vite-ssr/entry-server.js": the server-side
# render bundle that @harperfast/vite builds on the node at startup goes
# missing. Restarting the HTTP workers rebuilds it. So: wait for the site; if
# it isn't healthy in time, restart the workers on every node once and wait
# again; fail if it still isn't healthy.
#
# Usage: scripts/check-site.sh <site-url>
# Needs HARPER_CLI_TARGET / HARPER_CLI_USERNAME / HARPER_CLI_PASSWORD for the
# restart.
set -euo pipefail

site="${1:?usage: scripts/check-site.sh <site-url>}"
interval=10
# Responses are load-balanced across nodes, so one good response isn't enough.
needed=3

# Waits up to $1 seconds for $needed consecutive healthy responses.
wait_healthy() {
	local deadline=$((SECONDS + $1)) streak=0 last=""
	while ((SECONDS < deadline)); do
		local body code state
		body=$(curl -s -m 15 -H 'Accept: text/html' -w '\n%{http_code}' "$site/" || true)
		code=$(tail -n1 <<<"$body")
		if [[ "$code" == 200 ]] && ! grep -q 'ENOENT' <<<"$body"; then
			state="healthy"
			streak=$((streak + 1))
		else
			state="HTTP ${code:-none}$(grep -q 'ENOENT' <<<"$body" && echo ' (render bundle missing)' || true)"
			streak=0
		fi
		[[ "$state" != "$last" ]] && echo "$(date -u +%H:%M:%S) $site: $state" && last="$state"
		((streak >= needed)) && return 0
		sleep "$interval"
	done
	return 1
}

if wait_healthy 90; then
	echo "Site is up."
	exit 0
fi

echo "Site not healthy after the deploy; restarting the HTTP workers on every node."
npx harper restart_service service=http_workers replicated=true

if wait_healthy 180; then
	echo "Site is up after the restart."
	exit 0
fi

echo "::error::$site is still not serving pages after a worker restart."
exit 1

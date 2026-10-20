#!/usr/bin/env bash
# Post-deploy check: waits for the deploy's restart to finish, then for the
# site to serve pages again.
#
# `npm run deploy` restarts the HTTP workers as a rolling restart job
# (restart=rolling) and prints its `restartJobId`. Given that id, this waits
# for the job to finish before sampling the site, so it never passes on the
# old workers. Without an id it waits a fixed 30s instead.
#
# A fresh deploy sometimes leaves a node serving
# "ENOENT … node_modules/.harper-vite-ssr/entry-server.js": the server-side
# render bundle that @harperfast/vite builds on the node at startup goes
# missing. Restarting the HTTP workers rebuilds it. So if the site isn't
# healthy in time, this restarts the workers on every node once (again
# waiting for that job) and checks again; it fails if the site still isn't
# healthy.
#
# Usage: scripts/check-site.sh <site-url> [restart-job-id]
# Needs HARPER_CLI_TARGET / HARPER_CLI_USERNAME / HARPER_CLI_PASSWORD for the
# job lookups and the restart.
set -euo pipefail

site="${1:?usage: scripts/check-site.sh <site-url> [restart-job-id]}"
job="${2:-}"
interval=10
# Responses are load-balanced across nodes, so one good response isn't enough.
needed=3

# Waits up to $2 seconds for Harper job $1 to finish. Returns 0 once it is
# COMPLETE, 1 if it failed, can't be found, or is still running at the
# deadline. A job that never shows up (get_job answers []) is given up on
# after ~30s, since the lookup may reach a node that doesn't hold it.
wait_job() {
	local id="$1" deadline=$((SECONDS + $2)) state="" missing=0
	while ((SECONDS < deadline)); do
		state=$(npx harper get_job id="$id" 2>/dev/null | grep -m1 -oE 'status: [A-Z_]+' | cut -d' ' -f2 || true)
		case "$state" in
		COMPLETE)
			echo "Restart job $id finished."
			return 0
			;;
		ERROR)
			echo "::warning::Restart job $id failed; checking the site anyway."
			return 1
			;;
		"")
			missing=$((missing + 1))
			if ((missing >= 6)); then
				echo "::warning::Restart job $id not found; checking the site anyway."
				return 1
			fi
			;;
		esac
		sleep 5
	done
	echo "::warning::Restart job $id is still ${state:-unknown} after $2s; checking the site anyway."
	return 1
}

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

if [[ -n "$job" ]]; then
	echo "Waiting for restart job $job to finish."
	wait_job "$job" 300 || true
else
	echo "No restart job id given; waiting 30s for the restart instead."
	sleep 30
fi

if wait_healthy 90; then
	echo "Site is up."
	exit 0
fi

echo "Site not healthy after the deploy; restarting the HTTP workers on every node."
restart=$(npx harper restart_service service=http_workers replicated=true 2>&1 | tee /dev/stderr || true)
restart_job=$(grep -m1 -oE 'job_id: [0-9a-f-]+' <<<"$restart" | cut -d' ' -f2 || true)
if [[ -n "$restart_job" ]]; then
	wait_job "$restart_job" 300 || true
else
	sleep 30
fi

if wait_healthy 120; then
	echo "Site is up after the restart."
	exit 0
fi

echo "::error::$site is still not serving pages after a worker restart."
exit 1

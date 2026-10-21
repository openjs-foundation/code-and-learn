# Code and Learn

The task directory for the Node.js **Code and Learn** workshop (part of RenderATL). Attendees
browse a curated pool of first-contribution tasks, claim one (exclusively, one at a time),
work it with mentors in the room, and mark it complete with a link to their open pull
request. Organizers manage the pool — including bulk import — from an admin section.

Built as a single [Harper](https://harper.fast) application: database, REST + WebSocket API,
GitHub OAuth, and the frontend in one deployable unit. The frontend is a multi-page React
app built with [Vite](https://vite.dev) and run inside Harper by
[`@harperfast/vite`](https://github.com/HarperFast/vite) — server-rendered per navigation
(`src/entry-server.jsx`), hydrated per page (`src/entry-client.jsx`) — using
[`@node-core/ui-components`](https://github.com/nodejs/nodejs.org/tree/main/packages/ui-components),
the Node.js project's own design system.

## How it works

| Path         | What it is                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | Live directory: the pool mosaic (every task, colored by status, updating over WebSocket) plus the filterable worklist                    |
| `/tasks/:id` | Task detail with claim action                                                                                                            |
| `/me`        | Your claimed task: release it, or submit evidence (PR link) to complete it                                                               |
| `/setup`     | The general guide: pre-event environment prep (dev container or local build) plus the day-of contribution loop, troubleshooting included |
| `/admin`     | Organizer tools: task CRUD, bulk JSON import, unassign, admin management                                                                 |

Rules enforced server-side: claiming is exclusive (a claimed task is locked), each attendee
holds at most one active task, releasing is self-serve, completing requires an `http(s)`
evidence URL and immediately frees the attendee to claim again. Browsing is public;
claiming needs GitHub sign-in; admin actions need an admin account.

## Local development

```bash
npm install
cp .env.example .env   # fill in the GitHub OAuth credentials
npm run dev
```

`npm run dev` is one process: `harper dev .` on <http://localhost:9926> — database, API,
OAuth, **and** the Vite dev server with HMR, all on one origin. `@harperfast/vite` runs
Vite in middleware mode inside Harper, so there is no proxy and no second port.

For the full production shape locally (the plugin builds the client + SSR bundles, Harper's
`static` plugin serves the assets, and `src/entry-server.jsx` renders each navigation):

```bash
npm run start   # harper run .
# → http://localhost:9926
```

`npm run build` (`vite build`) exists for CI-style checks; neither dev nor production
serving needs it — the plugin builds on the node.

### Linting and formatting

ESLint (flat config, with the React plugins) and Prettier cover the whole repo:

```bash
npm run lint          # eslint .
npm run lint:fix      # eslint . --fix
npm run format        # prettier --write .
npm run format:check  # prettier --check .
```

Both run in CI on every push and pull request, alongside `vite build`.

Useful env vars for local dev (in `.env`):

- `LOCAL_SEED=fixtures` — loads the synthetic fixture set in [`fixtures/`](fixtures/README.md):
  tasks in every state (claimed, completed, flagged…), guides, users (an admin, attendees, a
  banned and a timed-out user), and settings. Idempotent across restarts, and runs on local
  instances only.
- `LOCAL_DATA_FILE=data/contribution-tasks.json` — loads a JSON task file (the curated
  event list, or the bulk-import shape) as the starting pool. Idempotent across restarts;
  entries may pin their own `id`.
- `LOCAL_GUIDES_FILE=data/contribution-guides.json` — loads the per-theme how-to guides
  each task references by its `theme`. Also idempotent.
- `LOCAL_DEV_SIGN_IN=true` — sign in as a test user without GitHub: pick one from the **Dev**
  menu in the nav, or from a script `POST /api/dev/login` with `{"as": "fx_alice"}`. Works with `LOCAL_SEED=fixtures`
  (an admin, attendees, a banned and a timed-out user); any other login with an underscore
  is created as a plain attendee. Sign out as usual. Local instances only, and only for
  logins with an underscore, which GitHub doesn't allow, so it can never act as a real
  account.
- `ADMIN_GITHUB_LOGINS=your-login` — you become an admin on your next real sign-in.

### GitHub OAuth app

The workshop's OAuth app (credentials already exist) needs its **Authorization callback
URL** set to:

- production: `https://<your-domain>/oauth/github/callback`
- local dev: `http://localhost:9926/oauth/github/callback`

Sign-in flows through Harper (`/oauth/github/login`) on the same port (9926) that serves
the app in development and production alike.

## Deploying to Harper Fabric

**Production (automatic):** every push and pull request runs lint, format check, and
`vite build` (`.github/workflows/ci.yml`). A push to `main` that passes deploys to the
`production` environment (`.github/workflows/deploy.yml`), then waits for the site to come
back and restarts the HTTP workers if it doesn't (see below).

**Staging (manual):** Actions → **Deploy to staging** → **Run workflow**, with a branch, tag,
or commit (`ref`) or a pull request number (`pr`). It runs the same checks first. A pull
request from a fork runs on staging with staging's secrets, so review it before deploying.

Each GitHub environment (`production`, `staging`; Settings → Environments) needs:

| Kind               | Name                                                   | Value                                                         |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------- |
| secret             | `HARPER_CLI_USERNAME`, `HARPER_CLI_PASSWORD`           | cluster credentials `harper deploy` authenticates with        |
| secret             | `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` | that environment's GitHub OAuth app                           |
| variable or secret | `HARPER_CLI_TARGET`                                    | the cluster's operations URL, e.g. `https://<host>:9925/`     |
| variable           | `SITE_URL`                                             | the public origin, e.g. `https://<host>`                      |
| variable or secret | `OAUTH_REDIRECT_URI`                                   | `<SITE_URL>/oauth/callback` (the plugin appends the provider) |
| variable or secret | `ADMIN_GITHUB_LOGINS`                                  | optional; seed admins, comma-separated                        |

The app reads its OAuth settings from `.env` (`config.yaml` → `loadEnv`) and `harper deploy`
ships the working directory, so the deploy job writes `.env` from these settings right before
deploying. To load an existing `.env` in one go, run `gh secret set --env <name> -f .env`;
the settings marked "variable or secret" are read from either. Each environment needs its own
GitHub OAuth app, because the callback URL is per domain: `<SITE_URL>/oauth/github/callback`.

**Manually, from a machine:**

```bash
harper login <Application URL>   # once; from your cluster's Config → Overview page
npm run deploy                   # harper deploy project=code-and-learn restart=rolling install_allow_scripts=true
```

`harper deploy` ships the working directory, **including gitignored files such as `.env`**.
Make sure `.env` holds the target environment's settings and nothing local-only
(`LOCAL_DEV_SIGN_IN`, `LOCAL_SEED`, `LOCAL_DATA_FILE`, localhost OAuth settings).

No build step before deploying: `@harperfast/vite` builds on the node at startup and
rebuilds when watched source changes. If a deploy leaves the site failing with
`ENOENT … node_modules/.harper-vite-ssr/entry-server.js` (the server-side render bundle went
missing), restart the HTTP workers on every node. The CI deploy does this automatically:
`scripts/check-site.sh` waits for the deploy's rolling restart job to finish, then restarts
the workers if the site still isn't healthy. Note that `harper restart` restarts a _local_
instance, not the cluster.

```bash
npx harper restart_service service=http_workers replicated=true
```

Sessions must be enabled on the instance (`authentication.enableSessions: true` in the
instance's `harper-config.yaml`) for cookie-based OAuth sessions.

## Bulk import format

**Admin → Bulk import** accepts a JSON array, `{ "tasks": [...] }`, or `{ "guides": [...] }`
(at most 500 entries per batch) — so `data/contribution-tasks.json` and
`data/contribution-guides.json` each paste in as-is. Every imported task starts as open;
guides upsert by theme, so re-importing a guide updates it everywhere at once. The same
tab's **Export pool** button downloads `{ tasks, guides }` in this shape (live pool state
included), so a mid-event backup re-imports as-is. Tasks also accept this app-level shape:

```json
[
  {
    "title": "Fix a typo in the fs docs",
    "summary": "One line shown in the directory",
    "description": "Full **markdown** body with steps.",
    "difficulty": "beginner",
    "area": "docs",
    "skills": ["markdown"],
    "estimatedMinutes": 20,
    "links": [
      {
        "label": "Contributing guide",
        "url": "https://github.com/nodejs/node/blob/main/CONTRIBUTING.md"
      }
    ]
  }
]
```

- `difficulty`: `beginner` | `intermediate` | `advanced`
- `area`: free-form, lowercase (e.g. `docs`, `test`, `lib`, `src`, `website`, `triage`)
- `skills`: free-form lowercase list, drives the skill filter
- `estimatedMinutes`: 1–480

## Task data

The real event data lives in `data/` and stays **separate from the app**: tasks
(`contribution-tasks.json`) carry only their specifics, while the generic how-to for each
task type lives once per theme in `contribution-guides.json` — so adjusting a general
description never means touching every task of that type. The app joins them at render
time by the task's `theme`. See [`data/README.md`](data/README.md) for the shape, the
generators that produced both files, and the import instructions; both files import
through **Admin → Bulk import** (guides first, then tasks) or the `LOCAL_*` env vars
above.

Tasks in the curated shape map onto the app like so: `tier` becomes difficulty
(easy → beginner, medium → intermediate, hard → advanced), `theme` becomes the area
filter, `subsystem` the skill filter, and the task's own specifics (files, verify
command, commit prefix) fold into its description.

## Project layout

```
config.yaml            Harper component config (plugins, OAuth, Vite + static serving)
schema/tables.graphql  Task + User + Guide + Setting tables
resources/             Endpoints (TypeScript, one file per surface; index.ts is the URL map)
index.html             The single HTML template (theme boot, titles, SSR outlet)
vite.config.mjs        Vite 8 config; helpers under config/
src/                   React app: entry-server/entry-client, app/ (routes, pages), components/
data/                  The curated event data: tasks + per-theme guides (see data/README.md)
dist/                  Vite build output, served by Harper's static plugin (generated)
```

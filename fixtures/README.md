# Fixtures

Synthetic data for local development and tests. Nothing here is a real event, task, or person.
Real event data never goes in this repository; it lives in the production database.

| File            | What                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks.json`    | 19 tasks: every status (open, claimed, completed, flagged, removed), three themes, every difficulty, and both import shapes (the app shape and the curated `detail`/`tier` shape) |
| `guides.json`   | one guide per theme: `example-refactor`, `example-tests`, `example-docs`                                                                                                          |
| `users.json`    | `fx_ada` (admin), `fx_alice`, `fx_bob`, `fx_erin` (attendees), `fx_carol` (banned), `fx_dave` (timed out)                                                                         |
| `settings.json` | the announcement banner and an open pool                                                                                                                                          |

The states are consistent with each other: `fx_alice` holds `fx-refactor-03`, `fx_erin` holds
`fx-tests-03` (assigned by `fx_ada`), and the banned and timed-out users hold nothing.

Every login contains an underscore, which GitHub doesn't allow in usernames, so a fixture account
can never match a real GitHub user.

## Loading

Set `LOCAL_SEED=fixtures` (in `.env` or your shell) and start the app. Everything loads with its
state intact, and existing records are never overwritten, so restarts keep your changes. Seeding
only runs on a local instance: if `OAUTH_REDIRECT_URI` points anywhere but localhost, it is
skipped with an error in the log.

`tasks.json` and `guides.json` also paste into **Admin → Bulk import** (guides first), for example
on staging. Imported tasks start open, and users and settings aren't imported that way.

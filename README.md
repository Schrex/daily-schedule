# Daily Schedule

## Where things are saved

The Roster and every Daily Schedule are kept in the Worker's D1 database (binding `DB`), and the
pages read and save them through the Worker's API under `/daily-schedule/api/`
(`worker/src/api.ts`). The schema is in `migrations/`. The database also holds the access list,
`people`: each email is an `editor` (the Scheduler's screen and Settings) or a `viewer`.

### Setting up the database (once)

1. `npx wrangler d1 create daily-schedule`, and put the `database_id` it prints in `wrangler.jsonc`
   in place of `REPLACE_WITH_DATABASE_ID`. Deploys fail until this is done.
2. The tables are created by CI before the next deploy (or by hand:
   `npx wrangler d1 migrations apply DB --remote`).
3. Add the first editor (use the email they sign in to the hub with):

   ```sh
   npx wrangler d1 execute DB --remote --command "INSERT INTO people (email, role) VALUES ('name@example.com', 'editor')"
   ```

   The same command with `'viewer'` adds a viewer. To remove someone:
   `--command "DELETE FROM people WHERE email = 'name@example.com'"`. To see the list:
   `--command "SELECT * FROM people"`. Never write anyone's email in this repository.

## Running it locally

Locally, the Worker uses a **development-only sign-in**: it takes every request to come from the
email in `DEV_AUTH_EMAIL`. Put it in `.dev.vars` (git-ignored; never in `wrangler.jsonc`):

```sh
echo "DEV_AUTH_EMAIL=you@example.com" > .dev.vars
npx wrangler d1 migrations apply DB --local
npx wrangler d1 execute DB --local --command "INSERT INTO people (email, role) VALUES ('you@example.com', 'editor')"
npm run preview   # then open http://localhost:8787/daily-schedule/
```

The local database lives in `.wrangler/state/`. On first open, an editor gets the starter Roster and
Daily Schedule.

The Worker refuses to answer at all on `app.schreiberexcavating.com` or
`daily-schedule.schrex.workers.dev` if `DEV_AUTH_EMAIL` is set, so it can never reach production.

### Tests

`npm test` runs the API and the storage tests against a real local D1 (Wrangler's test harness,
`worker/src/testing/localD1.ts`, migrated from `migrations/`); no Cloudflare account is needed.

## CI

Two GitHub Actions workflows in `.github/workflows/`:

- **PR** (`pr.yml`), on every pull request: typecheck, tests and build (shown as a check on the PR),
  then a **preview deploy**. The address is posted on the PR:
  `https://pr-<number>-daily-schedule-preview.<account>.workers.dev/daily-schedule/`.
- **Deploy** (`deploy.yml`), on every merge to `main`: typecheck and tests, then the D1 migrations,
  then `npm run deploy` (the `daily-schedule` Worker). A failed migration stops the deploy.
  The Slack relay (`npm run deploy:relay`) is deployed only when its own files changed
  (`worker/wrangler.toml`, `worker/src/index.ts` or `worker/src/relay.ts`; see `.github/scripts/relay-changed.mjs`).

### Previews never touch production data

A preview is a version of a **separate Worker**, `daily-schedule-preview`, uploaded with
`wrangler versions upload --preview-alias pr-<number>`. CI writes its config from `wrangler.jsonc`
(`.github/scripts/preview-config.mjs`), giving it the preview Worker's name and pointing its D1
binding at the **preview database**. Migrations for a PR are applied to the preview database only.
If the config has a D1 binding and the preview database id isn't set, the preview fails rather
than fall back to production. Production secrets are not copied to the preview Worker; set any it
needs with `npx wrangler secret put <NAME> --name daily-schedule-preview`.

### Secrets and variables to set (once)

In GitHub: **Settings → Secrets and variables → Actions**. Never write the values in this repository.

| Name | Kind | What |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | A Cloudflare API token from the "Edit Cloudflare Workers" template, plus **Account → D1 → Edit**. |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | The Cloudflare account id (Workers & Pages overview, right-hand side). |
| `PREVIEW_D1_DATABASE_ID` | Variable | The id of the preview database. Create it once with `npx wrangler d1 create daily-schedule-preview` and copy the `database_id` it prints. Needed once `wrangler.jsonc` has a D1 binding. |

Or from a terminal: `gh secret set CLOUDFLARE_API_TOKEN` (it asks for the value),
`gh secret set CLOUDFLARE_ACCOUNT_ID`, and `gh variable set PREVIEW_D1_DATABASE_ID`.

Previews are skipped for pull requests from forks, which don't get the secrets.

The CI scripts' own tests (`.github/scripts/*.test.mjs`) run as part of `npm test`.

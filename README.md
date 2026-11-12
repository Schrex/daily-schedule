# Daily Schedule

## CI

Two GitHub Actions workflows in `.github/workflows/`:

- **PR** (`pr.yml`), on every pull request: typecheck, tests and build (shown as a check on the PR),
  then a **preview deploy**. The address is posted on the PR:
  `https://pr-<number>-daily-schedule-preview.<account>.workers.dev/daily-schedule/`.
- **Deploy** (`deploy.yml`), on every merge to `main`: typecheck and tests, then the D1 migrations,
  then `npm run deploy` (the `daily-schedule` Worker). A failed migration stops the deploy.
  The Slack relay (`npm run deploy:relay`) is deployed only when its own files changed
  (`worker/wrangler.toml` or relay code in `worker/src/`; see `.github/scripts/relay-changed.mjs`).

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

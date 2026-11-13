# Development

## The pieces

| Path | What |
| --- | --- |
| `index.html`, `settings.html`, `tv.html`, `crew.html` | The four pages: the board, Settings, the Office TV, the Crew Page |
| `public/404.html` | "Page not found", for any other address under `/daily-schedule/` |
| `src/` | The pages (React). The rules of the schedule are in `src/schedule-rules/` |
| `src/storage/` | `apiStore` (the API), `saveQueue` (in-order saves, retries), `reloadOnFocus` (when the board loads again), `memoryStore` (tests) |
| `src/signIn/` | The hub sign-in (Supabase, sign-in only) and who sees which page |
| `worker/src/app.ts` | The Worker: serves the pages under `/daily-schedule/` and routes the API |
| `worker/src/api.ts` | The API: `/me`, `/roster`, `/schedules`, `/schedules/:date`, `/slack`, `/send` |
| `worker/src/send.ts` | Send: posts the picture to the Slack relay with the send key, to the channel kept in the database |
| `worker/src/signIn.ts` | Checks the hub's token (ES256, the hub's public keys) |
| `worker/src/safetyHeaders.ts` | Browser safety headers on every answer (the CSP is report-only for now) |
| `worker/src/relay.ts`, `worker/wrangler.toml` | The Slack relay, a separate Worker |
| `migrations/` | The database schema |
| `wrangler.jsonc` | The app Worker's config: the database, the assets, the hub's sign-in address, the Slack relay's address |

## Running it locally

Locally, the Worker uses a **development-only sign-in**: it takes every request to come from the
email in `DEV_AUTH_EMAIL`. Put it in `.dev.vars`, which is git-ignored, never in `wrangler.jsonc`.

```bash
echo "DEV_AUTH_EMAIL=you@example.com" > .dev.vars
```

```bash
npx wrangler d1 migrations apply daily-schedule --local
```

```bash
npx wrangler d1 execute daily-schedule --local --command "INSERT INTO people (email, role) VALUES ('you@example.com', 'editor')"
```

Then run one of these:

- `npm run dev`: quick, with hot reload. Open http://localhost:5173/daily-schedule/.
- `npm run preview`: the built Worker with Cloudflare's real file serving (404 page, redirects).
  Open http://localhost:8787/daily-schedule/.

**About the local data:**
- It lives in `.wrangler/state/`.
- On first open of an empty database, an editor gets the starter Roster and Daily Schedule from
  `src/seed/`.

**Send, locally:** a local run has no send key, so Slack is not connected and **Send to crew**
copies the picture. That is what you want: `SLACK_RELAY_URL` in `wrangler.jsonc` is the real relay,
which posts to the real crew channel. To try Send through the server, deploy a relay of your own
that posts to a test channel ([slack-setup.md](slack-setup.md)) and add both lines to `.dev.vars`
(git-ignored), with your relay's address and its send key:

```
SLACK_RELAY_URL=https://<your relay>.workers.dev
SLACK_SEND_KEY=<your relay's SEND_KEY>
```

Never put the real send key in `.dev.vars` or anywhere in this repository.

**Safety:** if `DEV_AUTH_EMAIL`, or `HUB_JWKS` (the tests' sign-in keys), is ever set, the Worker
refuses to answer on `app.schreiberexcavating.com`. So neither can reach production.

## Tests

```bash
npm run typecheck && npm test && npm run build
```

`npm test` runs the pages' and the Worker's tests (Vitest), then the CI scripts' tests (`node --test`).
The API and storage tests run against a real local D1 (Wrangler's test harness,
`worker/src/testing/localD1.ts`). No Cloudflare account is needed.

## CI and deploys

Two workflows in `.github/workflows/`:

- **`pr.yml`, on every pull request:**
  1. Typecheck, tests and build.
  2. A **preview** deploy, with its address posted on the PR:
     `https://pr-<number>-daily-schedule-preview.schrex.workers.dev/daily-schedule/`.
     Hub sign-in doesn't work at the preview address, so check signed-in screens after merging.
- **`deploy.yml`, on every merge to `main`:**
  1. Checks the config.
  2. Typecheck and tests.
  3. Applies database migrations to `daily-schedule`. A failure stops the deploy.
  4. Deploys the Worker.
  5. Redeploys the Slack relay, only when its own files changed.

**Previews never touch production data.** A preview is a version of a separate Worker,
`daily-schedule-preview`, on the separate `daily-schedule-preview` database
(`.github/scripts/preview-config.mjs`). If the preview database isn't configured, the preview stops
instead of falling back to production.

**Previews never post to Slack.** The preview's config leaves out `SLACK_RELAY_URL`, and the
preview Worker has no `SLACK_SEND_KEY`, so a preview's Send copies the picture.

**The production Worker has no workers.dev address** (`"workers_dev": false`). It's reached only
through the hub. Previews keep their own address.

### Secrets and variables

Set these in GitHub: **Settings → Secrets and variables → Actions**. Never write the values in this
repository.

| Name | Kind | What |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | The Daily Schedule's own Cloudflare token: the "Edit Cloudflare Workers" template plus **Account → D1 → Edit**, for this account. Not the hub's token. |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | `5f7ac60f604897ff09596a9ad444a0c1` |
| `PREVIEW_D1_DATABASE_ID` | Variable | The id of `daily-schedule-preview` |

From a terminal, each command asks for the value:

```bash
gh secret set CLOUDFLARE_API_TOKEN
```

### The Worker's own secret

One secret is set on the live `daily-schedule` Worker itself, not in GitHub: `SLACK_SEND_KEY`, the
send key the Slack relay asks for. It is set once, and stays through deploys:

```bash
npx wrangler secret put SLACK_SEND_KEY --config wrangler.jsonc
```

See [slack-setup.md](slack-setup.md), step 3. The relay's address, `SLACK_RELAY_URL`, is a plain
variable in `wrangler.jsonc`.

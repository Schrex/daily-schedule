# Daily Schedule

The crew's daily schedule for Schreiber Excavating: who works where on the next working day, and
the picture of it that is sent to the crew in Slack.

**Open it:** https://app.schreiberexcavating.com/daily-schedule/ (sign in to the hub first).

## Who can do what

| Who | Gets |
| --- | --- |
| **Editors** (listed in the database) | The board and Settings: place the crew, write tasks and notes, Send. |
| **Everyone else signed in to the hub** (Viewers) | The Crew Page, read-only: the newest Daily Schedule that has been Sent, as the crew got it. Never the board, or one not Sent. |
| **Not signed in** | A link to the hub's sign-in page. |

The database holds the list of editors. To see, add or remove one, see [Everyday tasks](#everyday-tasks).
Never write anyone's email in this repository.

## How it fits together

```
 Browser ── app.schreiberexcavating.com/daily-schedule/... ──▶ Hub (Cloudflare Pages)
                                                                  │ forwards only /daily-schedule
                                                                  ▼
                                                 Worker "daily-schedule"  ── checks the hub sign-in
                                                     │            │
                                     D1 "daily-schedule"          Slack relay "daily-schedule-slack"
                                     (Roster, Daily Schedules,    (posts the Send picture
                                      editors)                     to the crew channel)
```

- **The app is its own Cloudflare Worker** with its own database, deployed from this repository.
  The hub only forwards one path to it, so the app ships without a hub release.
- **Sign-in is the hub's.** The app never reads or writes the hub's data.
- **Everything is shared:** every computer, phone and the Office TV sees the same board, and Send
  goes through the Worker, so it works the same on all of them.

## Making a change

Every change goes through a pull request. Nothing reaches the live app until you merge.

```
 branch ──▶ pull request ──────────────────────▶ merge to main ─────────────────▶ live in ~2 min
            tests + a preview on the preview       migrations, then deploy
            database (never real data)
```

1. Make the change on a branch: yourself, or ask a Claude session.
2. Open a PR. CI runs the typecheck and the tests, and posts a **preview** link on the PR.
3. Merge. CI applies any database migrations, then deploys. **To undo:** revert the PR and merge.

## Everyday tasks

Run these from this folder. Each works from any folder, because it names the database.

**Add an editor** (the email they sign in to the hub with):

```bash
npx wrangler d1 execute daily-schedule --remote --command "INSERT INTO people (email, role) VALUES ('name@schrex.com', 'editor')"
```

**Remove an editor:**

```bash
npx wrangler d1 execute daily-schedule --remote --command "DELETE FROM people WHERE email = 'name@schrex.com'"
```

**See the editors:**

```bash
npx wrangler d1 execute daily-schedule --remote --command "SELECT email, role FROM people"
```

**Other tasks:**

- **Connect Slack:** once, on the server: `npx wrangler secret put SLACK_SEND_KEY --config wrangler.jsonc`.
  Nothing is set up per computer or phone. The channel is changed in Settings, for everyone.
  See [docs/slack-setup.md](docs/slack-setup.md).
- **Look at the data:** queries, the schema and how to undo mistakes are in
  [docs/database.md](docs/database.md).
- **Crew members, jobs, placements:** change them in the app, not in the database.

## Docs

| Read | For |
| --- | --- |
| [docs/database.md](docs/database.md) | The database: its name, tables, queries, undo, what removing does |
| [docs/development.md](docs/development.md) | Running it locally, tests, CI, previews, secrets |
| [docs/slack-setup.md](docs/slack-setup.md) | Sending the picture to Slack |
| [docs/hub-integration.md](docs/hub-integration.md) | How the app sits inside the hub, and the pattern for later apps |
| [GLOSSARY.md](GLOSSARY.md) | The words used for the schedule, in the code and on screen |

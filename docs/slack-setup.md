# Sending the Daily Schedule straight to Slack

When this is set up, **Send to crew** posts the 4K picture of the Daily Schedule
to a Slack channel by itself. Nothing is pasted. The crew can tap it in Slack and
zoom in, and it stays sharp. Until it is set up, Send copies the picture as before.

```
Any Editor's screen ──picture──▶ Daily Schedule's server ──picture + send key──▶ Slack relay ──bot token──▶ Slack channel
```

The **Slack relay** is a tiny program on Cloudflare (free). It keeps the Slack
token secret. It only accepts pictures from someone who knows the **send key**,
and the only one who knows it is the Daily Schedule's server (the
`daily-schedule` Worker), which holds it as a secret. The send key is never in a
browser, in the database or in this repository, so Send works the same on every
computer and phone with nothing to set up on any of them.

## 1. The Slack app (done once)

1. Go to <https://api.slack.com/apps>, then **Create New App**, then **Paste a manifest**.
2. Pick the workspace and paste this:

   ```yaml
   display_information:
     name: Daily Schedule
     description: Posts the crew's Daily Schedule picture
     background_color: "#1f2937"
   features:
     bot_user:
       display_name: Daily Schedule
       always_online: false
   oauth_config:
     scopes:
       bot:
         - files:write
         - chat:write
   settings:
     org_deploy_enabled: false
     socket_mode_enabled: false
     token_rotation_enabled: false
   ```

3. Click **Create and Install**, then **Allow**.
4. In the app's settings, open **OAuth & Permissions** and copy the
   **Bot User OAuth Token** (`xoxb-…`). Keep it private.
5. In Slack, open the channel and type `/invite @Daily Schedule`.
6. Click the channel name, then the foot of **About**, and copy the **Channel ID**
   (for the crew channel: `C0CHSMJFFPS`, already the relay's default).

## 2. The Slack relay (done once)

You need a free Cloudflare account (<https://dash.cloudflare.com/sign-up>) and
Node.js on any computer. In a terminal, in this repository:

```bash
cd worker
```

```bash
npx wrangler login
```

Every command below names the relay's own configuration (`--config
wrangler.toml`). Without it, once the screen has been built, Wrangler finds the
screen's configuration in the folder above (`.wrangler/deploy/config.json`) and
acts on the screen instead: it says "Using redirected Wrangler configuration"
and `daily-schedule` rather than `daily-schedule-slack`.

```bash
npx wrangler secret put SLACK_BOT_TOKEN --config wrangler.toml
```

Paste the `xoxb-…` token when asked.

```bash
npx wrangler secret put SEND_KEY --config wrangler.toml
```

Type a long random password (for example, generate one in a password manager)
and keep it for step 3: the Daily Schedule's server needs the same one.

```bash
npx wrangler deploy --config wrangler.toml
```

It prints the relay's address, like
`https://daily-schedule-slack.<your-name>.workers.dev`.

`ALLOWED_ORIGIN` in `worker/wrangler.toml` lists the addresses the Scheduler's
screen may send from, separated by commas. It lists only the hub's address,
where the Daily Schedule lives (the old address is switched off):

```toml
ALLOWED_ORIGIN = "https://app.schreiberexcavating.com"
```

A screen at any other address is turned away, even with the right send key.
`"*"` allows any address. After changing the list, deploy again.

## 3. The send key on the Daily Schedule's server (done once)

The Daily Schedule's server needs two things to reach the relay:

| Name | Kind | Where | What |
| --- | --- | --- | --- |
| `SLACK_RELAY_URL` | Variable | `wrangler.jsonc`, under `vars` | The relay's address (what `wrangler deploy` printed in step 2) |
| `SLACK_SEND_KEY` | Secret | Cloudflare only | The same password as the relay's `SEND_KEY` |

The address is already in `wrangler.jsonc`. Set the secret from the main folder
(not `worker/`), naming the Daily Schedule's own configuration:

```bash
npx wrangler secret put SLACK_SEND_KEY --config wrangler.jsonc
```

Paste the same password as `SEND_KEY` when asked. It should say
`Success! Uploaded secret SLACK_SEND_KEY` for the Worker `daily-schedule` (not
`daily-schedule-slack`). It takes effect at once, with no deploy.

If nobody has the password any more, make a new one and set it in both places:
`SEND_KEY` on the relay (step 2) and `SLACK_SEND_KEY` here.

Reload the Daily Schedule. **Send to crew** now posts to the relay's channel
(`SLACK_CHANNEL` in `worker/wrangler.toml`) from every computer and phone.
Until the secret is set, Send copies the picture for pasting, as before.

The **Slack** box in Settings (relay address, send key, channel) is no longer
used by Send. Nothing needs typing there.

**Previews and local runs do not post to Slack.** A pull request's preview is
not given the relay's address and has no send key, and a local run has no send
key unless you give it one ([development.md](development.md)).

## What the crew sees

One message per send:

```
Schedule for Thursday, Nov 12            ← the message, also what a phone's notification shows
Tap to see it full size ▾                ← Slack's grey line over the picture
[the picture]
```

A resend for the same day starts with `UPDATED: `. The day is said once, in the
message; the grey line over the picture does not repeat it.

After a change to `worker/src/relay.ts`, deploy the relay again. From the main
folder:

```bash
npm run deploy:relay
```

It should say `Uploaded daily-schedule-slack`. (`npm run deploy` is the screen,
`daily-schedule`; the two are deployed separately.)

To change the channel later, invite the bot to the new channel
(`/invite @Daily Schedule`), put its ID in `SLACK_CHANNEL` in
`worker/wrangler.toml` and deploy the relay again.

## When it goes wrong

The screen says why, in plain words. The usual ones:

| The screen says | Fix |
| --- | --- |
| The bot is not in that Slack channel | In the channel, type `/invite @Daily Schedule` |
| The Daily Schedule's send key does not match the Slack relay's | Set `SLACK_SEND_KEY` again (step 3) to the same password as the relay's `SEND_KEY` |
| Slack did not accept the relay's token | Reinstall the app and `wrangler secret put SLACK_BOT_TOKEN` again |
| The Slack relay could not be reached | Check `SLACK_RELAY_URL` in `wrangler.jsonc`, and that the relay is deployed |
| The Daily Schedule's server could not be reached | Check the internet connection |
| Send copies the picture ("Paste in Slack") | Slack is not connected on the server: set `SLACK_SEND_KEY` (step 3) |

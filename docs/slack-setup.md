# Sending the Daily Schedule straight to Slack

When this is set up, **Send to crew** posts the 4K picture of the Daily Schedule
to a Slack channel by itself. Nothing is pasted. The crew can tap it in Slack and
zoom in, and it stays sharp. Until it is set up, Send copies the picture as before.

```
Scheduler's screen ──picture + send key──▶ Slack relay (Cloudflare Worker) ──bot token──▶ Slack channel
```

The **Slack relay** is a tiny program on Cloudflare (free). It keeps the Slack
token secret, so the token is never on the Scheduler's computer. It only accepts
pictures from someone who knows the **send key**.

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

```bash
npx wrangler secret put SLACK_BOT_TOKEN
```

Paste the `xoxb-…` token when asked.

```bash
npx wrangler secret put SEND_KEY
```

Type a long random password (for example, generate one in a password manager)
and keep it: Settings needs the same one.

```bash
npx wrangler deploy
```

It prints the relay's address, like
`https://daily-schedule-slack.<your-name>.workers.dev`.

Optional: once you know where the Scheduler's screen is hosted, put its address
in `ALLOWED_ORIGIN` in `worker/wrangler.toml` and deploy again.

## 3. Settings on the Scheduler's computer

Open **Settings** on the Daily Schedule and fill in the **Slack** box:

- **Slack relay address:** the address `wrangler deploy` printed
- **Send key:** the same password as `SEND_KEY`
- **Slack channel ID:** `C0CHSMJFFPS`, or another channel's ID. Leave it empty to use the relay's default.

Reload the Daily Schedule. **Send to crew** now posts to that channel.

## What the crew sees

One message per send:

```
Schedule for Thursday, Nov 12            ← the message, also what a phone's notification shows
Tap to see it full size ▾                ← Slack's grey line over the picture
[the picture]
```

A resend for the same day starts with `UPDATED: `. The day is said once, in the
message; the grey line over the picture does not repeat it.

After a change to `worker/src/relay.ts`, deploy the relay again from `worker/`
with `npx wrangler deploy`.

To change the channel later, invite the bot to the new channel
(`/invite @Daily Schedule`) and put its ID in Settings.

## When it goes wrong

The screen says why, in plain words. The usual ones:

| The screen says | Fix |
| --- | --- |
| The bot is not in that Slack channel | In the channel, type `/invite @Daily Schedule` |
| The send key does not match | Make Settings' send key the same as `SEND_KEY` |
| Slack did not accept the relay's token | Reinstall the app and `wrangler secret put SLACK_BOT_TOKEN` again |
| Slack could not be reached | Check the internet connection, or the relay address in Settings |

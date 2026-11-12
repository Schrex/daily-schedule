import { describe, expect, it, vi } from 'vitest';
import { handle, type Env } from './relay';
import wranglerToml from '../wrangler.toml?raw';

const env: Env = { SLACK_BOT_TOKEN: 'xoxb-test', SEND_KEY: 'secret-key', SLACK_CHANNEL: 'C0CHSMJFFPS' };
const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

const send = (headers: Record<string, string> = {}, body: BodyInit = png) =>
  new Request('https://relay.example/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret-key', 'X-Title': encodeURIComponent('Daily Schedule for Thursday'), ...headers },
    body,
  });

/** A pretend Slack that answers each step of the upload, recording what it was asked. */
function fakeSlack(complete: Record<string, unknown> = { ok: true }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('files.getUploadURLExternal')) {
      return Response.json({ ok: true, upload_url: 'https://files.slack.com/upload/v1/abc', file_id: 'F123' });
    }
    if (String(url).startsWith('https://files.slack.com/upload')) return new Response('OK');
    return Response.json(complete);
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const form = (init: RequestInit) => new URLSearchParams(String(init.body));

describe('the Slack relay', () => {
  it('uploads the picture and shares it in the channel, with no message, titled with the day', async () => {
    const slack = fakeSlack();
    const response = await handle(send(), env, slack.fetchImpl);

    expect(await response.json()).toEqual({ ok: true });
    expect(slack.calls.map((call) => call.url)).toEqual([
      'https://slack.com/api/files.getUploadURLExternal',
      'https://files.slack.com/upload/v1/abc',
      'https://slack.com/api/files.completeUploadExternal',
    ]);
    const [ask, put, complete] = slack.calls;
    expect(form(ask!.init).get('length')).toBe(String(png.length));
    expect(form(ask!.init).get('filename')).toBe('Daily-Schedule-for-Thursday.png');
    expect(new Uint8Array(put!.init.body as Uint8Array)).toEqual(png);
    expect(form(complete!.init).get('channel_id')).toBe('C0CHSMJFFPS');
    // The picture alone: no message with it. Its title (the line Slack always
    // shows over a file) says which day it is, once.
    expect(form(complete!.init).has('initial_comment')).toBe(false);
    expect(JSON.parse(form(complete!.init).get('files')!)).toEqual([
      { id: 'F123', title: 'Daily Schedule for Thursday' },
    ]);
    expect((ask!.init.headers as Record<string, string>).Authorization).toBe('Bearer xoxb-test');
  });

  it('posts to the channel the screen names instead', async () => {
    const slack = fakeSlack();
    await handle(send({ 'X-Channel': 'C999OTHER' }), env, slack.fetchImpl);
    expect(form(slack.calls[2]!.init).get('channel_id')).toBe('C999OTHER');
  });

  it('refuses a wrong send key without touching Slack', async () => {
    const slack = fakeSlack();
    const response = await handle(send({ Authorization: 'Bearer nope' }), env, slack.fetchImpl);
    expect(response.status).toBe(401);
    expect(slack.calls).toHaveLength(0);
  });

  it('refuses a channel ID that is not one', async () => {
    const slack = fakeSlack();
    const response = await handle(send({ 'X-Channel': '#general' }), env, slack.fetchImpl);
    expect(response.status).toBe(400);
    expect(slack.calls).toHaveLength(0);
  });

  it('says in plain words when the bot is not in the channel', async () => {
    const slack = fakeSlack({ ok: false, error: 'not_in_channel' });
    const response = await handle(send(), env, slack.fetchImpl);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error).toContain('/invite @Daily Schedule');
  });

  it("answers the browser's preflight", async () => {
    const response = await handle(new Request('https://relay.example/send', { method: 'OPTIONS' }), env);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Channel');
  });

  describe('the allowed addresses', () => {
    const OLD = 'https://daily-schedule.schrex.workers.dev';
    const NEW = 'https://app.schreiberexcavating.com';
    const both: Env = { ...env, ALLOWED_ORIGIN: `${OLD}, ${NEW}` };
    const preflight = (origin: string) =>
      new Request('https://relay.example/send', { method: 'OPTIONS', headers: { Origin: origin } });

    it('lets a screen at a listed address send, and tells its browser so', async () => {
      const { fetchImpl } = fakeSlack();
      const response = await handle(send({ Origin: NEW }), both, fetchImpl);
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(NEW);
    });

    it('refuses a screen at any other address, even with the right send key, without touching Slack', async () => {
      const { fetchImpl } = fakeSlack();
      const response = await handle(send({ Origin: 'https://elsewhere.example' }), both, fetchImpl);
      expect(response.status).toBe(403);
      expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('https://elsewhere.example');
      expect(fetchImpl).not.toHaveBeenCalled();
      const preflightResponse = await handle(preflight('https://elsewhere.example'), both);
      expect(preflightResponse.status).toBe(403);
    });

    it('as deployed, accepts the screen at the new address only; the old one is switched off', async () => {
      const configured = /^ALLOWED_ORIGIN\s*=\s*"([^"]*)"/m.exec(wranglerToml)?.[1];
      const deployed: Env = { ...env, ALLOWED_ORIGIN: configured };
      const atNew = await handle(preflight(NEW), deployed);
      expect(atNew.status).toBe(204);
      expect(atNew.headers.get('Access-Control-Allow-Origin')).toBe(NEW);
      expect((await handle(preflight(OLD), deployed)).status).toBe(403);
    });

    it('still allows any address when the list is "*"', async () => {
      const { fetchImpl } = fakeSlack();
      const response = await handle(send({ Origin: 'https://elsewhere.example' }), { ...env, ALLOWED_ORIGIN: '*' }, fetchImpl);
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});

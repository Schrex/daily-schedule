import { describe, expect, it, vi } from 'vitest';
import { handle, type Env } from './app';
import { localD1 } from './testing/localD1';

const API = 'http://localhost:8787/daily-schedule/api';

const EDITOR = 'editor@example.test';
const VIEWER = 'viewer@example.test';

const d1 = localD1({ [EDITOR]: 'editor', [VIEWER]: 'viewer' });

/** Slack connected on the server: the relay's address and the send key. */
const CONNECTED: Partial<Env> = { SLACK_RELAY_URL: 'https://relay.example/', SLACK_SEND_KEY: 'test-send-key' };

const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

/** A pretend Slack relay that records what it was asked and answers as told. */
function fakeRelay(answer: () => Response | Promise<Response> = () => Response.json({ ok: true })) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return answer();
  });
  return { calls, fetch: fetchImpl as unknown as typeof fetch };
}

/** Calls the Worker as `email` (or signed out), with the relay stood in for. */
const call = (
  email: string | undefined,
  path: string,
  init: RequestInit | undefined,
  relay: { fetch: typeof fetch },
  vars: Partial<Env> = CONNECTED,
) =>
  handle(
    new Request(API + path, init),
    d1.env({ ...vars, ...(email === undefined ? {} : { DEV_AUTH_EMAIL: email }) }),
    { fetch: relay.fetch },
  );

/** A change of the Slack channel, as Settings asks for it. */
const channel = (to: unknown): RequestInit => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ channel: to }),
});

const send = (body: BodyInit | null = png, title = 'Schedule for Thursday, Nov 12'): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'image/png', 'X-Title': encodeURIComponent(title) },
  body,
});

describe('the API: Send', () => {
  it('posts an Editor\'s picture and its title to the Slack relay with the send key', async () => {
    const relay = fakeRelay();
    const response = await call(EDITOR, '/send', send(), relay);

    expect(response.status).toBe(204);
    expect(relay.calls).toHaveLength(1);
    const { url, init } = relay.calls[0]!;
    const headers = new Headers(init.headers);
    expect(url).toBe('https://relay.example/send');
    expect(init.method).toBe('POST');
    expect(headers.get('Authorization')).toBe('Bearer test-send-key');
    expect(decodeURIComponent(headers.get('X-Title')!)).toBe('Schedule for Thursday, Nov 12');
    // No channel is saved, so none is named: the picture goes to the relay's own channel.
    expect(headers.has('X-Channel')).toBe(false);
    expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(png);
  });

  it('posts to the channel saved in Settings, and to the relay\'s own again once it is emptied', async () => {
    const relay = fakeRelay();
    await call(EDITOR, '/slack', channel('C0TESTCHANNEL'), relay);

    expect((await call(EDITOR, '/send', send(), relay)).status).toBe(204);
    expect(new Headers(relay.calls[0]!.init.headers).get('X-Channel')).toBe('C0TESTCHANNEL');

    await call(EDITOR, '/slack', channel(''), relay);
    expect((await call(EDITOR, '/send', send(), relay)).status).toBe(204);
    expect(new Headers(relay.calls[1]!.init.headers).has('X-Channel')).toBe(false);
  });

  it('answers 401 signed out and 403 to a Viewer, asking the relay nothing', async () => {
    const relay = fakeRelay();

    expect((await call(undefined, '/send', send(), relay)).status).toBe(401);
    const refused = await call(VIEWER, '/send', send(), relay);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: expect.any(String) });
    expect(relay.calls).toEqual([]);
  });

  it('answers 400 to a missing or too-big picture, asking the relay nothing', async () => {
    const relay = fakeRelay();

    expect((await call(EDITOR, '/send', send(null), relay)).status).toBe(400);
    expect((await call(EDITOR, '/send', send(new Uint8Array(0)), relay)).status).toBe(400);
    const tooBig = await call(EDITOR, '/send', send(new Uint8Array(20 * 1024 * 1024 + 1)), relay);
    expect(tooBig.status).toBe(400);
    expect(await tooBig.json()).toEqual({ error: expect.any(String) });
    expect(relay.calls).toEqual([]);
  });

  it('refuses a picture that says it is too big before reading any of it', async () => {
    const relay = fakeRelay();
    let read = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        read += 1;
        controller.enqueue(png);
        controller.close();
      },
    }, { highWaterMark: 0 });
    const init = { ...send(body), duplex: 'half' } as RequestInit;
    (init.headers as Record<string, string>)['Content-Length'] = String(20 * 1024 * 1024 + 1);

    expect((await call(EDITOR, '/send', init, relay)).status).toBe(400);
    expect(read).toBe(0);
    expect(relay.calls).toHaveLength(0);
  });

  it('stops reading a picture that does not say how big it is as soon as it is too big', async () => {
    const relay = fakeRelay();
    const megabyte = new Uint8Array(1024 * 1024);
    let megabytes = 0;
    // It would go on to 200 MB if it were all read.
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          megabytes += 1;
          if (megabytes > 200) controller.close();
          else controller.enqueue(megabyte);
        },
      },
      { highWaterMark: 0 },
    );

    const response = await call(EDITOR, '/send', { ...send(body), duplex: 'half' } as RequestInit, relay);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringContaining('too large') });
    expect(megabytes).toBeLessThanOrEqual(22);
    expect(relay.calls).toHaveLength(0);
  });

  it('fails with the relay\'s own words when the relay refuses', async () => {
    const relay = fakeRelay(() =>
      Response.json({ ok: false, error: 'The Daily Schedule bot is not in that Slack channel.' }, { status: 502 }),
    );
    const response = await call(EDITOR, '/send', send(), relay);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'The Daily Schedule bot is not in that Slack channel.' });
  });

  it('says the server\'s send key is wrong when the relay does not accept it, not to look in Settings', async () => {
    const relay = fakeRelay(() =>
      Response.json({ ok: false, error: 'The send key in Settings does not match the Slack relay.' }, { status: 401 }),
    );
    const response = await call(EDITOR, '/send', send(), relay);

    expect(response.status).toBe(502);
    const { error } = (await response.json()) as { error: string };
    expect(error).toMatch(/send key/);
    expect(error).not.toMatch(/Settings/);
  });

  it('fails plainly when the relay cannot be reached or answers nonsense', async () => {
    const unreachable = fakeRelay(() => {
      throw new TypeError('fetch failed');
    });
    const down = await call(EDITOR, '/send', send(), unreachable);
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ error: expect.stringMatching(/could not be reached/) });

    const nonsense = await call(EDITOR, '/send', send(), fakeRelay(() => new Response('<html>')));
    expect(nonsense.status).toBe(502);
    expect(await nonsense.json()).toEqual({ error: expect.any(String) });
  });

  it.each([
    ['nothing is set', {}],
    ['the send key is missing', { SLACK_RELAY_URL: 'https://relay.example' }],
    ['the relay\'s address is missing', { SLACK_SEND_KEY: 'test-send-key' }],
    ['the relay\'s address is not https', { SLACK_RELAY_URL: 'http://relay.example', SLACK_SEND_KEY: 'test-send-key' }],
  ] as [string, Partial<Env>][])('refuses in plain words when %s, asking the relay nothing', async (_what, vars) => {
    const relay = fakeRelay();
    const response = await call(EDITOR, '/send', send(), relay, vars);

    expect(response.ok).toBe(false);
    expect(await response.json()).toEqual({ error: expect.stringMatching(/not connected/) });
    expect(relay.calls).toEqual([]);
    expect(await (await call(EDITOR, '/slack', undefined, relay, vars)).json()).toEqual({ connected: false, channel: '' });
  });
});

describe('the API: whether Slack is connected', () => {
  it('tells anyone signed in, and nothing more: never the send key or the relay\'s address', async () => {
    const relay = fakeRelay();

    for (const email of [EDITOR, VIEWER]) {
      const response = await call(email, '/slack', undefined, relay);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({ connected: true, channel: '' });
      expect(text).not.toContain('test-send-key');
      expect(text).not.toContain('relay.example');
    }
    expect((await call(undefined, '/slack', undefined, relay)).status).toBe(401);
    expect(relay.calls).toEqual([]);
  });

  it('never gives the send key or the relay\'s address in a Send answer either', async () => {
    const relay = fakeRelay(() => Response.json({ ok: false }, { status: 500 }));
    const text = await (await call(EDITOR, '/send', send(), relay)).text();

    expect(text).not.toContain('test-send-key');
    expect(text).not.toContain('relay.example');
  });
});

describe('the API: the Slack channel', () => {
  it('is empty until an Editor sets one, and is then the same for everyone on the list', async () => {
    const relay = fakeRelay();
    expect(await (await call(EDITOR, '/slack', undefined, relay)).json()).toEqual({ connected: true, channel: '' });

    expect((await call(EDITOR, '/slack', channel('C0TESTCHANNEL'), relay)).status).toBe(204);

    for (const email of [EDITOR, VIEWER]) {
      expect(await (await call(email, '/slack', undefined, relay)).json()).toEqual({
        connected: true,
        channel: 'C0TESTCHANNEL',
      });
    }
    expect(relay.calls).toEqual([]);
  });

  it('is kept tidy: without stray spaces, in capitals; empty goes back to the relay\'s own channel', async () => {
    const relay = fakeRelay();
    await call(EDITOR, '/slack', channel(' c0testchannel '), relay);
    expect(await (await call(VIEWER, '/slack', undefined, relay)).json()).toMatchObject({ channel: 'C0TESTCHANNEL' });

    expect((await call(EDITOR, '/slack', channel(''), relay)).status).toBe(204);
    expect(await (await call(VIEWER, '/slack', undefined, relay)).json()).toMatchObject({ channel: '' });
  });

  it('answers 401 signed out and 403 to a Viewer, keeping the saved channel', async () => {
    const relay = fakeRelay();
    await call(EDITOR, '/slack', channel('C0TESTCHANNEL'), relay);

    expect((await call(undefined, '/slack', channel('C0OTHERCHANNEL'), relay)).status).toBe(401);
    const refused = await call(VIEWER, '/slack', channel('C0OTHERCHANNEL'), relay);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: expect.any(String) });
    expect(await (await call(EDITOR, '/slack', undefined, relay)).json()).toMatchObject({ channel: 'C0TESTCHANNEL' });
  });

  it.each([
    ['a channel name', '#crew'],
    ['too short', 'C0'],
    ['not text', 42],
    ['missing', undefined],
  ])('refuses in plain words a channel that is %s, keeping the saved one', async (_what, bad) => {
    const relay = fakeRelay();
    await call(EDITOR, '/slack', channel('C0TESTCHANNEL'), relay);
    const response = await call(EDITOR, '/slack', channel(bad), relay);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringMatching(/channel ID looks like/) });
    expect(await (await call(EDITOR, '/slack', undefined, relay)).json()).toMatchObject({ channel: 'C0TESTCHANNEL' });
  });
});

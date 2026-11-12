import { describe, expect, it } from 'vitest';
import { handle, type Env } from './app';

const HUB = 'https://app.schreiberexcavating.com';
const OLD = 'https://daily-schedule.schrex.workers.dev';

/** Pretend page files: answers like the assets binding, recording the paths it was asked for. */
function fakeAssets(answer: (path: string) => Response = (path) => new Response(`file ${path}`)) {
  const asked: string[] = [];
  const env: Env = {
    // These requests never reach the database (the API's own tests use a real one: api.test.ts).
    DB: {
      prepare: () => {
        throw new Error('No database here');
      },
      batch: async () => [],
    },
    ASSETS: {
      fetch: async (input: Request | string) => {
        const url = new URL(input instanceof Request ? input.url : input);
        asked.push(url.pathname + url.search);
        return answer(url.pathname);
      },
    },
  };
  return { env, asked };
}

describe('the Daily Schedule Worker', () => {
  it('sends a bare /daily-schedule to /daily-schedule/, keeping the query', async () => {
    const { env, asked } = fakeAssets();
    const response = await handle(new Request(`${HUB}/daily-schedule?x=1`), env);

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(`${HUB}/daily-schedule/?x=1`);
    expect(asked).toEqual([]);
  });

  it.each([
    ['/daily-schedule/', '/'],
    ['/daily-schedule/settings', '/settings'],
    ['/daily-schedule/tv.html?day=2026-11-13', '/tv.html?day=2026-11-13'],
    ['/daily-schedule/assets/inter-latin-400.woff2', '/assets/inter-latin-400.woff2'],
  ])('serves %s from the page file at %s', async (path, file) => {
    const { env, asked } = fakeAssets();
    const response = await handle(new Request(`${HUB}${path}`), env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(`file ${file.split('?')[0]}`);
    expect(asked).toEqual([file]);
  });

  it('keeps the page files\' own redirects under /daily-schedule (index.html goes to the board)', async () => {
    const { env } = fakeAssets((path) =>
      path === '/index.html' ? new Response(null, { status: 307, headers: { Location: '/' } }) : new Response('x'),
    );
    const response = await handle(new Request(`${HUB}/daily-schedule/index.html`), env);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('/daily-schedule/');
  });

  it.each(['/', '/schedule', '/index.html', '/assets/inter-latin-400.woff2', '/daily-schedules', '/daily-schedule.html'])(
    'refuses %s on the hub\'s address with 404, so it never answers for a hub page',
    async (path) => {
      const { env, asked } = fakeAssets();
      const response = await handle(new Request(`${HUB}${path}`), env);

      expect(response.status).toBe(404);
      expect(asked).toEqual([]);
    },
  );

  it.each(['/', '/settings', '/tv.html', '/index.html', '/daily-schedule/', '/daily-schedule/settings'])(
    'on the old address, answers %s with the export page only',
    async (path) => {
      const { env, asked } = fakeAssets();
      const response = await handle(new Request(`${OLD}${path}`), env);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('file /export');
      expect(asked).toEqual(['/export']);
    },
  );

  it('on the old address, still serves the export page\'s own scripts and fonts', async () => {
    const { env, asked } = fakeAssets();
    const response = await handle(new Request(`${OLD}/daily-schedule/assets/export-abc.js`), env);

    expect(response.status).toBe(200);
    expect(asked).toEqual(['/assets/export-abc.js']);
  });

  it('on the old address, never answers the API', async () => {
    const { env, asked } = fakeAssets();
    const response = await handle(new Request(`${OLD}/daily-schedule/api/roster`), env);

    expect(response.status).toBe(404);
    expect(asked).toEqual([]);
  });

  it.each([['/', '/'], ['/settings', '/settings'], ['/export', '/export']])(
    'on this computer (wrangler dev), serves %s from the page file at %s, as before',
    async (path, file) => {
      const { env, asked } = fakeAssets();
      const response = await handle(new Request(`http://localhost:8787${path}`), env);

      expect(response.status).toBe(200);
      expect(asked).toEqual([file]);
    },
  );

  it('under Vite\'s dev server (npm run dev), asks for the page files with /daily-schedule kept, as Vite serves them', async () => {
    const { env, asked } = fakeAssets();
    const response = await handle(new Request('http://localhost:5173/daily-schedule/settings.html'), env, {
      devServer: true,
    });

    expect(response.status).toBe(200);
    expect(asked).toEqual(['/daily-schedule/settings.html']);
  });

  it('keeps /daily-schedule/api/ for the API, never answering it with a page', async () => {
    const { env, asked } = fakeAssets();
    const response = await handle(new Request(`${HUB}/daily-schedule/api/roster`), env);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(asked).toEqual([]);
  });
});

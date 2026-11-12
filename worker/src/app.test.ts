import { describe, expect, it } from 'vitest';
import notFoundPage from '../../public/404.html?raw';
import wranglerConfig from '../../wrangler.jsonc?raw';
import { handle, type Env } from './app';

const HUB = 'https://app.schreiberexcavating.com';

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

  it.each([['/', '/'], ['/settings', '/settings'], ['/tv', '/tv']])(
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

  it('passes the page files\' 404 for an unknown page through, never the board', async () => {
    const { env, asked } = fakeAssets((path) =>
      path === '/expor' ? new Response('Page not found', { status: 404 }) : new Response(`file ${path}`),
    );
    const response = await handle(new Request(`${HUB}/daily-schedule/expor`), env);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Page not found');
    expect(asked).toEqual(['/expor']);
  });
});

describe('an unknown address under /daily-schedule/', () => {
  it('gets the Page not found page (404-page), not the board (single-page-application)', () => {
    expect(wranglerConfig).toMatch(/"not_found_handling":\s*"404-page"/);
    expect(wranglerConfig).not.toMatch(/single-page-application/);
  });

  it('says the page was not found and links back to the board', () => {
    expect(notFoundPage).toMatch(/Page not found/);
    expect(notFoundPage).toMatch(/href="\/daily-schedule\/"/);
  });
});

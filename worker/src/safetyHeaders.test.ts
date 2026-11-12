import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle, type Env } from './app';
import { CONTENT_SECURITY_POLICY, CSP_REPORT_PATH } from './safetyHeaders';

const HUB = 'https://app.schreiberexcavating.com';

const env: Env = {
  DB: {
    prepare: () => {
      throw new Error('No database here');
    },
    batch: async () => [],
  },
  ASSETS: {
    fetch: async (input: Request | string) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname;
      if (path === '/index.html') return new Response(null, { status: 307, headers: { Location: '/' } });
      if (path === '/expor') return new Response('Page not found', { status: 404 });
      // Like the real binding, whose headers cannot be changed.
      const response = await fetch(`data:text/html,file ${path}`);
      return response;
    },
  },
};

afterEach(() => vi.restoreAllMocks());

describe('the browser safety headers', () => {
  it.each([
    ['the board', '/daily-schedule/', 200],
    ['the TV page', '/daily-schedule/tv', 200],
    ['a page file\'s redirect', '/daily-schedule/index.html', 307],
    ['the bare address\'s redirect', '/daily-schedule', 301],
    ['the Page not found page', '/daily-schedule/expor', 404],
    ['the API', '/daily-schedule/api/roster', 401],
    ['a hub address it refuses', '/schedule', 404],
  ])('are on %s', async (_, path, status) => {
    const response = await handle(new Request(`${HUB}${path}`), env);

    expect(response.status).toBe(status);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'self'");
    expect(response.headers.get('Content-Security-Policy-Report-Only')).toBe(CONTENT_SECURITY_POLICY);
  });

  it('keep the page file\'s own body and redirect', async () => {
    const page = await handle(new Request(`${HUB}/daily-schedule/settings`), env);
    expect(await page.text()).toBe('file /settings');

    const moved = await handle(new Request(`${HUB}/daily-schedule/index.html`), env);
    expect(moved.headers.get('Location')).toBe('/daily-schedule/');
  });

  it('are left off under Vite\'s dev server, whose own scripts the policy would report', async () => {
    const response = await handle(new Request('http://localhost:5173/daily-schedule/'), env, { devServer: true });

    expect(response.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
  });

  it('let the pages run only their own scripts, and never be framed by another site', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });
});

describe('the report of what the policy would have blocked', () => {
  const report = (body: string, init: RequestInit = {}) =>
    handle(new Request(`${HUB}${CSP_REPORT_PATH}`, { method: 'POST', body, ...init }), env);

  it('logs the gist of an older-style report, without the address\'s query', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await report(
      JSON.stringify({
        'csp-report': {
          'document-uri': `${HUB}/daily-schedule/?day=2026-11-13`,
          'violated-directive': 'connect-src',
          'blocked-uri': 'https://relay.example/send?key=secret',
        },
      }),
      { headers: { 'Content-Type': 'application/csp-report' } },
    );

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls[0]!.join(' ');
    expect(logged).toContain('https://relay.example/send');
    expect(logged).toContain('connect-src');
    expect(logged).not.toContain('secret');
  });

  it('logs each violation in a Reporting API list, and ignores other kinds of report', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await report(
      JSON.stringify([
        {
          type: 'csp-violation',
          body: { documentURL: `${HUB}/daily-schedule/tv`, effectiveDirective: 'img-src', blockedURL: 'https://x.example/a.png' },
        },
        { type: 'deprecation', body: { id: 'x' } },
      ]),
      { headers: { 'Content-Type': 'application/reports+json' } },
    );

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]!.join(' ')).toContain('img-src');
  });

  it('needs no sign-in, as browsers send reports without it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await report('{"csp-report":{}}')).status).toBe(204);
  });

  it('refuses anything but a small JSON report, and logs nothing for it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect((await handle(new Request(`${HUB}${CSP_REPORT_PATH}`), env)).status).toBe(405);
    expect((await report('not json')).status).toBe(400);
    expect((await report('x'.repeat(17 * 1024))).status).toBe(413);
    expect(warn).not.toHaveBeenCalled();
  });
});

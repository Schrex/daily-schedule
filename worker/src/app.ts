import { handleApi } from './api';
import type { D1Database } from './d1';

/** The path the Daily Schedule owns on the hub's address. */
export const BASE = '/daily-schedule';

/** Where the API answers (see api.ts). */
const API = `${BASE}/api/`;

/** The hub's address, which forwards /daily-schedule and /daily-schedule/* here. */
export const HUB_HOST = 'app.schreiberexcavating.com';

/** The Daily Schedule's own address before the move (it stays on). */
export const OLD_HOST = 'daily-schedule.schrex.workers.dev';

/** Where the real Daily Schedule answers; the development sign-in is refused there. */
const PRODUCTION_HOSTS = [HUB_HOST, OLD_HOST];

/** The page files, as the Worker's assets binding serves them (built at the root). */
export interface Assets {
  fetch(request: Request | string): Promise<Response>;
}

export interface Env {
  ASSETS: Assets;
  /** The Roster, the Daily Schedules and the access list (migrations/). */
  DB: D1Database;
  /**
   * The development-only sign-in: every request is taken to come from this
   * email. Only ever set in local configuration (.dev.vars).
   */
  DEV_AUTH_EMAIL?: string;
  /**
   * The hub's Supabase sign-in (`https://<project>.supabase.co/auth/v1`): the
   * issuer of its tokens, and where its public keys are published.
   */
  HUB_AUTH_URL?: string;
  /** The hub's public keys as a JWKS, in place of fetching them (the tests). */
  HUB_JWKS?: string;
}

export interface Options {
  /**
   * Running under Vite's dev server (npm run dev), where the page files are
   * Vite's own and are already served under /daily-schedule/.
   */
  devServer?: boolean;
}

/** Answers every request the Daily Schedule Worker gets. */
export async function handle(request: Request, env: Env, options: Options = {}): Promise<Response> {
  const url = new URL(request.url);
  if (env.DEV_AUTH_EMAIL && PRODUCTION_HOSTS.includes(url.hostname)) {
    // The development sign-in lets anyone in as that email: never in production.
    return Response.json(
      { error: 'The development sign-in (DEV_AUTH_EMAIL) is set on a production address; refusing to answer.' },
      { status: 500 },
    );
  }
  if (url.hostname === OLD_HOST) return oldAddress(request, env);
  if (url.pathname === BASE) {
    url.pathname = `${BASE}/`;
    return Response.redirect(url.toString(), 301);
  }
  if (url.pathname.startsWith(API)) {
    return handleApi(request, env, url.pathname.slice(API.length));
  }
  if (url.pathname.startsWith(`${BASE}/`)) {
    if (options.devServer) return env.ASSETS.fetch(request);
    url.pathname = url.pathname.slice(BASE.length);
    return underBase(await env.ASSETS.fetch(new Request(url, request)), url.origin);
  }
  if (url.hostname === HUB_HOST) {
    // The hub forwards only /daily-schedule here; never answer for a hub page.
    return new Response('Not found', { status: 404 });
  }
  // Local runs (wrangler dev on localhost): the pages at the root, as before the move.
  return env.ASSETS.fetch(request);
}

/** The export page's file (export.html), as the assets binding names it. */
const EXPORT_PAGE = '/export';

/**
 * The old address (daily-schedule.schrex.workers.dev), told apart by the
 * request's host: only the export page, which downloads that address's browser
 * storage as an Export file, and the scripts, styles and fonts it asks for.
 * Every other page there answers with the export page, and there is no API.
 */
async function oldAddress(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith(`${BASE}/assets/`)) {
    url.pathname = url.pathname.slice(BASE.length);
    return env.ASSETS.fetch(new Request(url, request));
  }
  if (url.pathname.startsWith(API)) return new Response('Not found', { status: 404 });
  return env.ASSETS.fetch(new Request(new URL(EXPORT_PAGE, url.origin), { headers: request.headers }));
}

/**
 * The page files redirect within the root they were built at (`/index.html`
 * to `/`, `/settings/` to `/settings`). Put such a redirect back under
 * /daily-schedule, so that it never leads to a hub page.
 */
function underBase(response: Response, origin: string): Response {
  const location = response.headers.get('Location');
  if (!location) return response;
  const target = new URL(location, origin);
  if (target.origin !== origin) return response;
  const moved = new Response(response.body, response);
  moved.headers.set('Location', BASE + target.pathname + target.search + target.hash);
  return moved;
}

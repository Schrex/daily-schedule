import { handleApi } from './api';
import type { D1Database } from './d1';
import { refuse } from './refuse';
import { CSP_REPORT_PATH, handleCspReport, withSafetyHeaders } from './safetyHeaders';

/** The path the Daily Schedule owns on the hub's address. */
export const BASE = '/daily-schedule';

/** Where the API answers (see api.ts). */
const API = `${BASE}/api/`;

/** The hub's address, which forwards /daily-schedule and /daily-schedule/* here. */
export const HUB_HOST = 'app.schreiberexcavating.com';

/** Where the real Daily Schedule answers; the development sign-in is refused there. */
const PRODUCTION_HOSTS = [HUB_HOST];

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
  /**
   * The hub's public keys as a JWKS, in place of fetching them (the tests).
   * Refused on the production addresses, like DEV_AUTH_EMAIL.
   */
  HUB_JWKS?: string;
  /**
   * The Slack relay's address (https://daily-schedule-slack.<account>.workers.dev),
   * where Send posts the picture (send.ts). Never sent to a browser.
   */
  SLACK_RELAY_URL?: string;
  /**
   * The send key the Slack relay asks for (its SEND_KEY). A secret: set with
   * `wrangler secret put`, never written in the repository, the database or
   * an answer.
   */
  SLACK_SEND_KEY?: string;
}

export interface Options {
  /**
   * Running under Vite's dev server (npm run dev), where the page files are
   * Vite's own and are already served under /daily-schedule/.
   */
  devServer?: boolean;
  /** How the Worker reaches the Slack relay (the tests pass their own). */
  fetch?: typeof fetch;
}

/**
 * Answers every request the Daily Schedule Worker gets, with the browser
 * safety headers (safetyHeaders.ts). Not under Vite's dev server, whose own
 * page scripts the policy would report.
 */
export async function handle(request: Request, env: Env, options: Options = {}): Promise<Response> {
  const response = await answer(request, env, options);
  return options.devServer ? response : withSafetyHeaders(response);
}

async function answer(request: Request, env: Env, options: Options): Promise<Response> {
  const url = new URL(request.url);
  if (PRODUCTION_HOSTS.includes(url.hostname)) {
    // The development sign-in lets anyone in as that email, and the tests' key
    // set trusts tokens signed by keys that are not the hub's: never in production.
    const unsafe = (['DEV_AUTH_EMAIL', 'HUB_JWKS'] as const).filter((name) => env[name]);
    if (unsafe.length > 0) {
      return refuse(500, `${unsafe.join(' and ')} is set on a production address; refusing to answer.`);
    }
  }
  if (url.pathname === BASE) {
    url.pathname = `${BASE}/`;
    return Response.redirect(url.toString(), 301);
  }
  if (url.pathname === CSP_REPORT_PATH) {
    return handleCspReport(request);
  }
  if (url.pathname.startsWith(API)) {
    return handleApi(request, env, url.pathname.slice(API.length), options.fetch);
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
  // Local runs (wrangler dev on localhost) and PR previews: the pages at the root too.
  return env.ASSETS.fetch(request);
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

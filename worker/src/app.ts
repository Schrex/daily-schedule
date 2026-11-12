/** The path the Daily Schedule owns on the hub's address. */
export const BASE = '/daily-schedule';

/** The hub's address, which forwards /daily-schedule and /daily-schedule/* here. */
export const HUB_HOST = 'app.schreiberexcavating.com';

/** The page files, as the Worker's assets binding serves them (built at the root). */
export interface Assets {
  fetch(request: Request | string): Promise<Response>;
}

export interface Env {
  ASSETS: Assets;
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
  if (url.pathname === BASE) {
    url.pathname = `${BASE}/`;
    return Response.redirect(url.toString(), 301);
  }
  if (url.pathname.startsWith(`${BASE}/api/`)) {
    // The API (the Roster, the Daily Schedules, sign-in) is routed here.
    return Response.json({ error: 'Not found.' }, { status: 404 });
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
  // The old address (daily-schedule.schrex.workers.dev) and local runs: the
  // pages at the root, as before the move.
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

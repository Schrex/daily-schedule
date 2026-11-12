import { handle, type Env } from './app';

/** The Daily Schedule's Cloudflare Worker: every request goes to app.ts, before the page files. */
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env, { devServer: import.meta.env.DEV });
  },
};

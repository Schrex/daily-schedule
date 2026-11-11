import { handle, type Env } from './relay';

/** The Cloudflare Worker: every request goes to the relay (relay.ts). */
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};

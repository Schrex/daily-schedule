import type { Env } from './app';

/**
 * Who is calling: the email of whoever made the request, or null when nobody
 * is signed in (or the sign-in can't be trusted). The API asks only this; the
 * access list (`people`) then decides what that email may do.
 *
 * Today the only sign-in is the development one (`DEV_AUTH_EMAIL`, set in
 * local configuration only). The hub's sign-in (a Supabase token checked
 * here) goes in beside it.
 */
export async function whoIsCalling(_request: Request, env: Env): Promise<string | null> {
  return env.DEV_AUTH_EMAIL || null;
}

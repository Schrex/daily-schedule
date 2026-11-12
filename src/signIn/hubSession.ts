import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HUB_SUPABASE_PUBLISHABLE_KEY, HUB_SUPABASE_URL } from './hubConfig';
import type { GetToken } from './withToken';

/**
 * The hub's sign-in, and nothing else of the hub's Supabase. The pages share
 * the hub's address, so this finds the session the hub saved in browser
 * storage, refreshes it before it expires (and when a page comes back the
 * next day), and saves it back for the hub to use too.
 *
 * Only the sign-in part of the client is kept: this app never reads or
 * writes the hub's data (no `.from()`, storage or functions; a test checks).
 */
let auth: SupabaseClient['auth'] | undefined;

function hubAuth(): SupabaseClient['auth'] {
  auth ??= createClient(HUB_SUPABASE_URL, HUB_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      // The hub's own sign-in page handles sign-in links, never these pages.
      detectSessionInUrl: false,
    },
  }).auth;
  return auth;
}

/**
 * The hub sign-in's current token, refreshed first if it has expired, or null
 * when nobody is signed in to the hub (and locally, where the development
 * sign-in stands in).
 */
export const hubToken: GetToken = async () => {
  const { data } = await hubAuth().getSession();
  return data.session?.access_token ?? null;
};

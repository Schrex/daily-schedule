/**
 * The hub's Supabase project, used by the pages for sign-in only (never for
 * data). The publishable (anon) key is public by design: the hub's own pages
 * carry it. Both come from the hub repository (Schrex/schreiber-hub-central,
 * `.env`: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY).
 *
 * The Worker checks tokens against the same project (HUB_AUTH_URL in
 * wrangler.jsonc).
 */
export const HUB_SUPABASE_URL = 'https://bitogpfplcquovpdjprk.supabase.co';

export const HUB_SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdG9ncGZwbGNxdW92cGRqcHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODYxNjcsImV4cCI6MjA5MjE2MjE2N30.RM9sEili7tOEq1n0cW1zLvnYs4DjJNnul4gva3h02Qo';

/** The hub itself, for the way back. */
export const HUB_HOME = 'https://app.schreiberexcavating.com/';

/** The hub's sign-in page. After signing in the hub goes to its home page, so the note asks to come back. */
export const HUB_SIGN_IN = 'https://app.schreiberexcavating.com/auth';

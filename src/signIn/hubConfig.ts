/**
 * The hub's Supabase project, used by the pages for sign-in only (never for
 * data). The publishable (anon) key is public by design: the hub's own pages
 * carry it. Both are the live hub's: its build-info.json names the project
 * (acgqjjbrnkmeazswdnzp), and its page code carries the key. (The hub
 * repository's `.env` still names the old Lovable project; don't copy from it.)
 *
 * The Worker checks tokens against the same project (HUB_AUTH_URL in
 * wrangler.jsonc).
 */
export const HUB_SUPABASE_URL = 'https://acgqjjbrnkmeazswdnzp.supabase.co';

export const HUB_SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZ3FqamJybmttZWF6c3dkbnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MDU2MzUsImV4cCI6MjEwNzk4MTYzNX0.02pALBB44NeQ3vyRD8sWH1k3L-aNjMAUY7ZG00ejx64';

/** The hub itself, for the way back. */
export const HUB_HOME = 'https://app.schreiberexcavating.com/';

/** The hub's sign-in page. After signing in the hub goes to its home page, so the note asks to come back. */
export const HUB_SIGN_IN = 'https://app.schreiberexcavating.com/auth';

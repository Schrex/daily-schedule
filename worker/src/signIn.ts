import type { Env } from './app';

/**
 * Who is calling: the email of whoever made the request, or null when nobody
 * is signed in (or the sign-in can't be trusted). The API asks only this; the
 * access list (`people`) then decides what that email may do.
 *
 * Two sign-ins:
 * - The development one (`DEV_AUTH_EMAIL`, set in local configuration only):
 *   every request is taken to come from that email.
 * - The hub's: the pages send the hub's Supabase token as
 *   `Authorization: Bearer <token>`. It is checked here, against the hub's
 *   published ES256 keys; nothing the hub's forwarding function did is trusted.
 */
export async function whoIsCalling(request: Request, env: Env): Promise<string | null> {
  if (env.DEV_AUTH_EMAIL) return env.DEV_AUTH_EMAIL;
  const token = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token || !env.HUB_AUTH_URL) return null;
  const keys = env.HUB_JWKS ? () => Promise.resolve(parseJwks(env.HUB_JWKS!)) : hubKeys(env.HUB_AUTH_URL);
  return emailFromToken(token, keys, env.HUB_AUTH_URL);
}

/** Finds the public key a token names; `refresh` asks the hub again (a key it doesn't know yet). */
export type KeySource = (refresh?: boolean) => Promise<JsonWebKey[]>;

/**
 * The email in a hub token, or null unless the token is signed (ES256) by
 * one of the hub's keys, was issued by the hub (`issuer`) for a signed-in
 * person, and has not expired.
 */
export async function emailFromToken(
  token: string,
  keys: KeySource,
  issuer: string,
  now: number = Date.now(),
): Promise<string | null> {
  const [head, body, signature, ...rest] = token.split('.');
  if (head === undefined || body === undefined || signature === undefined || rest.length > 0) return null;
  const header = decodeJson(head);
  const claims = decodeJson(body);
  if (!header || !claims || header.alg !== 'ES256' || typeof header.kid !== 'string') return null;

  let key = (await keys()).find((candidate) => (candidate as { kid?: string }).kid === header.kid);
  // The hub may have rotated its keys since they were kept.
  key ??= (await keys(true)).find((candidate) => (candidate as { kid?: string }).kid === header.kid);
  if (!key) return null;

  let valid = false;
  try {
    const publicKey = await crypto.subtle.importKey('jwk', key, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ]);
    valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      decodeBase64url(signature),
      new TextEncoder().encode(`${head}.${body}`),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;
  if (claims.iss !== issuer) return null;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes('authenticated')) return null;
  return typeof claims.email === 'string' && claims.email !== '' ? claims.email : null;
}

/** How long the hub's keys are kept before asking again. */
const KEEP_KEYS_MS = 60 * 60 * 1000;
/** Asking again for a key the hub doesn't seem to have waits at least this long. */
const ASK_AGAIN_MS = 60 * 1000;

type Fetch = (input: string) => Promise<Response>;

interface Kept {
  keys: JsonWebKey[];
  at: number;
}
const kept = new Map<string, Kept>();

/**
 * The hub's published keys (`<authUrl>/.well-known/jwks.json`), kept for an
 * hour so that a request doesn't wait on the hub, and asked for again (at most
 * once a minute) when a token names a key not among them.
 */
export function hubKeys(
  authUrl: string,
  fetchFn: Fetch = (input) => fetch(input),
  clock: () => number = Date.now,
): KeySource {
  const url = `${authUrl}/.well-known/jwks.json`;
  return async (refresh = false) => {
    const now = clock();
    const known = kept.get(url);
    const fresh = known && now - known.at < KEEP_KEYS_MS;
    const tooSoon = known && now - known.at < ASK_AGAIN_MS;
    if (known && fresh && (!refresh || tooSoon)) return known.keys;
    try {
      const response = await fetchFn(url);
      if (!response.ok) throw new Error(`The hub's keys answered ${response.status}`);
      const keys = parseJwks(await response.text());
      kept.set(url, { keys, at: now });
      return keys;
    } catch (error) {
      console.error('Could not fetch the hub\'s sign-in keys', error);
      return known?.keys ?? [];
    }
  };
}

/** Forgets every kept key (for the tests). */
export function forgetHubKeys(): void {
  kept.clear();
}

function parseJwks(text: string): JsonWebKey[] {
  const parsed = JSON.parse(text) as { keys?: unknown };
  return Array.isArray(parsed.keys) ? (parsed.keys as JsonWebKey[]) : [];
}

function decodeBase64url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJson(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(decodeBase64url(text)));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Sign-in tokens like the hub's (Supabase, ES256), made by the tests with
 * their own key pair. Nothing here contacts Supabase.
 */
export const TEST_ISSUER = 'https://hub.example.test/auth/v1';

export interface TokenMaker {
  /** The public keys, as the hub publishes them (a JWKS). */
  jwks: { keys: JsonWebKey[] };
  /** A token for `email`; `claims` and `header` override the usual ones. */
  token(email: string, claims?: Record<string, unknown>, header?: Record<string, unknown>): Promise<string>;
}

export const base64url = (bytes: Uint8Array | string): string =>
  btoa(String.fromCharCode(...(typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export async function hubTokens(kid = 'test-key'): Promise<TokenMaker> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const publicKey = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, alg: 'ES256', use: 'sig' };

  return {
    jwks: { keys: [publicKey] },
    async token(email, claims = {}, header = {}) {
      const now = Math.floor(Date.now() / 1000);
      const head = base64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid, ...header }));
      const body = base64url(
        JSON.stringify({
          iss: TEST_ISSUER,
          aud: 'authenticated',
          role: 'authenticated',
          sub: 'a-user-id',
          email,
          iat: now,
          exp: now + 3600,
          ...claims,
        }),
      );
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        new TextEncoder().encode(`${head}.${body}`),
      );
      return `${head}.${body}.${base64url(new Uint8Array(signature))}`;
    },
  };
}

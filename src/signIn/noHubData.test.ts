import { describe, expect, it } from 'vitest';

/**
 * The app uses the hub's Supabase for sign-in only. It must never read or
 * write the hub's data: no `.from()`, storage, functions, RPC or realtime
 * call, anywhere in the pages.
 */
const sources = import.meta.glob<string>(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const files = Object.entries(sources).map(([path, text]) => ({ path: path.replace(/^\/src\//, ''), text }));
const HUB_SESSION = 'signIn/hubSession.ts';
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('the hub\'s Supabase is for sign-in only', () => {
  it('finds the pages\' code', () => {
    expect(files.map((file) => file.path)).toEqual(expect.arrayContaining([HUB_SESSION, 'main.tsx']));
  });

  it('is used by one file only', () => {
    const using = files.filter((file) => file.text.includes('@supabase/')).map((file) => file.path);

    expect(using).toEqual([HUB_SESSION]);
  });

  it('is never asked for data', () => {
    const hubSession = files.find((file) => file.path === HUB_SESSION)!;
    // Array.from and friends are fine elsewhere; the Supabase client lives only in hubSession.ts.
    expect(withoutComments(hubSession.text)).not.toMatch(/\.\s*(from|storage|functions|rpc|channel|schema|realtime)\b/);
    for (const file of files) {
      expect(withoutComments(file.text), file.path).not.toMatch(
        /supabase\s*\.\s*(from|storage|functions|rpc|channel|schema)\b/i,
      );
    }
  });

  it('keeps only the sign-in part of the client', () => {
    const hubSession = files.find((file) => file.path === HUB_SESSION)!;

    expect(hubSession.text).toMatch(/createClient\([\s\S]*?\)\.auth;/);
  });
});

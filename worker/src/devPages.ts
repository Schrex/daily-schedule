import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/** The three pages, as the built Worker serves them under /daily-schedule/. */
const PAGES = ['index', 'settings', 'tv'];

/**
 * The page file (at the project root) for a page address under
 * /daily-schedule/, or null for anything else (the API, scripts, fonts).
 */
export function devPageFile(url: string): string | null {
  const pathname = url.split(/[?#]/)[0]!;
  const match = /^\/daily-schedule\/(?:([a-z]+)(?:\.html)?)?$/.exec(pathname);
  if (!match) return null;
  const name = match[1] ?? 'index';
  return PAGES.includes(name) ? `${name}.html` : null;
}

/**
 * Serves the pages under /daily-schedule/ in npm run dev (vite.config.ts).
 * The Cloudflare plugin's dev assets look a page up from the project root with
 * /daily-schedule still on, find nothing and fall back to index.html (every
 * page opened the main screen), and Vite refuses the page without it. So the
 * pages are answered here, before either; scripts, fonts and the API still go
 * through the Worker (worker/src/app.ts) as before.
 */
export function devPages(): Plugin {
  return {
    name: 'daily-schedule-dev-pages',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const file = req.url ? devPageFile(req.url) : null;
        if (!file || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
        try {
          const html = await readFile(join(server.config.root, file), 'utf-8');
          res.setHeader('Content-Type', 'text/html');
          res.end(await server.transformIndexHtml(req.url!, html));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

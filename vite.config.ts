import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { devPages } from './worker/src/devPages';

// The Cloudflare plugin is left out of the tests: they run the Worker's code in
// Node, and worker/src/testing/localD1.ts gives them a real local D1.
// devPages() answers the pages under /daily-schedule/ in npm run dev; it comes
// before the Cloudflare plugin so that it sees them first.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'test' ? [] : [devPages(), cloudflare()])],
  // The pages ask for their scripts, styles, fonts and logo under
  // /daily-schedule/, where the hub forwards them to the Worker. The build
  // still writes the files at the root; the Worker (worker/src/app.ts) removes
  // the prefix before serving them.
  base: '/daily-schedule/',
  environments: {
    // The pages only (the Worker's script is built separately by the plugin).
    client: {
      build: {
        // Four pages: the Scheduler's screen (index.html), the office's settings
        // page (settings.html) and the office TV (tv.html), each reached by its
        // own address, and the export page (export.html), the only page on the
        // old address.
        rollupOptions: {
          input: ['index.html', 'settings.html', 'tv.html', 'export.html'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'],
  },
}));

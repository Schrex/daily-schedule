import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), cloudflare()],
  // The pages ask for their scripts, styles, fonts and logo under
  // /daily-schedule/, where the hub forwards them to the Worker. The build
  // still writes the files at the root; the Worker (worker/src/app.ts) removes
  // the prefix before serving them.
  base: '/daily-schedule/',
  environments: {
    // The pages only (the Worker's script is built separately by the plugin).
    client: {
      build: {
        // Three pages: the Scheduler's screen (index.html), the office's settings
        // page (settings.html) and the office TV (tv.html), each reached by its own
        // address.
        rollupOptions: {
          input: ['index.html', 'settings.html', 'tv.html'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'],
  },
});

import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    // Three pages: the Scheduler's screen (index.html), the office's settings
    // page (settings.html) and the office TV (tv.html), each reached by its own
    // address.
    rollupOptions: {
      input: ['index.html', 'settings.html', 'tv.html'],
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'],
  },
});

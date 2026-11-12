import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    // Two pages: the Scheduler's screen (index.html) and the office's settings
    // page (settings.html), which is reached only by its own address.
    rollupOptions: {
      input: ['index.html', 'settings.html'],
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'],
  },
});

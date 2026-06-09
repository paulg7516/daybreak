// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environmentMatchGlobs: [['tests/renderer/**', 'jsdom']],
    setupFiles: ['./tests/renderer/setup.ts'],
  },
});

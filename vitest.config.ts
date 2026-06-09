// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The React plugin gives renderer .tsx tests the same automatic JSX runtime as
  // the real Vite build, independent of the tsconfig split (jsx lives in
  // tsconfig.renderer.json, which vitest's esbuild transform does not read).
  plugins: [react()],
  test: {
    environmentMatchGlobs: [['tests/renderer/**', 'jsdom']],
    setupFiles: ['./tests/renderer/setup.ts'],
  },
});

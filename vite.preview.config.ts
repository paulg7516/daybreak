// vite.preview.config.ts
// Builds the standalone design preview (src/renderer/preview.html) to dist/preview
// without touching the packaged app build. Dev-only design tooling.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react(), tailwind()],
  build: {
    outDir: '../../dist/preview',
    emptyOutDir: true,
    rollupOptions: { input: 'src/renderer/preview.html' },
  },
});

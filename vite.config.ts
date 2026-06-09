// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  root: 'src/renderer',
  base: './', // relative paths so file:// loading works in the packaged app
  plugins: [react(), tailwind()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
});

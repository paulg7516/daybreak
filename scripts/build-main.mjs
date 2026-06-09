// scripts/build-main.mjs
import { build } from 'esbuild';

// When built with DAYBREAK_DEMO=1, bake the flag into the bundle so a packaged
// app (launched from Finder, where no env is set) still runs in demo mode. Normal
// builds leave process.env.DAYBREAK_DEMO as a runtime lookup (used by `app:demo`).
const define = process.env.DAYBREAK_DEMO ? { 'process.env.DAYBREAK_DEMO': '"1"' } : {};

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  define,
  external: ['electron', 'keytar', 'electron-store', 'electron-updater', '@azure/msal-node'],
};

// Output .cjs so the files load as CommonJS despite the package being "type": "module".
await build({ ...common, entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.cjs' });
await build({ ...common, entryPoints: ['src/preload/index.ts'], outfile: 'dist/main/preload.cjs' });

console.log(`Daybreak: built main + preload to dist/main/${process.env.DAYBREAK_DEMO ? ' (DEMO mode baked in)' : ''}`);

// scripts/build-main.mjs
import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external: ['electron', 'keytar', 'electron-store', 'electron-updater', '@azure/msal-node'],
};

// Output .cjs so the files load as CommonJS despite the package being "type": "module".
await build({ ...common, entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.cjs' });
await build({ ...common, entryPoints: ['src/preload/index.ts'], outfile: 'dist/main/preload.cjs' });

console.log('Daybreak: built main + preload to dist/main/');

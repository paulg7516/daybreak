// scripts/build-main.mjs
import { build } from 'esbuild';

// When built with DAYBREAK_DEMO=1, bake the flag into the bundle so a packaged
// app (launched from Finder, where no env is set) still runs in demo mode. Normal
// builds leave process.env.DAYBREAK_DEMO as a runtime lookup (used by `app:demo`).
const define = process.env.DAYBREAK_DEMO ? { 'process.env.DAYBREAK_DEMO': '"1"' } : {};

// Bake the Google OAuth credentials present at build time into the bundle, so a
// packaged app a tester launches from Finder (no env set) can sign in to Gmail
// without each tester configuring env vars. The runtime reads the env var first
// and only falls back to these baked values, so a dev/tester can still override.
// dist/ is gitignored, so the secret never enters source control. A Desktop OAuth
// client secret is not confidential by design, so bundling it is expected.
define['process.env.DAYBREAK_GOOGLE_CLIENT_ID_BAKED'] = JSON.stringify(process.env.DAYBREAK_GOOGLE_CLIENT_ID ?? '');
define['process.env.DAYBREAK_GOOGLE_CLIENT_SECRET_BAKED'] = JSON.stringify(process.env.DAYBREAK_GOOGLE_CLIENT_SECRET ?? '');
// A Gmail tester build (npm run app:dist:gmail) sets DAYBREAK_BAKE_PROVIDER so the
// packaged app defaults to Gmail with no shell env. Keyed on this explicit flag, NOT
// on the dev's ambient DAYBREAK_MAIL_PROVIDER, so normal builds stay on Graph.
if (process.env.DAYBREAK_BAKE_PROVIDER) {
  define['process.env.DAYBREAK_MAIL_PROVIDER_BAKED'] = JSON.stringify(process.env.DAYBREAK_BAKE_PROVIDER);
}

const googleBaked = Boolean(process.env.DAYBREAK_GOOGLE_CLIENT_ID && process.env.DAYBREAK_GOOGLE_CLIENT_SECRET);
if (!googleBaked) {
  console.warn(
    'Daybreak: building without DAYBREAK_GOOGLE_CLIENT_ID/_SECRET in the environment - ' +
      'the packaged app will have no Gmail credentials baked in. Set them before `npm run app:dist` to ship a Gmail-ready build.',
  );
}

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

console.log(
  `Daybreak: built main + preload to dist/main/${process.env.DAYBREAK_DEMO ? ' (DEMO mode baked in)' : ''}` +
    `${googleBaked ? ' (Gmail credentials baked in)' : ''}` +
    `${process.env.DAYBREAK_BAKE_PROVIDER ? ` (provider baked: ${process.env.DAYBREAK_BAKE_PROVIDER})` : ''}`,
);

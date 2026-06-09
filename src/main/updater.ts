// src/main/updater.ts
import updaterPkg from 'electron-updater';

// electron-updater is CommonJS; destructure the default export under ESM.
const { autoUpdater } = updaterPkg;

// Wired but dormant: there is no publish feed yet. Calling this is safe and a
// no-op without an update server, so it stays here ready for the first release.
export function initUpdater(): void {
  autoUpdater.autoDownload = false;
  // Intentionally not calling checkForUpdates() until a release feed exists.
}

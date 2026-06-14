// src/renderer/theme.ts
// Light / dark / system appearance, mirroring Nowtify. The user's PREFERENCE
// (light | dark | system) is stored in localStorage; "system" resolves against the
// OS via matchMedia. The EFFECTIVE theme is set as data-theme on <html>, which flips
// the token palette in styles.css. No IPC needed - renderer-local, like the layout pref.
export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'daybreak-theme';

export function getThemePref(): ThemePref {
  let v: string | null = null;
  try { v = localStorage.getItem(KEY); } catch { /* ignore */ }
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function resolveEffective(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setThemePref(pref: ThemePref): void {
  try { localStorage.setItem(KEY, pref); } catch { /* ignore */ }
  document.documentElement.setAttribute('data-theme', resolveEffective(pref));
}

// Apply the stored preference once at startup and keep "system" in sync with OS
// appearance changes while the app is open.
export function initTheme(): void {
  setThemePref(getThemePref());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePref() === 'system') {
      document.documentElement.setAttribute('data-theme', resolveEffective('system'));
    }
  });
}

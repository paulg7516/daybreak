// src/main/store.ts
import ElectronStore from 'electron-store';
import {
  emptyOverlay,
  setAwayWindow as setAwayWindowR,
  setLastOpenedAt as setLastOpenedAtR,
  clearItem as clearItemR,
  unclearItem as unclearItemR,
  rerankItem as rerankItemR,
  setLaneConfig as setLaneConfigR,
  setJiraConfig as setJiraConfigR,
  type Overlay,
} from '../app/overlay';
import { normalizeLaneConfig, type LaneSetting } from '../app/lane-config';
import type { Lane } from '../model/item';

// electron-store persists a single "overlay" key. Email content is never stored;
// only the away window, last-opened time, cleared ids, re-rank overrides, and the
// Jira connection live here.
const store = new ElectronStore<{ overlay: Overlay }>({
  name: 'daybreak-overlay',
  defaults: { overlay: emptyOverlay() },
});

export function getOverlay(): Overlay {
  return { ...emptyOverlay(), ...store.get('overlay') };
}

function update(next: Overlay): Overlay {
  store.set('overlay', next);
  return next;
}

export function setAwayWindow(sinceISO: string, nowISO: string): Overlay {
  return update(setAwayWindowR(getOverlay(), sinceISO, nowISO));
}

export function setLastOpenedAt(nowISO: string): Overlay {
  return update(setLastOpenedAtR(getOverlay(), nowISO));
}

export function clearItem(id: string): Overlay {
  return update(clearItemR(getOverlay(), id));
}

export function unclearItem(id: string): Overlay {
  return update(unclearItemR(getOverlay(), id));
}

export function rerankItem(id: string, lane: Lane): Overlay {
  return update(rerankItemR(getOverlay(), id, lane));
}

export function getLaneConfig(): LaneSetting[] {
  return normalizeLaneConfig(getOverlay().laneConfig);
}

export function setLaneConfig(laneConfig: LaneSetting[]): Overlay {
  return update(setLaneConfigR(getOverlay(), normalizeLaneConfig(laneConfig)));
}

export function getJiraConfig(): { baseUrl: string; email: string } | null {
  return getOverlay().jira;
}

export function setJiraConfig(baseUrl: string, email: string): Overlay {
  return update(setJiraConfigR(getOverlay(), baseUrl, email));
}

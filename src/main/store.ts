// src/main/store.ts
import ElectronStore from 'electron-store';
import {
  emptyOverlay,
  setAwayWindow as setAwayWindowR,
  clearItem as clearItemR,
  unclearItem as unclearItemR,
  rerankItem as rerankItemR,
  type Overlay,
} from '../app/overlay';
import type { Lane } from '../model/item';

// electron-store persists a single "overlay" key. Email content is never stored;
// only the away window, cleared ids, and re-rank overrides live here.
const store = new ElectronStore<{ overlay: Overlay }>({
  name: 'daybreak-overlay',
  defaults: { overlay: emptyOverlay() },
});

export function getOverlay(): Overlay {
  return store.get('overlay');
}

function update(next: Overlay): Overlay {
  store.set('overlay', next);
  return next;
}

export function setAwayWindow(sinceISO: string, nowISO: string): Overlay {
  return update(setAwayWindowR(getOverlay(), sinceISO, nowISO));
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

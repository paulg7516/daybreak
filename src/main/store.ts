// src/main/store.ts
import ElectronStore from 'electron-store';
import {
  emptyOverlay,
  setAwayWindow as setAwayWindowR,
  clearItem as clearItemR,
  unclearItem as unclearItemR,
  rerankItem as rerankItemR,
  setJiraConfig as setJiraConfigR,
  type Overlay,
} from '../app/overlay';
import { addRule as addRuleR, removeRule as removeRuleR, setBulkExclude as setBulkExcludeR, forceInclude as forceIncludeR, type Rule } from '../app/rules';
import type { Lane } from '../model/item';

// electron-store persists a single "overlay" key. Email content is never stored;
// only the away window, cleared ids, re-rank overrides, rules, and forced-include
// entries live here.
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

export function clearItem(id: string): Overlay {
  return update(clearItemR(getOverlay(), id));
}

export function unclearItem(id: string): Overlay {
  return update(unclearItemR(getOverlay(), id));
}

export function rerankItem(id: string, lane: Lane): Overlay {
  return update(rerankItemR(getOverlay(), id, lane));
}

export function addRule(rule: Rule): Overlay {
  return update(addRuleR(getOverlay(), rule));
}

export function removeRule(id: string): Overlay {
  return update(removeRuleR(getOverlay(), id));
}

export function setBulkExclude(enabled: boolean): Overlay {
  return update(setBulkExcludeR(getOverlay(), enabled));
}

export function promoteSetAside(id: string, lane: Lane): Overlay {
  return update(forceIncludeR(getOverlay(), id, lane));
}

export function getJiraConfig(): { baseUrl: string; email: string } | null {
  return getOverlay().jira;
}

export function setJiraConfig(baseUrl: string, email: string): Overlay {
  return update(setJiraConfigR(getOverlay(), baseUrl, email));
}

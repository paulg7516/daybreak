// src/renderer/bridge.ts
import type { DaybreakBridge } from '../app/ipc-types';

// The preload script exposes window.daybreak. Read it lazily on each property
// access (via a Proxy) rather than capturing it once at import time, so the handle
// is always live - this also lets tests install a mock window.daybreak in beforeEach.
export const daybreak: DaybreakBridge = new Proxy({} as DaybreakBridge, {
  get(_target, prop) {
    const real = (window as unknown as { daybreak: DaybreakBridge }).daybreak;
    return real[prop as keyof DaybreakBridge];
  },
});

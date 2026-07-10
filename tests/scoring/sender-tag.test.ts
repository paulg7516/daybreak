// tests/scoring/sender-tag.test.ts
import { describe, it, expect } from 'vitest';
import { parseDeclaredIntent } from '../../src/scoring/sender-tag';

describe('parseDeclaredIntent', () => {
  it('returns null when no X-PTO-Triage header is present', () => {
    expect(parseDeclaredIntent(undefined)).toBeNull();
    expect(parseDeclaredIntent({ 'X-Other': 'foo' })).toBeNull();
  });

  it('maps each intent to its lane, case-insensitively', () => {
    expect(parseDeclaredIntent({ 'x-pto-triage': 'input' })).toEqual({ lane: 'input' });
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'DECISION' })).toEqual({ lane: 'decision' });
    expect(parseDeclaredIntent({ 'X-Pto-Triage': 'fyi' })).toEqual({ lane: 'fyi' });
  });

  it('reads an optional by= deadline on actionable intents', () => {
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'decision;by=2026-06-20' }))
      .toEqual({ lane: 'decision', deadline: '2026-06-20' });
  });

  it('never attaches a deadline to fyi', () => {
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'fyi;by=2026-06-20' })).toEqual({ lane: 'fyi' });
  });

  it('folds the legacy intent vocabulary into the current lanes', () => {
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'respond' })).toEqual({ lane: 'input' });
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'review' })).toEqual({ lane: 'input' });
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'approve;by=2026-06-20' })).toEqual({ lane: 'decision', deadline: '2026-06-20' });
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'whenever' })).toEqual({ lane: 'input' });
  });

  it('returns null for an unknown value', () => {
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'urgent' })).toBeNull();
  });
});

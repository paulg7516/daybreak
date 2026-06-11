// tests/scoring/sender-tag.test.ts
import { describe, it, expect } from 'vitest';
import { parseDeclaredIntent } from '../../src/scoring/sender-tag';

describe('parseDeclaredIntent', () => {
  it('returns null when no X-PTO-Triage header is present', () => {
    expect(parseDeclaredIntent(undefined)).toBeNull();
    expect(parseDeclaredIntent({ 'X-Other': 'foo' })).toBeNull();
  });

  it('maps each intent to its lane, case-insensitively', () => {
    expect(parseDeclaredIntent({ 'x-pto-triage': 'respond' })).toEqual({ lane: 'respond' });
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'APPROVE' })).toEqual({ lane: 'approve' });
    expect(parseDeclaredIntent({ 'X-Pto-Triage': 'review' })).toEqual({ lane: 'review' });
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'fyi' })).toEqual({ lane: 'fyi' });
  });

  it('reads an optional by= deadline on actionable intents', () => {
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'approve;by=2026-06-20' }))
      .toEqual({ lane: 'approve', deadline: '2026-06-20' });
  });

  it('never attaches a deadline to fyi', () => {
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'fyi;by=2026-06-20' })).toEqual({ lane: 'fyi' });
  });

  it('aliases the legacy expectation vocabulary', () => {
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'blocked' })).toEqual({ lane: 'respond' });
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'action;by=2026-06-20' })).toEqual({ lane: 'approve', deadline: '2026-06-20' });
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'whenever' })).toEqual({ lane: 'review' });
  });

  it('returns null for an unknown value', () => {
    expect(parseDeclaredIntent({ 'X-PTO-Triage': 'urgent' })).toBeNull();
  });
});

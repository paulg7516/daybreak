// tests/scoring/sender-tag.test.ts
import { describe, it, expect } from 'vitest';
import { parseSenderTag } from '../../src/scoring/sender-tag';

describe('parseSenderTag', () => {
  it('returns null when no header present', () => {
    expect(parseSenderTag(undefined)).toBeNull();
    expect(parseSenderTag({ 'X-Other': 'foo' })).toBeNull();
  });

  it('parses simple tags case-insensitively', () => {
    expect(parseSenderTag({ 'x-pto-triage': 'blocked' })).toEqual({ tag: 'blocked' });
    expect(parseSenderTag({ 'X-PTO-Triage': 'WHENEVER' })).toEqual({ tag: 'whenever' });
    expect(parseSenderTag({ 'X-Pto-Triage': 'fyi' })).toEqual({ tag: 'fyi' });
  });

  it('parses an action tag with a by= date', () => {
    expect(parseSenderTag({ 'X-PTO-Triage': 'action;by=2026-06-20' }))
      .toEqual({ tag: 'action', by: '2026-06-20' });
  });

  it('parses an action tag with no date', () => {
    expect(parseSenderTag({ 'X-PTO-Triage': 'action' })).toEqual({ tag: 'action', by: undefined });
  });

  it('returns null for an unknown tag value', () => {
    expect(parseSenderTag({ 'X-PTO-Triage': 'urgent' })).toBeNull();
  });
});

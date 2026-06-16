// addin/tests/tag.test.js
import { describe, it, expect } from 'vitest';
import { buildTagValue, formatByDate, parseTagValue, validateBccAddress } from '../src/tag.js';

describe('formatByDate', () => {
  it('passes a valid YYYY-MM-DD string through', () => {
    expect(formatByDate('2026-06-20')).toBe('2026-06-20');
  });
  it('formats a Date to YYYY-MM-DD (local date parts)', () => {
    expect(formatByDate(new Date(2026, 5, 9))).toBe('2026-06-09'); // month is 0-based: 5 = June
  });
  it('returns null for an unparseable value', () => {
    expect(formatByDate('not-a-date')).toBeNull();
    expect(formatByDate('')).toBeNull();
  });
});

describe('buildTagValue', () => {
  it('builds the four bare intents (no deadline)', () => {
    expect(buildTagValue('respond')).toBe('respond');
    expect(buildTagValue('approve')).toBe('approve');
    expect(buildTagValue('review')).toBe('review');
    expect(buildTagValue('fyi')).toBe('fyi');
  });
  it('appends ;by= for respond/approve/review when a date is given', () => {
    expect(buildTagValue('respond', '2026-06-15')).toBe('respond;by=2026-06-15');
    expect(buildTagValue('approve', '2026-06-15')).toBe('approve;by=2026-06-15');
    expect(buildTagValue('review', '2026-06-15')).toBe('review;by=2026-06-15');
  });
  it('accepts a Date object as the deadline', () => {
    expect(buildTagValue('respond', new Date(2026, 5, 15))).toBe('respond;by=2026-06-15');
  });
  it('never appends a deadline to fyi, even when a date is passed', () => {
    expect(buildTagValue('fyi', '2026-06-15')).toBe('fyi');
  });
  it('ignores an invalid date and emits the bare intent', () => {
    expect(buildTagValue('respond', 'nope')).toBe('respond');
    expect(buildTagValue('approve', '')).toBe('approve');
  });
  it('throws on an unknown intent', () => {
    expect(() => buildTagValue('urgent')).toThrow();
    expect(() => buildTagValue('action')).toThrow();
  });
});

describe('validateBccAddress', () => {
  it('accepts a normal address', () => {
    expect(validateBccAddress('sarah@company.com')).toBe(true);
  });
  it('rejects junk and empty', () => {
    expect(validateBccAddress('sarah')).toBe(false);
    expect(validateBccAddress('')).toBe(false);
    expect(validateBccAddress('a@b')).toBe(false);
  });
});

describe('parseTagValue', () => {
  it('parses a canonical intent with a deadline', () => {
    expect(parseTagValue('approve;by=2026-06-20')).toEqual({ intent: 'approve', by: '2026-06-20' });
  });
  it('parses a bare intent (no date)', () => {
    expect(parseTagValue('respond')).toEqual({ intent: 'respond', by: null });
  });
  it('maps legacy intent values to canonical lanes', () => {
    expect(parseTagValue('action;by=2026-06-20')).toEqual({ intent: 'approve', by: '2026-06-20' });
    expect(parseTagValue('blocked')).toEqual({ intent: 'respond', by: null });
    expect(parseTagValue('whenever')).toEqual({ intent: 'review', by: null });
  });
  it('drops a date on fyi and rejects non-tags', () => {
    expect(parseTagValue('fyi;by=2026-06-20')).toEqual({ intent: 'fyi', by: null });
    expect(parseTagValue('nonsense')).toBeNull();
    expect(parseTagValue('')).toBeNull();
  });
});

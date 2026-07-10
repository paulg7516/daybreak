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
  it('builds the three bare intents (no deadline)', () => {
    expect(buildTagValue('decision')).toBe('decision');
    expect(buildTagValue('input')).toBe('input');
    expect(buildTagValue('fyi')).toBe('fyi');
  });
  it('appends ;by= for decision/input when a date is given', () => {
    expect(buildTagValue('decision', '2026-06-15')).toBe('decision;by=2026-06-15');
    expect(buildTagValue('input', '2026-06-15')).toBe('input;by=2026-06-15');
  });
  it('accepts a Date object as the deadline', () => {
    expect(buildTagValue('decision', new Date(2026, 5, 15))).toBe('decision;by=2026-06-15');
  });
  it('never appends a deadline to fyi, even when a date is passed', () => {
    expect(buildTagValue('fyi', '2026-06-15')).toBe('fyi');
  });
  it('ignores an invalid date and emits the bare intent', () => {
    expect(buildTagValue('decision', 'nope')).toBe('decision');
    expect(buildTagValue('input', '')).toBe('input');
  });
  it('throws on an unknown or retired intent', () => {
    expect(() => buildTagValue('urgent')).toThrow();
    expect(() => buildTagValue('approve')).toThrow();
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
    expect(parseTagValue('decision;by=2026-06-20')).toEqual({ intent: 'decision', by: '2026-06-20' });
  });
  it('parses a bare intent (no date)', () => {
    expect(parseTagValue('input')).toEqual({ intent: 'input', by: null });
  });
  it('folds legacy intent values into the current lanes', () => {
    expect(parseTagValue('approve;by=2026-06-20')).toEqual({ intent: 'decision', by: '2026-06-20' });
    expect(parseTagValue('respond')).toEqual({ intent: 'input', by: null });
    expect(parseTagValue('review')).toEqual({ intent: 'input', by: null });
    expect(parseTagValue('whenever')).toEqual({ intent: 'input', by: null });
  });
  it('drops a date on fyi and rejects non-tags', () => {
    expect(parseTagValue('fyi;by=2026-06-20')).toEqual({ intent: 'fyi', by: null });
    expect(parseTagValue('nonsense')).toBeNull();
    expect(parseTagValue('')).toBeNull();
  });
});

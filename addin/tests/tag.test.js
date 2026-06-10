// addin/tests/tag.test.js
import { describe, it, expect } from 'vitest';
import { buildTagValue, formatByDate, validateBccAddress } from '../src/tag.js';

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
  it('builds the three simple intents', () => {
    expect(buildTagValue('blocked')).toBe('blocked');
    expect(buildTagValue('whenever')).toBe('whenever');
    expect(buildTagValue('fyi')).toBe('fyi');
  });
  it('builds the action intent with a by-date', () => {
    expect(buildTagValue('action', '2026-06-20')).toBe('action;by=2026-06-20');
  });
  it('throws on action without a valid date', () => {
    expect(() => buildTagValue('action')).toThrow();
    expect(() => buildTagValue('action', 'nope')).toThrow();
  });
  it('throws on an unknown intent', () => {
    expect(() => buildTagValue('urgent')).toThrow();
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

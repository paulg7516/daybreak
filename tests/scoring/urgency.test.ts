// tests/scoring/urgency.test.ts
import { describe, it, expect } from 'vitest';
import { urgencyFor } from '../../src/scoring/urgency';

const now = new Date('2026-06-11T12:00:00Z');

describe('urgencyFor', () => {
  it('returns none when there is no deadline', () => {
    expect(urgencyFor(undefined, now)).toBe('none');
  });
  it('returns overdue for a past deadline', () => {
    expect(urgencyFor('2026-06-09', now)).toBe('overdue');
  });
  it('returns today for a deadline that is today', () => {
    expect(urgencyFor('2026-06-11', now)).toBe('today');
  });
  it('returns this_week for a deadline within 7 days', () => {
    expect(urgencyFor('2026-06-15', now)).toBe('this_week');
    expect(urgencyFor('2026-06-18', now)).toBe('this_week');
  });
  it('returns none for a deadline more than a week out', () => {
    expect(urgencyFor('2026-06-30', now)).toBe('none');
  });
  it('returns none for an unparseable deadline', () => {
    expect(urgencyFor('not-a-date', now)).toBe('none');
  });
});

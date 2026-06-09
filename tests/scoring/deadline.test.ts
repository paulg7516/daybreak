// tests/scoring/deadline.test.ts
import { describe, it, expect } from 'vitest';
import { extractDeadline } from '../../src/scoring/deadline';

// Monday 2026-06-08 08:00 local
const now = new Date('2026-06-08T08:00:00');

describe('extractDeadline', () => {
  it('returns null when there is no deadline', () => {
    expect(extractDeadline('just a friendly note, no rush', now)).toBeNull();
    expect(extractDeadline('', now)).toBeNull();
  });

  it('extracts an ISO date', () => {
    const d = extractDeadline('please finish by 2026-06-20', now);
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe('2026-06-20');
  });

  it('treats EOD and today as end of today', () => {
    const d = extractDeadline('need this by EOD', now);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5); // June (0-indexed)
    expect(d!.getDate()).toBe(8);
    expect(d!.getHours()).toBe(17);
  });

  it('extracts tomorrow', () => {
    const d = extractDeadline('can you reply by tomorrow?', now);
    expect(d!.getDate()).toBe(9);
  });

  it('extracts the next occurrence of a weekday', () => {
    // now is Monday; "by Friday" -> the coming Friday (the 12th)
    const d = extractDeadline('let me know by Friday', now);
    expect(d!.getDate()).toBe(12);
  });

  it('returns the earliest of multiple deadlines', () => {
    const d = extractDeadline('ideally by Friday but hard stop 2026-06-09', now);
    expect(d!.getDate()).toBe(9);
  });

  it('returns null when all candidate dates are in the past', () => {
    // now is 2026-06-08; 2026-05-01 is entirely in the past
    expect(extractDeadline('this was due 2026-05-01', now)).toBeNull();
  });
});

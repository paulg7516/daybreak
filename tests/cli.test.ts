// tests/cli.test.ts
import { describe, it, expect } from 'vitest';
import { run } from '../src/cli';

describe('cli run over fixture', () => {
  it('scores the sample backlog into the expected lanes', () => {
    const { summary, scored } = run('fixtures/sample-backlog.json');

    const lane = (id: string) => scored.find((s) => s.item.id === id)!.lane;
    expect(lane('JSM-101')).toBe('today');   // P1 + SLA at risk, assigned to me
    expect(lane('MAIL-1')).toBe('today');    // action;by=today
    expect(lane('MAIL-2')).toBe('fyi');      // resolved while away
    expect(lane('VEND-1')).toBe('today');    // security advisory
    expect(lane('VEND-2')).toBe('fyi');      // marketing

    expect(summary.needsTodayCount).toBe(3);
    expect(summary.resolvedWhileAwayCount).toBe(1);
    expect(summary.slaAtRiskCount).toBe(1);

    // sorted today-first
    expect(scored[0].lane).toBe('today');
  });
});

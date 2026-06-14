// tests/cli.test.ts
import { describe, it, expect } from 'vitest';
import { run } from '../src/cli';

describe('cli run over fixture', () => {
  it('triages the sample backlog into declared lanes and drops untagged mail', () => {
    const { summary, triaged } = run('fixtures/sample-backlog.json');

    const lane = (id: string) => triaged.find((t) => t.item.id === id)?.lane;
    expect(lane('JSM-101')).toBe('respond'); // assigned P1, SLA breached
    expect(lane('MAIL-1')).toBe('respond');  // respond intent
    expect(lane('MAIL-2')).toBe('approve');  // approve intent
    expect(lane('MAIL-3')).toBe('fyi');      // fyi intent
    expect(lane('MAIL-UNTAGGED')).toBeUndefined(); // untagged -> not on the board

    expect(summary.total).toBe(4);
    expect(summary.needYou).toBe(3);  // respond(2) + approve(1)
    expect(summary.overdue).toBe(1);  // JSM SLA breached

    // sorted respond-first
    expect(triaged[0].lane).toBe('respond');
  });
});

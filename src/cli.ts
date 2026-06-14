// src/cli.ts
import { readFileSync } from 'node:fs';
import { triageAll } from './scoring/triage';
import { applyOverlay, emptyOverlay } from './app/overlay';
import { buildSummary } from './summary/summary';
import type { DaybreakItem, TriageContext } from './model/item';

interface Input {
  context: TriageContext;
  items: DaybreakItem[];
}

function run(path: string): { summary: ReturnType<typeof buildSummary>; triaged: ReturnType<typeof triageAll> } {
  const input = JSON.parse(readFileSync(path, 'utf8')) as Input;
  const triaged = triageAll(input.items, input.context);
  const overlaid = applyOverlay(triaged, emptyOverlay());
  const summary = buildSummary(overlaid);
  return { summary, triaged };
}

const path = process.argv[2];
if (path) {
  const result = run(path);
  console.log(JSON.stringify(result, null, 2));
}

export { run };

// src/cli.ts
import { readFileSync } from 'node:fs';
import { scoreAll } from './scoring/score';
import { buildSummary } from './summary/summary';
import type { DaybreakItem, ScoringContext } from './model/item';

interface Input {
  context: ScoringContext;
  items: DaybreakItem[];
}

function run(path: string): { summary: ReturnType<typeof buildSummary>; scored: ReturnType<typeof scoreAll> } {
  const input = JSON.parse(readFileSync(path, 'utf8')) as Input;
  const scored = scoreAll(input.items, input.context);
  const summary = buildSummary(scored);
  return { summary, scored };
}

const path = process.argv[2];
if (path) {
  const result = run(path);
  console.log(JSON.stringify(result, null, 2));
}

export { run };

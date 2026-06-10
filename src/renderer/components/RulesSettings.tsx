// src/renderer/components/RulesSettings.tsx
import { useState } from 'react';
import type { Rule, RuleField } from '../../app/rules';
import type { Lane } from '../../model/item';

// A new rule's id is derived from its content so the same rule is not added twice;
// Math.random is unavailable in this codebase, so content + field + action is the key.
function ruleId(field: RuleField, value: string, action: string): string {
  return `${action}:${field}:${value.toLowerCase()}`;
}

export function RulesSettings({
  rules,
  bulkExcludeEnabled,
  onAdd,
  onRemove,
  onToggleBulk,
  onClose,
}: {
  rules: Rule[];
  bulkExcludeEnabled: boolean;
  onAdd: (rule: Rule) => void;
  onRemove: (id: string) => void;
  onToggleBulk: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [action, setAction] = useState<'include' | 'exclude'>('include');
  const [lane, setLane] = useState<Lane>('today');

  const field: RuleField = value.includes('@') ? 'from' : 'from-domain';

  function submit() {
    const v = value.trim().toLowerCase();
    if (!v) return;
    onAdd({ id: ruleId(field, v, action), field, value: v, action, lane: action === 'include' ? lane : null });
    setValue('');
  }

  return (
    <div className="min-h-dvh bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Rules</h1>
        <button type="button" onClick={onClose} className="text-sm underline">Done</button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={bulkExcludeEnabled} onChange={(e) => onToggleBulk(e.target.checked)} />
        Set aside automated and bulk mail (newsletters, notifications)
      </label>

      <ul className="mt-4 space-y-1">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 text-sm">
            <span className="flex-1">
              <strong>{r.action}</strong> {r.field === 'from' ? 'from' : 'domain'} {r.value}
              {r.action === 'include' && r.lane ? ` -> ${r.lane}` : ''}
            </span>
            <button type="button" onClick={() => onRemove(r.id)} className="text-red-600 underline">Remove</button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block">Sender or domain</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="boss@company.com or company.com"
            className="mt-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1"
          />
        </label>
        <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value as 'include' | 'exclude')} className="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm">
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
        {action === 'include' && (
          <select aria-label="Lane" value={lane} onChange={(e) => setLane(e.target.value as Lane)} className="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm">
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="fyi">FYI</option>
          </select>
        )}
        <button type="button" onClick={submit} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Add rule</button>
      </div>
    </div>
  );
}

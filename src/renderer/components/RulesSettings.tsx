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
    <div className="min-h-dvh bg-bg text-ink p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Rules</h1>
        <button type="button" onClick={onClose} className="text-[13px] font-medium text-ink-2 underline transition-colors hover:text-ink">Done</button>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
        <input type="checkbox" checked={bulkExcludeEnabled} onChange={(e) => onToggleBulk(e.target.checked)} className="rounded" />
        Set aside automated and bulk mail (newsletters, notifications)
      </label>

      <ul className="mt-4 space-y-1.5">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 text-[13px] bg-surface border border-line rounded-md px-3 py-2">
            <span className="flex-1 text-ink">
              <strong className="font-semibold">{r.action}</strong> {r.field === 'from' ? 'from' : 'domain'} {r.value}
              {r.action === 'include' && r.lane ? ` (${r.lane.replace('_', ' ')})` : ''}
            </span>
            <button type="button" onClick={() => onRemove(r.id)} className="text-[12px] font-medium text-today underline transition-colors hover:text-today">Remove</button>
          </li>
        ))}
      </ul>

      <form className="mt-5 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="text-[13px] text-ink">
          <span className="block font-medium mb-1">Sender or domain</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="boss@company.com or company.com"
            className="rounded-md border border-line-strong bg-surface text-ink px-3 py-[6px] text-[13px] transition-colors focus:border-brand outline-none"
          />
        </label>
        <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value as 'include' | 'exclude')} className="rounded-md border border-line-strong bg-surface text-ink-2 px-2 py-[6px] text-[13px] transition-colors hover:border-ink-3">
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
        {action === 'include' && (
          <select aria-label="Lane" value={lane} onChange={(e) => setLane(e.target.value as Lane)} className="rounded-md border border-line-strong bg-surface text-ink-2 px-2 py-[6px] text-[13px] transition-colors hover:border-ink-3">
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="fyi">FYI</option>
          </select>
        )}
        <button type="submit" className="rounded-md bg-brand px-3 py-[6px] text-[13px] font-medium text-white transition-colors hover:opacity-90">Add rule</button>
      </form>
    </div>
  );
}

// src/renderer/components/RulesSettings.tsx
import { useState } from 'react';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
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

  const inputClass = 'rounded-lg border border-line-strong bg-panel text-ink px-3 py-2 text-[13px] transition-colors focus:border-accent outline-none placeholder:text-ink-3';
  const selectClass = 'rounded-lg border border-line-strong bg-panel text-ink-2 px-2.5 py-2 text-[13px] transition-colors hover:border-ink-3 cursor-pointer';

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="elev-panel rounded-xl p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} strokeWidth={2} className="text-accent" />
              <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Rules</h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              Done
            </button>
          </div>

          {/* Bulk checkbox */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3 text-[13px] text-ink transition-colors hover:border-line-strong">
            <input
              type="checkbox"
              checked={bulkExcludeEnabled}
              onChange={(e) => onToggleBulk(e.target.checked)}
              className="mt-0.5 rounded accent-accent"
            />
            <span>Set aside automated and bulk mail (newsletters, notifications)</span>
          </label>

          {/* Rule list */}
          {rules.length > 0 && (
            <ul className="mt-5 space-y-2">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-4 py-2.5 text-[13px]">
                  <span className="flex-1 text-ink">
                    <strong className="font-semibold">{r.action}</strong>{' '}
                    {r.field === 'from' ? 'from' : 'domain'} {r.value}
                    {r.action === 'include' && r.lane ? ` (${r.lane.replace('_', ' ')})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(r.id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-today transition-colors hover:bg-today-tint"
                    aria-label="Remove"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add rule form */}
          <form
            className="mt-5 flex flex-wrap items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <label className="text-[13px] text-ink">
              <span className="mb-1 block font-medium">Sender or domain</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="boss@company.com or company.com"
                className={inputClass}
              />
            </label>
            <select
              aria-label="Action"
              value={action}
              onChange={(e) => setAction(e.target.value as 'include' | 'exclude')}
              className={selectClass}
            >
              <option value="include">Include</option>
              <option value="exclude">Exclude</option>
            </select>
            {action === 'include' && (
              <select
                aria-label="Lane"
                value={lane}
                onChange={(e) => setLane(e.target.value as Lane)}
                className={selectClass}
              >
                <option value="today">Today</option>
                <option value="this_week">This week</option>
                <option value="fyi">FYI</option>
              </select>
            )}
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              Add rule
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

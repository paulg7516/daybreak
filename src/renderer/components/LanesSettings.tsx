// src/renderer/components/LanesSettings.tsx
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { LaneSetting } from '../../app/lane-config';

// Rename, show/hide, and reorder lanes. The lane id is fixed (it maps to the
// sender's declared intent); only the display changes. Every edit produces a new
// config and calls onChange, which persists it.
export function LanesSettings({
  config,
  onChange,
}: {
  config: LaneSetting[];
  onChange: (config: LaneSetting[]) => void;
}) {
  const update = (i: number, patch: Partial<LaneSetting>) => {
    onChange(config.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= config.length) return;
    const next = [...config];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <p className="mb-4 text-[13px] text-ink-2">
        Rename, hide, or reorder the lanes on your board. Hidden lanes still receive their items, they just are not shown.
      </p>
      <div className="flex flex-col gap-2">
        {config.map((c, i) => (
          <div key={c.lane} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-2">
            <div className="flex flex-col">
              <button type="button" aria-label={`Move ${c.lane} up`} disabled={i === 0} onClick={() => move(i, -1)}
                className="grid h-4 w-5 place-items-center text-ink-3 transition-colors hover:text-ink disabled:opacity-30">
                <ArrowUp size={12} />
              </button>
              <button type="button" aria-label={`Move ${c.lane} down`} disabled={i === config.length - 1} onClick={() => move(i, 1)}
                className="grid h-4 w-5 place-items-center text-ink-3 transition-colors hover:text-ink disabled:opacity-30">
                <ArrowDown size={12} />
              </button>
            </div>
            <label className="flex items-center" title={c.visible ? 'Visible' : 'Hidden'}>
              <input type="checkbox" aria-label={`Show ${c.lane} lane`} checked={c.visible} onChange={(e) => update(i, { visible: e.target.checked })} className="accent-accent" />
            </label>
            <input
              aria-label={`Label for ${c.lane}`}
              value={c.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] text-ink transition-colors focus:border-accent outline-none"
            />
            <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wide text-ink-3">{c.lane}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// src/renderer/components/LanesSettings.tsx
import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { LaneSetting } from '../../app/lane-config';

// Rename, show/hide, and reorder lanes. The lane id is fixed (it maps to the
// sender's declared intent); only the display changes. Reorder is drag-and-drop via
// the grip handle, with arrow-key support on the handle so it stays keyboard-usable.
export function LanesSettings({
  config,
  onChange,
}: {
  config: LaneSetting[];
  onChange: (config: LaneSetting[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const update = (i: number, patch: Partial<LaneSetting>) => {
    onChange(config.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  // keyboard nudge (arrow keys on the handle)
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= config.length) return;
    const next = [...config];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  // drag-drop: pull item out of `from`, insert at `to`
  const reorder = (from: number | null, to: number) => {
    if (from === null || from === to) return;
    const next = [...config];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {config.map((c, i) => (
        <div
          key={c.lane}
          onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
          onDragLeave={() => setOverIdx((v) => (v === i ? null : v))}
          onDrop={() => { reorder(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
          className={`flex items-center gap-2 rounded-lg border bg-panel px-2.5 py-2 transition-colors ${
            overIdx === i && dragIdx !== null && dragIdx !== i ? 'border-accent' : 'border-line'
          } ${dragIdx === i ? 'opacity-50' : ''}`}
        >
          <button
            type="button"
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); }
            }}
            aria-label={`Reorder ${c.lane} lane. Drag, or use the up and down arrow keys.`}
            title="Drag to reorder"
            className="grid h-7 w-5 shrink-0 cursor-grab place-items-center rounded text-ink-3 transition-colors hover:text-ink active:cursor-grabbing"
          >
            <GripVertical size={15} />
          </button>
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
  );
}

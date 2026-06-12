// src/renderer/components/KeyboardLegend.tsx
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-panel-2 px-1.5 py-0.5 font-mono text-[10.5px] leading-none text-ink-2">{children}</kbd>
  );
}

// A visible shortcut legend so keyboard triage is discoverable (otherwise nobody
// finds it). Reads as a quiet strip above the lanes.
export function KeyboardLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-[11px] text-ink-3">
      <span className="font-semibold uppercase tracking-wide text-ink-3">Keyboard</span>
      <span className="flex items-center gap-1"><Kbd>j</Kbd><Kbd>k</Kbd> move</span>
      <span className="flex items-center gap-1"><Kbd>e</Kbd> clear</span>
      <span className="flex items-center gap-1"><Kbd>o</Kbd> open</span>
      <span className="flex items-center gap-1"><Kbd>space</Kbd> select</span>
      <span className="flex items-center gap-1"><Kbd>esc</Kbd> deselect</span>
    </div>
  );
}

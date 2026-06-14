// src/renderer/components/ClearedDrawer.tsx
import { Undo2, X } from 'lucide-react';
import type { ClearedRow } from '../../app/view-model';

function relTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Recovery list for cleared items. Nothing was deleted - clearing only hides an
// item - so every row here can be restored to its lane.
export function ClearedDrawer({
  items,
  onRestore,
  onRestoreAll,
  onClose,
}: {
  items: ClearedRow[];
  onRestore: (id: string) => void;
  onRestoreAll: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="flex h-dvh w-80 max-w-[85vw] flex-col border-l border-line bg-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink">Cleared <span className="text-ink-3">({items.length})</span></h2>
          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <button type="button" onClick={onRestoreAll} className="rounded-md px-2 py-1 text-[12px] font-medium text-accent transition-colors hover:bg-accent/10">Restore all</button>
            )}
            <button type="button" aria-label="Close" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink">
              <X size={15} />
            </button>
          </div>
        </div>

        <p className="border-b border-line px-4 py-2 text-[11.5px] text-ink-3">
          Cleared items are only hidden, never deleted. Restore any you cleared by mistake.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">Nothing cleared.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="group flex items-start gap-2 border-b border-line px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">{it.subject}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-2">
                    <span className="truncate">{it.from}</span>
                    <span className="shrink-0 font-mono tabular-nums text-ink-3">{relTime(it.receivedAt)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(it.id)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[11.5px] font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                >
                  <Undo2 size={12} /> Restore
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

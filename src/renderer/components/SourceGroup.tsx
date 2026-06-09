// src/renderer/components/SourceGroup.tsx
import { useState } from 'react';
import type { SourceGroupView, ScoredItemView } from '../../app/view-model';
import type { Source } from '../../model/item';
import { ItemRow } from './ItemRow';

const SOURCE_LABEL: Record<Source, string> = {
  jsm: 'System',
  email_internal: 'Internal',
  email_vendor: 'Vendor',
};

export function SourceGroup({
  group,
  onOpen,
  onClear,
  onRerank,
}: {
  group: SourceGroupView;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: ScoredItemView['lane']) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        <span>{SOURCE_LABEL[group.source]}</span>
        <span className="tabular-nums">{group.items.length}</span>
      </button>
      {open && group.items.map((row) => (
        <ItemRow key={row.id} row={row} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
      ))}
    </section>
  );
}

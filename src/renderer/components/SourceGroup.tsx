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

const DOT_COLOR: Record<Source, string> = {
  jsm: 'bg-brand',
  email_internal: 'bg-good',
  email_vendor: 'bg-week',
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
  const dotColor = DOT_COLOR[group.source];
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-[7px] px-3 py-[7px] pl-[14px] pb-[5px] text-[10.5px] font-semibold uppercase tracking-[.06em] text-ink-3 transition-colors hover:text-ink-2"
      >
        <span className={`inline-block w-[5px] h-[5px] rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
        <span>{SOURCE_LABEL[group.source]}</span>
        <span className="tabular-nums ml-auto">{group.items.length}</span>
      </button>
      {open && group.items.map((row) => (
        <ItemRow key={row.id} row={row} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
      ))}
    </section>
  );
}

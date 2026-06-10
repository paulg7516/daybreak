// src/renderer/components/SourceGroup.tsx
import { useState } from 'react';
import { Ticket, Users, Store, ChevronDown } from 'lucide-react';
import type { SourceGroupView, ScoredItemView } from '../../app/view-model';
import type { Source } from '../../model/item';
import { ItemRow } from './ItemRow';

const SOURCE_LABEL: Record<Source, string> = {
  jsm: 'System',
  email_internal: 'Internal',
  email_vendor: 'Vendor',
};

const SOURCE_ICON: Record<Source, React.ReactNode> = {
  jsm: <Ticket size={13} strokeWidth={2} className="text-accent shrink-0" />,
  email_internal: <Users size={13} strokeWidth={2} className="text-good shrink-0" />,
  email_vendor: <Store size={13} strokeWidth={2} className="text-week shrink-0" />,
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
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[.06em] text-ink-3 transition-colors hover:text-ink-2 hover:bg-panel-2"
      >
        {SOURCE_ICON[group.source]}
        <span>{SOURCE_LABEL[group.source]}</span>
        <span className="font-mono tabular-nums ml-auto">{group.items.length}</span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={`shrink-0 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </button>
      {open && group.items.map((row) => (
        <ItemRow key={row.id} row={row} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
      ))}
    </section>
  );
}

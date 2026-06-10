// src/renderer/components/Lane.tsx
import type { LaneView, ScoredItemView } from '../../app/view-model';
import type { Lane as LaneId } from '../../model/item';
import { SourceGroup } from './SourceGroup';

const RAIL_COLOR: Record<LaneId, string> = {
  today: 'bg-today',
  this_week: 'bg-week',
  fyi: 'bg-fyi',
};

export function Lane({
  laneView,
  title,
  onOpen,
  onClear,
  onRerank,
}: {
  laneView: LaneView;
  title: string;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: ScoredItemView['lane']) => void;
}) {
  const railColor = RAIL_COLOR[laneView.lane];
  return (
    <div className="bg-surface border border-line rounded-lg shadow-sm overflow-hidden">
      <div className="relative flex items-center justify-between px-3 py-[10px] pl-[14px] border-b border-line">
        <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${railColor}`} aria-hidden="true" />
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <span className="tabular-nums text-[12px] font-semibold text-ink-2 bg-surface-2 border border-line rounded-full px-2 py-px">{laneView.total}</span>
      </div>
      {laneView.groups.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-ink-3">Nothing here.</p>
      ) : (
        laneView.groups.map((g) => (
          <SourceGroup key={g.source} group={g} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
        ))
      )}
    </div>
  );
}

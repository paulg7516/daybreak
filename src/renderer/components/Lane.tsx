// src/renderer/components/Lane.tsx
import { Flame, Clock, Inbox } from 'lucide-react';
import type { LaneView, ScoredItemView } from '../../app/view-model';
import type { Lane as LaneId } from '../../model/item';
import { SourceGroup } from './SourceGroup';

const RAIL_COLOR: Record<LaneId, string> = {
  today: 'bg-today',
  this_week: 'bg-week',
  fyi: 'bg-fyi',
};

const LANE_ICON: Record<LaneId, React.ReactNode> = {
  today: <Flame size={14} strokeWidth={2} className="text-today" />,
  this_week: <Clock size={14} strokeWidth={2} className="text-week" />,
  fyi: <Inbox size={14} strokeWidth={2} className="text-fyi" />,
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
    <div className="elev-panel rounded-xl overflow-hidden">
      {/* colored top rail */}
      <div className={`h-[3px] w-full ${railColor}`} aria-hidden="true" />
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-line">
        <div className="flex items-center gap-2">
          {LANE_ICON[laneView.lane]}
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        </div>
        <span className="font-mono text-[12px] font-semibold text-ink-2 bg-panel-2 border border-line rounded-full px-2 py-px tabular-nums">{laneView.total}</span>
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

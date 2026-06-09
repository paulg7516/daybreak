// src/renderer/components/Lane.tsx
import type { LaneView, ScoredItemView } from '../../app/view-model';
import { SourceGroup } from './SourceGroup';

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
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="tabular-nums text-slate-500">{laneView.total}</span>
      </div>
      {laneView.groups.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing here.</p>
      ) : (
        laneView.groups.map((g) => (
          <SourceGroup key={g.source} group={g} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
        ))
      )}
    </div>
  );
}

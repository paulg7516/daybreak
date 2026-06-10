// tests/renderer/App-setaside.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';
import type { TriageView } from '../../src/app/view-model';

const emptyLane = (lane: 'today' | 'this_week' | 'fyi') => ({ lane, total: 0, groups: [] });
const triage: TriageView = {
  me: 'me@co.com',
  awaySince: '2026-05-25T00:00:00.000Z',
  summary: { needsTodayCount: 0, thisWeekCount: 0, fyiCount: 0, slaAtRiskCount: 0, resolvedWhileAwayCount: 0 },
  lanes: { today: emptyLane('today'), this_week: emptyLane('this_week'), fyi: emptyLane('fyi') },
  clearedCount: 0,
  setAside: { total: 1, items: [{ id: 'a', subject: 'Newsletter', from: 'news@v.com', receivedAt: '2026-05-30T09:00:00.000Z', reason: 'automated' }] },
};

beforeEach(() => {
  (window as unknown as { daybreak: unknown }).daybreak = {
    getView: vi.fn().mockResolvedValue(triage),
    setAwayWindow: vi.fn(), refresh: vi.fn().mockResolvedValue(triage),
    clearItem: vi.fn(), unclearItem: vi.fn(), rerankItem: vi.fn(), openItem: vi.fn(),
    getRules: vi.fn().mockResolvedValue({ rules: [], bulkExcludeEnabled: true }),
    addRule: vi.fn(), removeRule: vi.fn(), setBulkExclude: vi.fn(), promoteSetAside: vi.fn().mockResolvedValue(triage),
    onIngest: vi.fn().mockReturnValue(() => {}),
  };
});

describe('App set-aside', () => {
  it('shows the Set-aside bin on the triage surface', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /set aside.*1/i })).toBeInTheDocument();
  });
});

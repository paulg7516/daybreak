// tests/renderer/Triage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/renderer/App';
import type { TriageView } from '../../src/app/view-model';

const view: TriageView = {
  me: 'you@co.com',
  since: '2026-06-04T00:00:00.000Z',
  summary: { total: 2, needYou: 2, overdue: 0, byLane: { respond: 2, approve: 0, review: 0, fyi: 0 } },
  lanes: [
    { lane: 'respond', total: 2, items: [
      { id: 'r1', subject: 'Answer me', from: 'a@co.com', receivedAt: '2026-06-10T09:00:00Z', lane: 'respond', urgency: 'none', reasons: [], source: 'email_internal', reranked: false },
      { id: 'r2', subject: 'And me', from: 'b@co.com', receivedAt: '2026-06-09T09:00:00Z', lane: 'respond', urgency: 'none', reasons: [], source: 'email_internal', reranked: false },
    ] },
    { lane: 'approve', total: 0, items: [] },
    { lane: 'review', total: 0, items: [] },
    { lane: 'fyi', total: 0, items: [] },
  ],
  clearedCount: 0,
};

let clearItem: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  clearItem = vi.fn().mockResolvedValue(undefined);
  (window as unknown as { daybreak: unknown }).daybreak = {
    getView: vi.fn().mockResolvedValue(view),
    setAwayWindow: vi.fn(),
    refresh: vi.fn().mockResolvedValue(view),
    clearItem,
    unclearItem: vi.fn(),
    rerankItem: vi.fn(),
    openItem: vi.fn(),
    getLaneConfig: vi.fn().mockResolvedValue([]),
    setLaneConfig: vi.fn(),
    onIngest: vi.fn().mockReturnValue(() => {}),
  };
});

describe('bulk + keyboard triage', () => {
  it('keyboard-selects a row and bulk-clears it', async () => {
    render(<App />);
    await screen.findByText('Answer me');

    await userEvent.keyboard('j'); // focus first row
    await userEvent.keyboard(' '); // select it
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear selected' }));
    expect(clearItem).toHaveBeenCalledWith('r1');
  });

  it('clears the focused row with the e key', async () => {
    render(<App />);
    await screen.findByText('Answer me');
    await userEvent.keyboard('j'); // focus r1
    await userEvent.keyboard('e'); // clear focused
    expect(clearItem).toHaveBeenCalledWith('r1');
  });
});

// tests/renderer/Layout.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/renderer/App';
import type { TriageView } from '../../src/app/view-model';

const view: TriageView = {
  me: 'you@co.com',
  since: '2026-06-04T00:00:00.000Z',
  summary: { total: 1, needYou: 1, overdue: 0, byLane: { respond: 1, approve: 0, review: 0, fyi: 0 } },
  lanes: [
    { lane: 'respond', total: 1, items: [{ id: 'r1', subject: 'Answer me', from: 'a@co.com', receivedAt: '2026-06-10T09:00:00Z', lane: 'respond', urgency: 'none', reasons: [], source: 'email_internal', reranked: false }] },
    { lane: 'approve', total: 0, items: [] },
    { lane: 'review', total: 0, items: [] },
    { lane: 'fyi', total: 0, items: [] },
  ],
  clearedCount: 0,
};

beforeEach(() => {
  localStorage.clear();
  (window as unknown as { daybreak: unknown }).daybreak = {
    getView: vi.fn().mockResolvedValue(view),
    setAwayWindow: vi.fn(),
    refresh: vi.fn().mockResolvedValue(view),
    clearItem: vi.fn(),
    unclearItem: vi.fn(),
    rerankItem: vi.fn(),
    openItem: vi.fn(),
    getLaneConfig: vi.fn().mockResolvedValue([]),
    setLaneConfig: vi.fn(),
    getJiraConfig: vi.fn().mockResolvedValue({ baseUrl: '', email: '', hasToken: false }),
    onIngest: vi.fn().mockReturnValue(() => {}),
  };
});

describe('layout toggle', () => {
  it('defaults to the stacked board and switches to columns', async () => {
    render(<App />);
    const boardBtn = await screen.findByRole('button', { name: /board layout/i });
    const columnsBtn = screen.getByRole('button', { name: /columns layout/i });

    expect(boardBtn).toHaveAttribute('aria-pressed', 'true');
    expect(columnsBtn).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(columnsBtn);
    expect(columnsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(boardBtn).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('daybreak.layout')).toBe('columns');
  });
});

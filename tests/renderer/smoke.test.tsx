import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';

// Smoke test: App mounts without crashing when bridge is available.
beforeEach(() => {
  (window as unknown as { daybreak: unknown }).daybreak = {
    getView: vi.fn().mockResolvedValue({
      me: 'you@co.com',
      since: '2026-06-04T00:00:00.000Z',
      filterSince: null,
      summary: { total: 0, needYou: 0, overdue: 0, byLane: { respond: 0, approve: 0, review: 0, fyi: 0 } },
      lanes: [
        { lane: 'respond', total: 0, items: [] },
        { lane: 'approve', total: 0, items: [] },
        { lane: 'review', total: 0, items: [] },
        { lane: 'fyi', total: 0, items: [] },
      ],
      cleared: [],
    }),
    setAwayWindow: vi.fn(),
    clearAwayWindow: vi.fn(),
    refresh: vi.fn(),
    clearItem: vi.fn(),
    unclearItem: vi.fn(),
    rerankItem: vi.fn(),
    openItem: vi.fn(),
    getLaneConfig: vi.fn().mockResolvedValue([]),
    setLaneConfig: vi.fn(),
    onIngest: vi.fn().mockReturnValue(() => {}),
  };
});

describe('App', () => {
  it('mounts with a loading state, then routes once the view resolves', async () => {
    render(<App />);
    // Before getView resolves, the app shows a fetching status.
    expect(screen.getByText(/fetching your mail/i)).toBeInTheDocument();
    // Await the resolved view so the pending getView promise settles inside act()
    // (no unmounted-update warning at teardown).
    expect(await screen.findByText(/filter by date/i)).toBeInTheDocument();
  });
});

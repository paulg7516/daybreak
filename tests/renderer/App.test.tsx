// tests/renderer/App.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';

beforeEach(() => {
  (window as unknown as { daybreak: unknown }).daybreak = {
    getView: vi.fn().mockResolvedValue({ needsAwayWindow: true }),
    setAwayWindow: vi.fn(),
    refresh: vi.fn(),
    clearItem: vi.fn(),
    unclearItem: vi.fn(),
    rerankItem: vi.fn(),
    openItem: vi.fn(),
    onIngest: vi.fn().mockReturnValue(() => {}),
  };
});

describe('App', () => {
  it('shows the away-window modal when no window is set', async () => {
    render(<App />);
    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
  });
});

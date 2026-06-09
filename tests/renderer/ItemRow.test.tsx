// tests/renderer/ItemRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemRow } from '../../src/renderer/components/ItemRow';
import type { ScoredItemView } from '../../src/app/view-model';

const row: ScoredItemView = {
  id: 'm1', subject: 'Budget sign-off', from: 'boss@co.com', receivedAt: '2026-05-30T09:00:00.000Z',
  reasons: ['Direct ask', 'Blocked tag'], resolved: false, senderTag: 'blocked',
  webLink: 'https://outlook.example/m1', lane: 'today', reranked: false,
};

describe('ItemRow', () => {
  it('renders subject, sender, reasons, and the sender-tag badge', () => {
    render(<ItemRow row={row} onOpen={() => {}} onClear={() => {}} onRerank={() => {}} />);
    expect(screen.getByText('Budget sign-off')).toBeInTheDocument();
    expect(screen.getByText('boss@co.com')).toBeInTheDocument();
    // The reasons render joined in one element: "Direct ask · Blocked tag".
    expect(screen.getByText(/Direct ask . Blocked tag/)).toBeInTheDocument();
    // Exact match targets the sender-tag badge only, not the "Blocked tag" reason text.
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('invokes onOpen with the webLink when Open is clicked', async () => {
    const onOpen = vi.fn();
    render(<ItemRow row={row} onOpen={onOpen} onClear={() => {}} onRerank={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(onOpen).toHaveBeenCalledWith('https://outlook.example/m1');
  });

  it('invokes onClear with the id when Clear is clicked', async () => {
    const onClear = vi.fn();
    render(<ItemRow row={row} onOpen={() => {}} onClear={onClear} onRerank={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalledWith('m1');
  });
});

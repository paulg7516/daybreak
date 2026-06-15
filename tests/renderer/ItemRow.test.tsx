// tests/renderer/ItemRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemRow } from '../../src/renderer/components/ItemRow';
import type { TriageRow } from '../../src/app/view-model';

const row: TriageRow = {
  id: 'm1',
  subject: 'Budget sign-off',
  from: 'boss@co.com',
  fromName: 'Dana Boss',
  receivedAt: '2026-05-30T09:00:00.000Z',
  lane: 'approve',
  urgency: 'today',
  deadline: '2026-05-30',
  reasons: ['sender: approve', 'due 2026-05-30'],
  source: 'email_internal',
  webLink: 'https://outlook.example/m1',
  reranked: false,
};

describe('ItemRow', () => {
  it('renders subject, sender, and the urgency badge', () => {
    render(<ItemRow row={row} onOpen={() => {}} onClear={() => {}} onRerank={() => {}} />);
    expect(screen.getByText('Budget sign-off')).toBeInTheDocument();
    expect(screen.getByText('Dana Boss')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument(); // urgency badge
    expect(screen.getByText('due 2026-05-30')).toBeInTheDocument(); // reason, sans the internal "sender:" tag
  });

  it('renders no urgency badge when urgency is none', () => {
    render(<ItemRow row={{ ...row, urgency: 'none' }} onOpen={() => {}} onClear={() => {}} onRerank={() => {}} />);
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  it('opens the item when the row is clicked', async () => {
    const onOpen = vi.fn();
    const { container } = render(<ItemRow row={row} onOpen={onOpen} onClear={() => {}} onRerank={() => {}} />);
    await userEvent.click(container.querySelector('[data-row-id="m1"]')!);
    expect(onOpen).toHaveBeenCalledWith('https://outlook.example/m1');
  });

  it('invokes onClear with the id when Done is clicked', async () => {
    const onClear = vi.fn();
    render(<ItemRow row={row} onOpen={() => {}} onClear={onClear} onRerank={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onClear).toHaveBeenCalledWith('m1');
  });

  it('invokes onRerank with the chosen lane', async () => {
    const onRerank = vi.fn();
    render(<ItemRow row={row} onOpen={() => {}} onClear={() => {}} onRerank={onRerank} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /move to lane/i }), 'respond');
    expect(onRerank).toHaveBeenCalledWith('m1', 'respond');
  });
});

// tests/renderer/SetAsideBin.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetAsideBin } from '../../src/renderer/components/SetAsideBin';
import type { SetAsideView } from '../../src/app/view-model';

const view: SetAsideView = {
  total: 2,
  items: [
    { id: 'a', subject: 'Weekly newsletter', from: 'news@v.com', receivedAt: '2026-05-30T09:00:00.000Z', reason: 'automated' },
    { id: 'b', subject: 'Random thing', from: 'x@y.com', receivedAt: '2026-05-29T09:00:00.000Z', reason: 'unmatched' },
  ],
};

describe('SetAsideBin', () => {
  it('shows the count and stays collapsed until opened', async () => {
    render(<SetAsideBin view={view} onPromote={() => {}} />);
    expect(screen.getByRole('button', { name: /set aside.*2/i })).toBeInTheDocument();
    expect(screen.queryByText('Weekly newsletter')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /set aside.*2/i }));
    expect(screen.getByText('Weekly newsletter')).toBeInTheDocument();
  });

  it('promotes an item to a chosen lane', async () => {
    const onPromote = vi.fn();
    render(<SetAsideBin view={view} onPromote={onPromote} />);
    await userEvent.click(screen.getByRole('button', { name: /set aside.*2/i }));
    const rowSelect = screen.getAllByLabelText(/move to/i)[0];
    await userEvent.selectOptions(rowSelect, 'today');
    expect(onPromote).toHaveBeenCalledWith('a', 'today');
  });

  it('renders nothing when empty', () => {
    const { container } = render(<SetAsideBin view={{ total: 0, items: [] }} onPromote={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

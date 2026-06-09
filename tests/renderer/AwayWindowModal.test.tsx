// tests/renderer/AwayWindowModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AwayWindowModal } from '../../src/renderer/components/AwayWindowModal';

describe('AwayWindowModal', () => {
  it('submits the chosen date as an ISO string', async () => {
    const onSubmit = vi.fn();
    render(<AwayWindowModal onSubmit={onSubmit} error={null} />);
    await userEvent.type(screen.getByLabelText(/out since/i), '2026-05-25');
    await userEvent.click(screen.getByRole('button', { name: /show my backlog/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Local midnight of the chosen date, expressed in UTC. Recomputed the same way
    // so the assertion holds in any timezone (not hardcoded to a UTC date prefix).
    expect(onSubmit).toHaveBeenCalledWith(new Date('2026-05-25T00:00:00').toISOString());
  });

  it('shows a validation error when provided', () => {
    render(<AwayWindowModal onSubmit={() => {}} error="The date you were out since cannot be in the future." />);
    expect(screen.getByText(/cannot be in the future/i)).toBeInTheDocument();
  });
});

// tests/renderer/Lane.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Lane } from '../../src/renderer/components/Lane';
import type { LaneView } from '../../src/app/view-model';

const laneView: LaneView = {
  lane: 'today',
  total: 2,
  groups: [
    {
      source: 'jsm',
      items: [{
        id: 's1', subject: 'INC-1 P1 breach', from: 'jsm@co.com', receivedAt: '2026-05-30T09:00:00.000Z',
        reasons: ['P1', 'SLA breached'], resolved: false, lane: 'today', reranked: false,
      }],
    },
    {
      source: 'email_internal',
      items: [{
        id: 'e1', subject: 'Approve PR', from: 'peer@co.com', receivedAt: '2026-05-29T09:00:00.000Z',
        reasons: ['Direct ask'], resolved: false, lane: 'today', reranked: false,
      }],
    },
  ],
};

const noop = () => {};

describe('Lane', () => {
  it('renders the lane title, count, and grouped items', () => {
    render(<Lane laneView={laneView} title="Needs you today" onOpen={noop} onClear={noop} onRerank={noop} />);
    expect(screen.getByText('Needs you today')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('INC-1 P1 breach')).toBeInTheDocument();
    expect(screen.getByText('Approve PR')).toBeInTheDocument();
    expect(screen.getByText(/System/i)).toBeInTheDocument();
    expect(screen.getByText(/Internal/i)).toBeInTheDocument();
  });

  it('renders an empty-lane message when there are no groups', () => {
    render(
      <Lane laneView={{ lane: 'today', total: 0, groups: [] }} title="Needs you today"
        onOpen={noop} onClear={noop} onRerank={noop} />,
    );
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument();
  });
});

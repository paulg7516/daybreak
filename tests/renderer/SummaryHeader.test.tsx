// tests/renderer/SummaryHeader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryHeader } from '../../src/renderer/components/SummaryHeader';
import type { Summary } from '../../src/summary/summary';

const summary: Summary = {
  needsTodayCount: 3, thisWeekCount: 5, fyiCount: 31, slaAtRiskCount: 2, resolvedWhileAwayCount: 14,
};

describe('SummaryHeader', () => {
  it('shows the headline counts', () => {
    render(<SummaryHeader summary={summary} awaySince="2026-05-25T00:00:00.000Z" />);
    expect(screen.getByText(/3 need you today/i)).toBeInTheDocument();
    expect(screen.getByText(/2 SLAs at risk/i)).toBeInTheDocument();
    expect(screen.getByText(/14 resolved while you were out/i)).toBeInTheDocument();
  });
});

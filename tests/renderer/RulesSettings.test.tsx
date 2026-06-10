// tests/renderer/RulesSettings.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesSettings } from '../../src/renderer/components/RulesSettings';
import type { Rule } from '../../src/app/rules';

const rules: Rule[] = [
  { id: 'r1', field: 'from-domain', value: 'company.com', action: 'include', lane: 'today' },
];

describe('RulesSettings', () => {
  it('lists existing rules and removes one', async () => {
    const onRemove = vi.fn();
    render(<RulesSettings rules={rules} bulkExcludeEnabled onAdd={() => {}} onRemove={onRemove} onToggleBulk={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/company\.com/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith('r1');
  });

  it('adds an include rule from the form', async () => {
    const onAdd = vi.fn();
    render(<RulesSettings rules={[]} bulkExcludeEnabled onAdd={onAdd} onRemove={() => {}} onToggleBulk={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/sender or domain/i), 'boss@company.com');
    await userEvent.click(screen.getByRole('button', { name: /add rule/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const added = onAdd.mock.calls[0][0] as Rule;
    expect(added.value).toBe('boss@company.com');
    expect(added.action).toBe('include');
  });

  it('toggles the bulk-exclude switch', async () => {
    const onToggleBulk = vi.fn();
    render(<RulesSettings rules={[]} bulkExcludeEnabled onAdd={() => {}} onRemove={() => {}} onToggleBulk={onToggleBulk} onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText(/set aside automated/i));
    expect(onToggleBulk).toHaveBeenCalledWith(false);
  });
});

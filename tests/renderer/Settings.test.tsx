// tests/renderer/Settings.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '../../src/renderer/components/Settings';

const noop = () => {};
const jira = { baseUrl: '', email: '', hasToken: false };

function renderSettings() {
  render(
    <Settings
      rules={[]}
      bulkExcludeEnabled
      onAddRule={noop}
      onRemoveRule={noop}
      onToggleBulk={noop}
      jiraConfig={jira}
      onSaveJira={async () => {}}
      onTestJira={async () => ({ ok: true, displayName: 'X' })}
      onClearJiraToken={noop}
      onClose={noop}
    />,
  );
}

describe('Settings', () => {
  it('shows the Rules tab by default and switches to Sources', async () => {
    renderSettings();
    expect(screen.getByText(/automated and bulk mail/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sources/i }));
    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
  });

  it('has a Done button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });
});

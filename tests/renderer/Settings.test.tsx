// tests/renderer/Settings.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Settings } from '../../src/renderer/components/Settings';

const noop = () => {};

function renderSettings() {
  render(
    <Settings
      jiraConfig={{ baseUrl: '', email: '', hasToken: false }}
      onSaveJira={async () => {}}
      onTestJira={async () => ({ ok: true, displayName: 'X' })}
      onClearJiraToken={noop}
    />,
  );
}

describe('Settings', () => {
  it('renders the Sources section with the Jira connection form', () => {
    renderSettings();
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
  });
});

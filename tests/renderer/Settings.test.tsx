// tests/renderer/Settings.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '../../src/renderer/components/Settings';
import { defaultLaneConfig } from '../../src/app/lane-config';

const noop = () => {};

function renderSettings(onSaveLaneConfig = vi.fn()) {
  render(
    <Settings
      laneConfig={defaultLaneConfig()}
      onSaveLaneConfig={onSaveLaneConfig}
      jiraConfig={{ baseUrl: '', email: '', hasToken: false }}
      onSaveJira={async () => {}}
      onTestJira={async () => ({ ok: true, displayName: 'X' })}
      onClearJiraToken={noop}
      mailStatus={{ provider: 'gmail', connected: false, account: null, graphConfigured: false }}
      mailBusy={false}
      onConnectMail={noop}
      onDisconnectMail={noop}
    />,
  );
}

describe('Settings', () => {
  it('shows Data sources and Lanes together on one page', async () => {
    renderSettings();
    expect(screen.getByText('Microsoft 365')).toBeInTheDocument();
    expect(screen.getByLabelText(/label for respond/i)).toBeInTheDocument();
  });

  it('renames a lane through the config callback', async () => {
    const onSave = vi.fn();
    renderSettings(onSave);
    const input = screen.getByLabelText(/label for respond/i);
    await userEvent.type(input, '!');
    expect(onSave).toHaveBeenCalled();
    const last = onSave.mock.calls.at(-1)![0];
    expect(last[0].label).toBe('Needs your reply!');
  });
});

// tests/renderer/JiraSettings.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JiraSettings } from '../../src/renderer/components/JiraSettings';

const config = { baseUrl: 'https://co.atlassian.net', email: 'me@co.com', hasToken: true };

describe('JiraSettings', () => {
  it('saves the entered base URL, email, and token', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<JiraSettings config={config} onSave={onSave} onTest={async () => ({ ok: true, displayName: 'Me' })} onClearToken={() => {}} />);
    const token = screen.getByLabelText(/api token/i);
    await userEvent.type(token, 'newtoken');
    await userEvent.click(screen.getByRole('button', { name: /^save/i }));
    expect(onSave).toHaveBeenCalledWith({ baseUrl: 'https://co.atlassian.net', email: 'me@co.com', token: 'newtoken' });
  });

  it('runs a test connection and shows the result', async () => {
    const onTest = vi.fn().mockResolvedValue({ ok: true, displayName: 'Pat' });
    render(<JiraSettings config={config} onSave={async () => {}} onTest={onTest} onClearToken={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /test connection/i }));
    expect(onTest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/connected as pat/i)).toBeInTheDocument();
  });
});

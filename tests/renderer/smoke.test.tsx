import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';

describe('App', () => {
  it('renders the product name', () => {
    render(<App />);
    expect(screen.getByText('Daybreak')).toBeInTheDocument();
  });
});

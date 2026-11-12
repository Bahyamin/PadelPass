import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('displays the status returned by GET /api/health', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'OK' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('OK')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/health');
  });
});

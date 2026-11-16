import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Home from './Home.jsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Home page', () => {
  it('displays the status returned by GET /api/health', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'OK' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByText('OK')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/health');
  });
});

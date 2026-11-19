import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { fakeApi } from '../test/fakeApi.js';
import Home from './Home.jsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Home page', () => {
  it('displays the status returned by GET /api/health', async () => {
    const fetchMock = fakeApi({
      'GET /api/health': { status: 200, body: { status: 'OK' } },
      'GET /api/users/me': { status: 401, body: {} },
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Home />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('OK')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/health');
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
  });
});

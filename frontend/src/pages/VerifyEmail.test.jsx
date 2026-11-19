import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { fakeApi } from '../test/fakeApi.js';

const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

const notLoggedIn = { 'GET /api/users/me': { status: 401, body: {} } };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Verify email page', () => {
  it('activates the account and goes to the login page with a message', async () => {
    const fetchMock = fakeApi({
      ...notLoggedIn,
      'POST /api/auth/verify-email': {
        status: 200,
        body: { message: 'Your email address is verified, you can log in' },
      },
    });

    renderApp('/verify-email?token=abc123');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'Your email address is verified, you can log in',
    );
    const call = fetchMock.mock.calls.find(
      ([url]) => url === '/api/auth/verify-email',
    );
    expect(JSON.parse(call[1].body)).toEqual({ token: 'abc123' });
  });

  it('explains an expired link and lets the player ask for a new one', async () => {
    const fetchMock = fakeApi({
      ...notLoggedIn,
      'POST /api/auth/verify-email': {
        status: 400,
        body: {
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'This verification link has expired, ask for a new one',
          },
        },
      },
      'POST /api/auth/resend-verification': {
        status: 202,
        body: { message: 'A new link has been sent' },
      },
    });

    renderApp('/verify-email?token=old');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This verification link has expired, ask for a new one',
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send a new link' }));

    expect((await screen.findByRole('status')).textContent).toBe(
      'A new link has been sent',
    );
    const call = fetchMock.mock.calls.find(
      ([url]) => url === '/api/auth/resend-verification',
    );
    expect(JSON.parse(call[1].body)).toEqual({ email: 'ada@example.com' });
  });
});

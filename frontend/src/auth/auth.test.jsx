import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { ada, fakeApi } from '../test/fakeApi.js';

const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

const health = { 'GET /api/health': { status: 200, body: { status: 'OK' } } };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('login, protected page and logout', () => {
  it('logs in and redirects to the home page, which greets the user', async () => {
    const fetchMock = fakeApi({
      ...health,
      'GET /api/users/me': { status: 401, body: {} },
      'POST /api/auth/login': { status: 200, body: ada },
    });
    renderApp('/login');

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'padel1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    const loginCall = fetchMock.mock.calls.find(
      ([url]) => url === '/api/auth/login',
    );
    expect(JSON.parse(loginCall[1].body)).toEqual({
      email: 'ada@example.com',
      password: 'padel1234',
    });
  });

  it('shows the message of the API when the login is refused', async () => {
    fakeApi({
      'GET /api/users/me': { status: 401, body: {} },
      'POST /api/auth/login': {
        status: 401,
        body: {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
      },
    });
    renderApp('/login');

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Invalid email or password',
    );
  });

  it('sends a visitor who is not logged in from /profile to the login page', async () => {
    fakeApi({ 'GET /api/users/me': { status: 401, body: {} } });
    renderApp('/profile');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeTruthy();
  });

  it('shows the profile to a logged-in user, and logout closes it', async () => {
    const fetchMock = fakeApi({
      'GET /api/users/me': { status: 200, body: ada },
      'POST /api/auth/logout': { status: 204, body: {} },
    });
    renderApp('/profile');

    expect(
      await screen.findByRole('heading', { name: 'My profile' }),
    ).toBeTruthy();
    expect(screen.getByText('ada@example.com')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          url === '/api/auth/logout' && options?.method === 'POST',
      ),
    ).toBe(true);
  });
});

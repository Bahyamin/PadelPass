import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { ADMIN, EQUIPMENT_MANAGER, STAFF, hasRole } from './roles.js';
import { ada, fakeApi } from '../test/fakeApi.js';

const player = ada;
const staff = { ...ada, role: 'STAFF' };
const admin = { ...ada, role: 'ADMIN' };

// Opens the app on `path`, logged in as `user` (or not logged in).
const renderApp = (path, user) => {
  fakeApi({
    'GET /api/health': { status: 200, body: { status: 'OK' } },
    'GET /api/users/me': user
      ? { status: 200, body: user }
      : { status: 401, body: {} },
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
};

const link = (name) => screen.queryByRole('link', { name });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('hasRole', () => {
  it('uses the access levels of the SDD', () => {
    expect(hasRole(admin, ADMIN)).toBe(true);
    expect(hasRole(staff, ADMIN)).toBe(false);
    expect(hasRole(staff, STAFF)).toBe(true);
    expect(hasRole(player, STAFF)).toBe(false);
    expect(hasRole(admin, EQUIPMENT_MANAGER)).toBe(true);
    expect(hasRole(null, STAFF)).toBe(false);
  });
});

describe('pages by role (FR-07, AC-03)', () => {
  it('sends a player who types /admin/settings to the home page', async () => {
    renderApp('/admin/settings', player);

    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'PadelPassTeam' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Club settings' })).toBe(null);
  });

  it('also sends a staff member who is not an administrator to the home page', async () => {
    renderApp('/admin/settings', staff);

    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Club settings' })).toBe(null);
  });

  it('also sends an equipment manager who is not an administrator to the home page', async () => {
    const equipmentManager = { ...ada, role: 'EQUIPMENT_MANAGER' };
    renderApp('/admin/settings', equipmentManager);

    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Club settings' })).toBe(null);
  });

  it('opens /admin/settings for an administrator', async () => {
    renderApp('/admin/settings', admin);

    expect(
      await screen.findByRole('heading', { name: 'Club settings' }),
    ).toBeTruthy();
  });

  it('sends a visitor who is not logged in to the login page', async () => {
    renderApp('/admin/settings', null);

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeTruthy();
  });
});

describe('menu of the home page by role', () => {
  it('shows a visitor only the public pages', async () => {
    renderApp('/', null);

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(link('Book a court')).toBeTruthy();
    expect(link('Equipment for rent')).toBeTruthy();
    expect(link('My bookings')).toBe(null);
    expect(link('My profile')).toBe(null);
    expect(link('Club settings')).toBe(null);
  });

  it('shows a player their pages, without the admin ones', async () => {
    renderApp('/', player);

    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    expect(link('My bookings')).toBeTruthy();
    expect(link('My profile')).toBeTruthy();
    expect(link('Club settings')).toBe(null);
  });

  it('adds the club settings for an administrator', async () => {
    renderApp('/', admin);

    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    expect(link('Club settings')).toBeTruthy();
  });
});

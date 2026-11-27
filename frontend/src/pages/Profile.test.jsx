import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';
import { AuthProvider, useAuth } from '../auth/AuthContext.jsx';
import RequireAuth from '../auth/RequireAuth.jsx';
import { ada, fakeApi } from '../test/fakeApi.js';
import Profile from './Profile.jsx';

const profile = { ...ada, phone: '0612345678' };

// Shows the first name of the logged-in user, like the home page.
function Greeting() {
  const { user } = useAuth();
  return <p>Hello {user.firstName}</p>;
}

const renderApp = (path = '/profile') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

// The JSON body of the PATCH sent to the API.
const patchBody = (fetchMock) => {
  const call = fetchMock.mock.calls.find(
    ([url, options]) => url === '/api/users/me' && options?.method === 'PATCH',
  );
  return JSON.parse(call[1].body);
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('My profile page', () => {
  it('shows my first name, last name, email and phone; the email is not editable', async () => {
    fakeApi({ 'GET /api/users/me': { status: 200, body: profile } });
    renderApp();

    expect((await screen.findByLabelText('Phone')).value).toBe('0612345678');
    expect(screen.getByLabelText('First name').value).toBe('Ada');
    expect(screen.getByLabelText('Last name').value).toBe('Lovelace');
    expect(screen.getByText('ada@example.com').tagName).toBe('SPAN');
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('saves the new name and phone', async () => {
    const saved = { ...profile, firstName: 'Augusta', phone: '0700000000' };
    const fetchMock = fakeApi({
      'GET /api/users/me': { status: 200, body: profile },
      'PATCH /api/users/me': { status: 200, body: saved },
    });
    renderApp();

    await screen.findByDisplayValue('0612345678');
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Augusta' },
    });
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '0700000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save my profile' }));

    expect((await screen.findByRole('status')).textContent).toBe(
      'Profile saved',
    );
    expect(patchBody(fetchMock)).toEqual({
      firstName: 'Augusta',
      lastName: 'Lovelace',
      phone: '0700000000',
    });
  });

  it('shows the message of a refused value next to its field', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: profile },
      'PATCH /api/users/me': {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Phone number is not valid',
            field: 'phone',
          },
        },
      },
    });
    renderApp();

    await screen.findByDisplayValue('0612345678');
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: 'call me' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save my profile' }));

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe('Phone number is not valid');
    const phone = screen.getByLabelText('Phone');
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    expect(phone.getAttribute('aria-describedby')).toBe(error.id);
    expect(
      screen.getByLabelText('First name').getAttribute('aria-invalid'),
    ).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('updates the logged-in user of the app after a change', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: profile },
      'PATCH /api/users/me': {
        status: 200,
        body: { ...profile, firstName: 'Augusta' },
      },
    });
    render(
      <MemoryRouter>
        <AuthProvider>
          <RequireAuth>
            <Profile />
            <Greeting />
          </RequireAuth>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    await screen.findByDisplayValue('0612345678');
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Augusta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save my profile' }));

    expect(await screen.findByText('Hello Augusta')).toBeTruthy();
  });
});

import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Register from './Register.jsx';

function fillAndSubmit() {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
  const type = (label, value) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  type('First name', 'Ada');
  type('Last name', 'Lovelace');
  type('Email', 'ada@example.com');
  type('Password', 'padel1234');
  type('Phone', '0612345678');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Register page', () => {
  it('sends the form and shows the success message with a login link', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    fillAndSubmit();

    expect(
      await screen.findByText('Account created, check your email to verify it'),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Go to the login page' }).pathname,
    ).toBe('/login');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/register');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'padel1234',
      phone: '0612345678',
      acceptedTerms: true,
    });
  });

  it('shows the message sent by the API and keeps the form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            error: {
              code: 'EMAIL_ALREADY_USED',
              message: 'An account already exists with this email',
            },
          }),
      }),
    );

    fillAndSubmit();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'An account already exists with this email',
    );
    expect(screen.getByLabelText('Email').value).toBe('ada@example.com');
  });
});

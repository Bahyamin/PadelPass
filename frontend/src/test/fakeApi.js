import { vi } from 'vitest';

// Replaces fetch with a fake API for the tests. `routes` maps
// "METHOD /url" to { status, body }; any other call answers 404.
export function fakeApi(routes) {
  const fetchMock = vi.fn((url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`;
    const route = routes[key] ?? { status: 404, body: {} };
    return Promise.resolve({
      ok: route.status < 400,
      status: route.status,
      json: () => Promise.resolve(route.body),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const ada = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'PLAYER',
  isVerified: true,
};

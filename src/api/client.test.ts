import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { ApiError, createApiClient, GENERIC_ERROR_MESSAGE } from './client';

const BASE = 'http://ums.test';

function client(overrides: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  let token = 'token-1';
  const options = {
    baseUrl: BASE,
    getAccessToken: () => token,
    refreshAccessToken: vi.fn(async () => {
      token = 'token-2';
      return token;
    }),
    onSessionExpired: vi.fn(),
    ...overrides,
  };
  return { api: createApiClient(options), options };
}

test('sends the bearer token and JSON body, and returns the JSON response', async () => {
  let seen: { auth: string | null; type: string | null; body: unknown } | undefined;
  server.use(
    http.post(`${BASE}/admin/users/internal`, async ({ request }) => {
      seen = {
        auth: request.headers.get('Authorization'),
        type: request.headers.get('Content-Type'),
        body: await request.json(),
      };
      return HttpResponse.json({ sub: 'u1' }, { status: 201 });
    }),
  );
  const { api } = client();

  const result = await api.post<{ sub: string }>('/admin/users/internal', { email: 'a@corp.example' });

  expect(result).toEqual({ sub: 'u1' });
  expect(seen).toEqual({
    auth: 'Bearer token-1',
    type: 'application/json',
    body: { email: 'a@corp.example' },
  });
});

test('adds query parameters, skipping empty ones', async () => {
  let url: URL | undefined;
  server.use(
    http.get(`${BASE}/admin/users`, ({ request }) => {
      url = new URL(request.url);
      return HttpResponse.json({ content: [] });
    }),
  );
  await client().api.get('/admin/users', {
    query: { userType: 'EXTERNAL', status: '', email: undefined, page: 0 },
  });
  expect(url?.search).toBe('?userType=EXTERNAL&page=0');
});

test('returns undefined for 204 No Content', async () => {
  server.use(http.post(`${BASE}/admin/users/u1/unlock`, () => new HttpResponse(null, { status: 204 })));
  await expect(client().api.post('/admin/users/u1/unlock', { ticketRef: 'OPS-5' })).resolves.toBeUndefined();
});

test('maps a ProblemDetail 409 to an ApiError carrying its title and detail', async () => {
  server.use(
    http.post(`${BASE}/admin/users/internal`, () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Conflict', status: 409, detail: 'Email already in use' },
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  );

  const error = await client()
    .api.post('/admin/users/internal', {})
    .catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 409, title: 'Conflict', detail: 'Email already in use' });
});

test('maps a non-ProblemDetail failure to the generic message without exposing the body', async () => {
  server.use(
    http.get(`${BASE}/admin/users`, () =>
      HttpResponse.text('java.lang.NullPointerException at Foo.bar', { status: 500 }),
    ),
  );
  const error = (await client()
    .api.get('/admin/users')
    .catch((e: unknown) => e)) as ApiError;
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(500);
  expect(error.title).toBe(GENERIC_ERROR_MESSAGE);
  expect(error.detail).toBeUndefined();
  expect(JSON.stringify(error)).not.toMatch(/NullPointer/);
});

test('maps a network failure to the generic message', async () => {
  server.use(http.get(`${BASE}/admin/users`, () => HttpResponse.error()));
  await expect(client().api.get('/admin/users')).rejects.toMatchObject({
    status: 0,
    title: GENERIC_ERROR_MESSAGE,
  });
});

test('a 401 triggers one silent refresh and a retry with the new token', async () => {
  const tokens: (string | null)[] = [];
  server.use(
    http.get(`${BASE}/admin/users`, ({ request }) => {
      tokens.push(request.headers.get('Authorization'));
      return tokens.length === 1
        ? new HttpResponse(null, { status: 401 })
        : HttpResponse.json({ content: [] });
    }),
  );
  const { api, options } = client();

  await expect(api.get('/admin/users')).resolves.toEqual({ content: [] });
  expect(tokens).toEqual(['Bearer token-1', 'Bearer token-2']);
  expect(options.refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(options.onSessionExpired).not.toHaveBeenCalled();
});

test('a retried request that still gets 401 ends the session', async () => {
  let calls = 0;
  server.use(
    http.get(`${BASE}/admin/users`, () => {
      calls++;
      return new HttpResponse(null, { status: 401 });
    }),
  );
  const { api, options } = client();

  await expect(api.get('/admin/users')).rejects.toMatchObject({ status: 401 });
  expect(calls).toBe(2);
  expect(options.refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(options.onSessionExpired).toHaveBeenCalledTimes(1);
});

test('a 401 whose silent refresh fails ends the session without retrying', async () => {
  let calls = 0;
  server.use(
    http.get(`${BASE}/admin/users`, () => {
      calls++;
      return new HttpResponse(null, { status: 401 });
    }),
  );
  const { api, options } = client({
    refreshAccessToken: vi.fn(async () => {
      throw new Error('login_required');
    }),
  });

  await expect(api.get('/admin/users')).rejects.toMatchObject({ status: 401 });
  expect(calls).toBe(1);
  expect(options.onSessionExpired).toHaveBeenCalledTimes(1);
});

test('concurrent 401s share one refresh', async () => {
  server.use(
    http.get(`${BASE}/admin/:what`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-2'
        ? HttpResponse.json({ ok: true })
        : new HttpResponse(null, { status: 401 }),
    ),
  );
  const { api, options } = client();
  await Promise.all([api.get('/admin/users'), api.get('/admin/teams')]);
  expect(options.refreshAccessToken).toHaveBeenCalledTimes(1);
});

test('a 403 is an ApiError, not a session end', async () => {
  server.use(
    http.get(`${BASE}/admin/users`, () =>
      HttpResponse.json(
        { title: 'Forbidden', status: 403 },
        { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  );
  const { api, options } = client();
  await expect(api.get('/admin/users')).rejects.toMatchObject({ status: 403, title: 'Forbidden' });
  expect(options.onSessionExpired).not.toHaveBeenCalled();
});

test('concurrent requests that cannot recover end the session once', async () => {
  server.use(http.get(`${BASE}/admin/:what`, () => new HttpResponse(null, { status: 401 })));
  const { api, options } = client({
    refreshAccessToken: vi.fn(async () => {
      throw new Error('login_required');
    }),
  });
  await Promise.allSettled([api.get('/admin/users'), api.get('/admin/teams'), api.get('/admin/roles')]);
  expect(options.onSessionExpired).toHaveBeenCalledTimes(1);
});

test.each(['//evil.example/steal', 'https://evil.example/steal'])(
  'refuses to send the token to another origin (%s)',
  async (path) => {
    await expect(client().api.get(path)).rejects.toThrow(/outside the UMS/);
  },
);

test('keeps a base URL path prefix', async () => {
  server.use(http.get('http://gw.test/ums/admin/users', () => HttpResponse.json({ ok: true })));
  await expect(client({ baseUrl: 'http://gw.test/ums' }).api.get('/admin/users')).resolves.toEqual({
    ok: true,
  });
});

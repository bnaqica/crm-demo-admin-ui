import { http, HttpResponse } from 'msw';
import { server } from './test/server';
import { appTitle } from './appTitle';

test('toolchain runs with MSW intercepting fetch', async () => {
  server.use(http.get('http://ums.test/ping', () => HttpResponse.json({ ok: true })));
  const res = await fetch('http://ums.test/ping');
  expect(await res.json()).toEqual({ ok: true });
  expect(appTitle).toBe('CRM Admin');
});

test('requests without an MSW handler fail instead of reaching the network', async () => {
  await expect(fetch('http://ums.test/unmocked')).rejects.toThrow();
});

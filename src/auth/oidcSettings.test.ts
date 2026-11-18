import { User, UserManager } from 'oidc-client-ts';
import { buildOidcSettings } from './oidcSettings';

const settings = () =>
  buildOidcSettings({
    authority: 'http://localhost:8180/realms/crm-admin',
    clientId: 'admin-app',
    origin: 'http://localhost:5175',
  });

test('uses Authorization Code with PKCE against the crm-admin realm and admin-app client', () => {
  const s = settings();
  expect(s.authority).toBe('http://localhost:8180/realms/crm-admin');
  expect(s.client_id).toBe('admin-app');
  expect(s.response_type).toBe('code');
  expect(s.redirect_uri).toBe('http://localhost:5175/callback');
  expect(s.post_logout_redirect_uri).toBe('http://localhost:5175/');
  expect(s.automaticSilentRenew).toBe(true);
});

test('keeps access and refresh tokens out of localStorage and sessionStorage', async () => {
  const manager = new UserManager(settings());
  await manager.storeUser(
    new User({
      access_token: 'secret-access-token',
      refresh_token: 'secret-refresh-token',
      id_token: 'secret-id-token',
      token_type: 'Bearer',
      profile: { sub: 'admin', iss: 'x', aud: 'admin-app', exp: 9999999999, iat: 0 },
    }),
  );

  expect((await manager.getUser())?.access_token).toBe('secret-access-token');
  const stored = [localStorage, sessionStorage].flatMap((store) =>
    Object.keys(store).map((key) => `${key}=${store.getItem(key)}`),
  );
  expect(stored.join('\n')).not.toMatch(/secret/);
  expect(document.cookie).not.toMatch(/secret/);
});

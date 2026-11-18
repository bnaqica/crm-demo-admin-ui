import { fakeJwt } from '../test/fakeAuth';
import { accessTokenClaims, hasAdminRole } from './claims';

test('a token with realm role admin is an admin token', () => {
  expect(hasAdminRole(fakeJwt({ realm_access: { roles: ['offline_access', 'admin'] } }))).toBe(true);
});

test.each([
  ['no realm roles', fakeJwt({ sub: 'x' })],
  ['other roles only', fakeJwt({ realm_access: { roles: ['offline_access'] } })],
  ['admin as a client role only', fakeJwt({ resource_access: { 'admin-app': { roles: ['admin'] } } })],
  ['not a JWT', 'garbage'],
  ['missing token', undefined],
])('%s is not an admin token', (_label, token) => {
  expect(hasAdminRole(token)).toBe(false);
});

test('decodes base64url payloads with non-ASCII names', () => {
  expect(accessTokenClaims(fakeJwtUtf8({ name: 'Zoë Ånström' }))?.name).toBe('Zoë Ånström');
});

function fakeJwtUtf8(claims: Record<string, unknown>) {
  const bytes = new TextEncoder().encode(JSON.stringify(claims));
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `e30.${b64}.sig`;
}

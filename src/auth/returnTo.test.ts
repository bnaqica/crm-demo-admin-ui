import { returnToFromState, signinCallbackHandler } from './returnTo';

test('returns the stored in-app path', () => {
  expect(returnToFromState({ returnTo: '/users/123?tab=roles' })).toBe('/users/123?tab=roles');
});

test.each([
  undefined,
  null,
  'x',
  { returnTo: 'https://evil.example/' },
  { returnTo: '//evil.example' },
  { returnTo: 7 },
])('falls back to / for unusable state %j', (state) => {
  expect(returnToFromState(state)).toBe('/');
});

test('sign-in callback lands on the deep link that started the login', () => {
  const navigate = vi.fn();
  signinCallbackHandler(navigate)({ state: { returnTo: '/users/123' } } as never);
  expect(navigate).toHaveBeenCalledWith('/users/123', { replace: true });
});

test('rejects a backslash path that browsers read as protocol-relative', () => {
  expect(returnToFromState({ returnTo: '/\\evil.example' })).toBe('/');
});

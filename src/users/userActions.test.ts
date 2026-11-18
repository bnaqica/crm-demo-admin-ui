import { aUser } from '../test/umsHandlers';
import { allowedActions } from './userActions';

test.each([
  ['INVITED', false, ['logout', 'reset-mfa', 'edit']],
  ['STARTER', false, ['logout', 'reset-mfa', 'edit']],
  ['ACTIVE', false, ['disable', 'logout', 'reset-mfa', 'edit']],
  ['ACTIVE', true, ['disable', 'unlock', 'logout', 'reset-mfa', 'edit']],
  ['DISABLED', false, ['enable']],
  ['DISABLED', true, ['enable', 'unlock']],
] as const)('a %s user (locked %s) can get %j', (status, locked, actions) => {
  expect(allowedActions(aUser({ status, locked }))).toEqual(actions);
});

test('an INVITED user is never offered Disable', () => {
  expect(allowedActions(aUser({ status: 'INVITED', locked: true }))).not.toContain('disable');
});

test('Unlock stays available when the UMS does not report the lockout state', () => {
  expect(allowedActions(aUser({ status: 'ACTIVE', locked: undefined }))).toContain('unlock');
});

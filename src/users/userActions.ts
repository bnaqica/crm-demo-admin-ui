import type { UserResponse } from '../api/ums';

export type UserAction = 'disable' | 'enable' | 'unlock' | 'logout' | 'reset-mfa' | 'edit';

/**
 * The account actions to offer for a user, following the UMS status rules (ACTIVE to DISABLED, DISABLED to ACTIVE).
 * A disabled account has no sessions and can't sign in, so it is only offered Enable (and Unlock). The UMS doesn't
 * report lockout state yet, so Unlock is offered unless the user is known not to be locked.
 */
export function allowedActions(user: Pick<UserResponse, 'status' | 'locked'>): UserAction[] {
  const actions: UserAction[] = [];
  if (user.status === 'ACTIVE') actions.push('disable');
  if (user.status === 'DISABLED') actions.push('enable');
  if (user.locked !== false) actions.push('unlock');
  if (user.status !== 'DISABLED') actions.push('logout', 'reset-mfa', 'edit');
  return actions;
}

import { ApiError } from '../api/client';

/**
 * The UMS answers 422 "The user is already in a team and isn't allowed in more than one" when the user's
 * multi-team flag is off. It has no error code for it, so the detail text is matched.
 */
export function isMultiTeamRejection(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422 && /more than one/i.test(error.detail ?? '');
}

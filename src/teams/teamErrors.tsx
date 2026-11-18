import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { isMultiTeamRejection } from './multiTeam';

/** Shows a membership error, explaining the multi-team rule with a link to the user when that is the cause. */
export function MembershipError({ error, user }: { error: unknown; user?: { sub: string; email: string } }) {
  if (!isMultiTeamRejection(error) || !user) return <ApiErrorAlert error={error} />;
  return (
    <div role="alert" className="error">
      <strong>{(error as ApiError).detail}</strong>
      <p>
        The user&apos;s multi-team flag must be enabled first. Open{' '}
        <Link to={`/users/${encodeURIComponent(user.sub)}`}>{user.email}</Link> and allow multiple teams, then
        add them again.
      </p>
    </div>
  );
}

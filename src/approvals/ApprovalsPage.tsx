import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { Link } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { umsGrants, umsUsers, type GrantRequestResponse } from '../api/ums';
import { ActionDialog } from '../components/ActionDialog';
import { usePendingGrants } from './useGrantRequests';

const GRANT_LABEL: Record<GrantRequestResponse['type'], string> = {
  SUPER_MANAGER: 'Super Manager role',
  ADMIN_ACCOUNT: 'New admin account',
};

type Decision = { grant: GrantRequestResponse; verb: 'approve' | 'reject' };

export function ApprovalsPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const me = useAuth().user?.profile.sub;
  const pending = usePendingGrants();
  const [deciding, setDeciding] = useState<Decision | null>(null);
  const [message, setMessage] = useState<string>();

  const decide = useMutation({
    mutationFn: ({ d, ticketRef }: { d: Decision; ticketRef: string }) =>
      d.verb === 'approve'
        ? umsGrants.approve(api, d.grant.id, { ticketRef })
        : umsGrants.reject(api, d.grant.id, { ticketRef }),
    onSuccess: (grant, { d }) => {
      setMessage(d.verb === 'approve' ? 'Request approved.' : 'Request rejected.');
      setDeciding(null);
      void queryClient.invalidateQueries({ queryKey: ['grant-requests'] });
      if (grant.type === 'SUPER_MANAGER')
        void queryClient.invalidateQueries({ queryKey: ['users', grant.target] });
    },
    // A 409 or 403 usually means someone else decided it or it expired: refresh the list behind the dialog.
    onError: () => void queryClient.invalidateQueries({ queryKey: ['grant-requests'] }),
  });

  const open = (d: Decision) => {
    decide.reset();
    setMessage(undefined);
    setDeciding(d);
  };

  return (
    <section>
      <h1>Approvals</h1>
      <p>
        Super Manager grants and new admin accounts need a second admin. Requests expire if nobody decides.
      </p>
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      <ApiErrorAlert error={pending.error} />
      {pending.isPending && <p>Loading requests…</p>}
      {pending.data &&
        (pending.data.length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Grant</th>
                <th>Target</th>
                <th>Requested by</th>
                <th>Ticket</th>
                <th>Expires</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {pending.data.map((grant) => {
                const mine = grant.requestedBy === me;
                return (
                  <tr key={grant.id}>
                    <td>{GRANT_LABEL[grant.type] ?? grant.type}</td>
                    <td>
                      <Target grant={grant} />
                    </td>
                    <td>{mine ? 'You' : grant.requestedBy}</td>
                    <td>{grant.ticketRef}</td>
                    <td>
                      <time dateTime={grant.expiresAt}>{new Date(grant.expiresAt).toLocaleString()}</time>
                    </td>
                    <td>
                      {mine ? (
                        <span className="muted">Needs another admin to approve. </span>
                      ) : (
                        <button type="button" onClick={() => open({ grant, verb: 'approve' })}>
                          Approve
                        </button>
                      )}
                      <button type="button" onClick={() => open({ grant, verb: 'reject' })}>
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      {deciding && (
        <ActionDialog
          title={deciding.verb === 'approve' ? 'Approve grant' : 'Reject grant'}
          confirmLabel={deciding.verb === 'approve' ? 'Approve' : 'Reject'}
          destructive={deciding.verb === 'approve'}
          pending={decide.isPending}
          error={decide.error}
          onConfirm={(ticketRef) => decide.mutate({ d: deciding, ticketRef })}
          onCancel={() => setDeciding(null)}
        >
          <p>
            {deciding.verb === 'approve'
              ? deciding.grant.type === 'SUPER_MANAGER'
                ? 'Approve the Super Manager role? The user sees every team’s CRM data.'
                : 'Approve the new admin account? It is created with full admin rights and an invite email.'
              : 'Reject this request? It is closed without effect.'}
          </p>
        </ActionDialog>
      )}
    </section>
  );
}

/** A SUPER_MANAGER target is a user's sub, shown as their email when it can be looked up. */
function Target({ grant }: { grant: GrantRequestResponse }) {
  const api = useApi();
  const isUser = grant.type === 'SUPER_MANAGER';
  const user = useQuery({
    queryKey: ['users', grant.target],
    queryFn: () => umsUsers.get(api, grant.target),
    enabled: isUser,
    retry: false,
  });
  if (!isUser) return <>{grant.target}</>;
  return <Link to={`/users/${encodeURIComponent(grant.target)}`}>{user.data?.email ?? grant.target}</Link>;
}

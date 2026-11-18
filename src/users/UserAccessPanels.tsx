import { useId, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { umsRoles, umsUsers, type UserResponse } from '../api/ums';
import { ActionDialog } from '../components/ActionDialog';
import { SelectField } from '../components/Field';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="panel">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="success">
      {children}
    </p>
  );
}

/** The user's roles, with assign (only roles assignable to the user's type) and revoke. */
export function RolesPanel({ user }: { user: UserResponse }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const key = ['users', user.sub, 'roles'];
  const held = useQuery({ queryKey: key, queryFn: () => umsUsers.roles(api, user.sub) });
  const [dialog, setDialog] = useState<{ kind: 'assign' } | { kind: 'revoke'; role: string } | null>(null);
  const [choice, setChoice] = useState('');
  const [message, setMessage] = useState<ReactNode>();

  const all = useQuery({
    queryKey: ['roles'],
    queryFn: () => umsRoles.list(api),
    enabled: dialog?.kind === 'assign',
  });
  const assignable = (all.data ?? []).filter(
    (r) => r.assignableTo === user.userType && !(held.data ?? []).includes(r.name),
  );

  const assign = useMutation({
    mutationFn: (v: { role: string; ticketRef: string }) => umsUsers.assignRole(api, user.sub, v),
    onSuccess: (result, { role }) => {
      if (result.kind === 'assigned') {
        queryClient.setQueryData(key, result.roles);
        setMessage(`${role} assigned.`);
      } else {
        void queryClient.invalidateQueries({ queryKey: ['grant-requests'] });
        setMessage(
          <>
            {role} is pending approval by a second admin. See <Link to="/approvals">Approvals</Link>.
          </>,
        );
      }
      setDialog(null);
    },
  });

  const revoke = useMutation({
    mutationFn: (v: { role: string; ticketRef: string }) =>
      umsUsers.revokeRole(api, user.sub, v.role, { ticketRef: v.ticketRef }),
    onSuccess: (roles, { role }) => {
      queryClient.setQueryData(key, roles);
      setMessage(`${role} revoked.`);
      setDialog(null);
    },
  });

  const open = (next: NonNullable<typeof dialog>) => {
    assign.reset();
    revoke.reset();
    setMessage(undefined);
    setChoice('');
    setDialog(next);
  };

  return (
    <Panel title="Roles">
      {message && <Status>{message}</Status>}
      <ApiErrorAlert error={held.error} />
      {held.data &&
        (held.data.length === 0 ? (
          <p>No roles.</p>
        ) : (
          <ul>
            {held.data.map((role) => (
              <li key={role}>
                <span>{role}</span>{' '}
                <button
                  type="button"
                  aria-label={`Revoke ${role}`}
                  onClick={() => open({ kind: 'revoke', role })}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        ))}
      <button type="button" onClick={() => open({ kind: 'assign' })}>
        Assign role
      </button>

      {dialog?.kind === 'assign' && (
        <ActionDialog
          title="Assign role"
          confirmLabel="Assign"
          pending={assign.isPending}
          error={assign.error ?? all.error}
          validate={() => (choice ? undefined : 'Choose a role')}
          onConfirm={(ticketRef) => assign.mutate({ role: choice, ticketRef })}
          onCancel={() => setDialog(null)}
        >
          <p>Only roles that can be given to {user.userType} users are listed.</p>
          {all.isPending ? (
            <p>Loading roles…</p>
          ) : (
            <SelectField label="Role" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Choose…</option>
              {assignable.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.description ? `${r.name}: ${r.description}` : r.name}
                </option>
              ))}
            </SelectField>
          )}
        </ActionDialog>
      )}
      {dialog?.kind === 'revoke' && (
        <ActionDialog
          title="Revoke role"
          confirmLabel="Revoke"
          destructive
          pending={revoke.isPending}
          error={revoke.error}
          onConfirm={(ticketRef) => revoke.mutate({ role: dialog.role, ticketRef })}
          onCancel={() => setDialog(null)}
        >
          <p>
            Revoke {dialog.role} from {user.email}? They lose its permissions at their next token refresh.
          </p>
        </ActionDialog>
      )}
    </Panel>
  );
}

/** The teams an INTERNAL user is in, and their multi-team flag. */
export function TeamsPanel({ user }: { user: UserResponse }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const teams = useQuery({
    queryKey: ['users', user.sub, 'teams'],
    queryFn: () => umsUsers.teams(api, user.sub),
  });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const next = !user.multiTeamAllowed;

  const change = useMutation({
    mutationFn: (ticketRef: string) => umsUsers.setMultiTeam(api, user.sub, { allowed: next, ticketRef }),
    onSuccess: (result) => {
      queryClient.setQueryData<UserResponse>(['users', user.sub], (u) =>
        u ? { ...u, multiTeamAllowed: result.multiTeamAllowed } : u,
      );
      setMessage(result.multiTeamAllowed ? 'Multiple teams allowed.' : 'Multiple teams no longer allowed.');
      setOpen(false);
    },
  });

  const title = next ? 'Allow multiple teams' : 'Forbid multiple teams';
  return (
    <Panel title="Teams">
      {message && <Status>{message}</Status>}
      <p>Multi-team: {user.multiTeamAllowed ? 'allowed' : 'not allowed'}</p>
      <button
        type="button"
        onClick={() => {
          change.reset();
          setMessage(undefined);
          setOpen(true);
        }}
      >
        {title}
      </button>
      <ApiErrorAlert error={teams.error} />
      {teams.data &&
        (teams.data.length === 0 ? (
          <p>Not in any team.</p>
        ) : (
          <ul>
            {teams.data.map((t) => (
              <li key={t.teamId}>
                <Link to={`/teams/${encodeURIComponent(t.teamId)}`}>{t.teamName}</Link>
                {t.manager && <span className="badge">Manager</span>}
                {t.archived && <span className="badge muted">Archived</span>}
              </li>
            ))}
          </ul>
        ))}
      {open && (
        <ActionDialog
          title={title}
          confirmLabel={next ? 'Allow' : 'Forbid'}
          pending={change.isPending}
          error={change.error}
          onConfirm={(ticketRef) => change.mutate(ticketRef)}
          onCancel={() => setOpen(false)}
        >
          <p>
            {next
              ? `${user.email} may then be added to more than one team.`
              : `${user.email} may then be in only one team. The UMS refuses this while they are in several.`}
          </p>
        </ActionDialog>
      )}
    </Panel>
  );
}

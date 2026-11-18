import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import {
  fullName,
  umsTeams,
  umsUsers,
  type TeamMemberResponse,
  type TeamResponse,
  type UserResponse,
} from '../api/ums';
import { ActionDialog } from '../components/ActionDialog';
import { TextField } from '../components/Field';
import { MembershipError } from './teamErrors';

type Dialog =
  | { kind: 'add' }
  | { kind: 'archive' }
  | { kind: 'remove'; member: TeamMemberResponse }
  | { kind: 'manager'; member: TeamMemberResponse; manager: boolean };

export function TeamDetailPage() {
  const id = useParams().id ?? '';
  const api = useApi();
  const team = useQuery({ queryKey: ['teams', id], queryFn: () => umsTeams.get(api, id) });
  return (
    <section>
      <p>
        <Link to="/teams">Back to teams</Link>
      </p>
      <ApiErrorAlert error={team.error} />
      {team.isPending && <p>Loading team…</p>}
      {team.data && <TeamDetail team={team.data} />}
    </section>
  );
}

function TeamDetail({ team }: { team: TeamResponse }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const membersKey = ['teams', team.id, 'members'];
  const members = useQuery({ queryKey: membersKey, queryFn: () => umsTeams.members(api, team.id) });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [message, setMessage] = useState<string>();
  const [picked, setPicked] = useState<UserResponse>();
  const [asManager, setAsManager] = useState(false);

  const refresh = (changedSub?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['teams'] });
    if (changedSub) void queryClient.invalidateQueries({ queryKey: ['users', changedSub, 'teams'] });
  };

  const change = useMutation({
    mutationFn: async ({ d, ticketRef, user }: { d: Dialog; ticketRef: string; user?: UserResponse }) => {
      switch (d.kind) {
        case 'add':
          await umsTeams.addMember(api, team.id, { sub: user!.sub, manager: asManager, ticketRef });
          return `${user!.email} added.`;
        case 'archive':
          queryClient.setQueryData(['teams', team.id], await umsTeams.archive(api, team.id, { ticketRef }));
          return 'Team archived.';
        case 'remove':
          await umsTeams.removeMember(api, team.id, d.member.sub, { ticketRef });
          return `${d.member.email} removed.`;
        case 'manager':
          await umsTeams.setManager(api, team.id, d.member.sub, { manager: d.manager, ticketRef });
          return d.manager
            ? `${d.member.email} is now a manager.`
            : `${d.member.email} is no longer a manager.`;
      }
    },
    onSuccess: (done, { d, user }) => {
      setMessage(done);
      setDialog(null);
      refresh(d.kind === 'add' ? user?.sub : d.kind === 'archive' ? undefined : d.member.sub);
    },
  });

  const open = (d: Dialog) => {
    change.reset();
    setMessage(undefined);
    setPicked(undefined);
    setAsManager(false);
    setDialog(d);
  };

  return (
    <>
      <h1>{team.name}</h1>
      {team.archived && <p className="badge muted">Archived</p>}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {!team.archived && (
        <p className="actions">
          <button type="button" onClick={() => open({ kind: 'add' })}>
            Add member
          </button>
          <button type="button" className="danger" onClick={() => open({ kind: 'archive' })}>
            Archive team
          </button>
        </p>
      )}

      <h2>Members</h2>
      <ApiErrorAlert error={members.error} />
      {members.isPending && <p>Loading members…</p>}
      {members.data &&
        (members.data.length === 0 ? (
          <p>No members.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role in team</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((m) => (
                <tr key={m.sub}>
                  <td>
                    <Link to={`/users/${encodeURIComponent(m.sub)}`}>{m.email}</Link>
                  </td>
                  <td>{fullName(m)}</td>
                  <td>{m.manager ? <span className="badge">Manager</span> : 'Member'}</td>
                  <td>
                    {m.manager ? (
                      <button
                        type="button"
                        onClick={() => open({ kind: 'manager', member: m, manager: false })}
                      >
                        Remove manager
                      </button>
                    ) : (
                      !team.archived && (
                        <button
                          type="button"
                          onClick={() => open({ kind: 'manager', member: m, manager: true })}
                        >
                          Make manager
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="danger"
                      onClick={() => open({ kind: 'remove', member: m })}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

      {dialog?.kind === 'add' && (
        <ActionDialog
          title="Add member"
          confirmLabel="Add"
          pending={change.isPending}
          error={null}
          validate={() => (picked ? undefined : 'Choose a user')}
          onConfirm={(ticketRef) => change.mutate({ d: dialog, ticketRef, user: picked })}
          onCancel={() => setDialog(null)}
        >
          <MemberPicker exclude={(members.data ?? []).map((m) => m.sub)} picked={picked} onPick={setPicked} />
          <label className="checkbox">
            <input type="checkbox" checked={asManager} onChange={(e) => setAsManager(e.target.checked)} />
            Make manager
          </label>
          <MembershipError error={change.error} user={change.variables?.user} />
        </ActionDialog>
      )}
      {dialog?.kind === 'archive' && (
        <ActionDialog
          title="Archive team"
          confirmLabel="Archive"
          destructive
          pending={change.isPending}
          error={change.error}
          onConfirm={(ticketRef) => change.mutate({ d: dialog, ticketRef })}
          onCancel={() => setDialog(null)}
        >
          <p>
            Archive {team.name}? It keeps its members and history but takes no new members or managers. Teams
            can&apos;t be unarchived.
          </p>
        </ActionDialog>
      )}
      {dialog?.kind === 'remove' && (
        <ActionDialog
          title="Remove member"
          confirmLabel="Remove"
          destructive
          pending={change.isPending}
          error={change.error}
          onConfirm={(ticketRef) => change.mutate({ d: dialog, ticketRef })}
          onCancel={() => setDialog(null)}
        >
          <p>
            Remove {dialog.member.email} from {team.name}? They lose access to the team&apos;s CRM data.
          </p>
        </ActionDialog>
      )}
      {dialog?.kind === 'manager' && (
        <ActionDialog
          title={dialog.manager ? 'Make manager' : 'Remove manager'}
          confirmLabel={dialog.manager ? 'Make manager' : 'Remove manager'}
          pending={change.isPending}
          error={change.error}
          onConfirm={(ticketRef) => change.mutate({ d: dialog, ticketRef })}
          onCancel={() => setDialog(null)}
        >
          <p>
            {dialog.manager
              ? `${dialog.member.email} will manage ${team.name}.`
              : `${dialog.member.email} will stay in ${team.name} as a member.`}
          </p>
        </ActionDialog>
      )}
    </>
  );
}

/** Finds INTERNAL users who aren't DISABLED and aren't in the team yet. */
function MemberPicker({
  exclude,
  picked,
  onPick,
}: {
  exclude: string[];
  picked?: UserResponse;
  onPick: (user: UserResponse | undefined) => void;
}) {
  const api = useApi();
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState<string>();
  const found = useQuery({
    queryKey: ['users', 'search', { email: search, userType: 'INTERNAL', size: 20 }],
    queryFn: () => umsUsers.search(api, { email: search, userType: 'INTERNAL', size: 20 }),
    enabled: search !== undefined,
  });
  const runSearch = () => {
    onPick(undefined);
    setSearch(email.trim());
  };
  const candidates = (found.data?.content ?? []).filter(
    (u) => u.userType === 'INTERNAL' && u.status !== 'DISABLED' && !exclude.includes(u.sub),
  );

  return (
    <fieldset>
      <legend>User</legend>
      <TextField
        label="Find user by email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          // Enter searches; it must not submit the dialog and add a user picked earlier.
          if (e.key === 'Enter') {
            e.preventDefault();
            runSearch();
          }
        }}
      />
      <button type="button" onClick={runSearch}>
        Find
      </button>
      <ApiErrorAlert error={found.error} />
      {found.data && candidates.length === 0 && <p>No internal, enabled users match.</p>}
      {found.data && found.data.totalElements > found.data.content.length && (
        <p className="field-hint">
          Showing the first {found.data.content.length} matches; narrow the search.
        </p>
      )}
      {candidates.length > 0 && (
        <ul className="picker">
          {candidates.map((u) => (
            <li key={u.sub}>
              <label>
                <input
                  type="radio"
                  name="member"
                  aria-label={u.email}
                  checked={picked?.sub === u.sub}
                  onChange={() => onPick(u)}
                />
                {u.email} ({fullName(u)}, {u.status})
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { umsTeams } from '../api/ums';
import { ActionDialog } from '../components/ActionDialog';
import { TextField } from '../components/Field';

export function TeamsPage() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => umsTeams.list(api) });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: (ticketRef: string) => umsTeams.create(api, { name: name.trim(), ticketRef }),
    onSuccess: (team) => {
      queryClient.setQueryData(['teams', team.id], team);
      void queryClient.invalidateQueries({ queryKey: ['teams'], exact: true });
      navigate(`/teams/${encodeURIComponent(team.id)}`);
    },
  });

  return (
    <section>
      <h1>Teams</h1>
      <p className="actions">
        <button
          type="button"
          onClick={() => {
            create.reset();
            setName('');
            setCreating(true);
          }}
        >
          Create team
        </button>
      </p>
      <ApiErrorAlert error={teams.error} />
      {teams.isPending && <p>Loading teams…</p>}
      {teams.data &&
        (teams.data.length === 0 ? (
          <p>No teams yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Members</th>
                <th>Managers</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {teams.data.map((team) => (
                <tr key={team.id}>
                  <td>
                    <Link to={`/teams/${encodeURIComponent(team.id)}`}>{team.name}</Link>
                  </td>
                  <td>{team.memberCount}</td>
                  <td>{team.managerCount}</td>
                  <td>{team.archived ? 'Archived' : 'Active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      {creating && (
        <ActionDialog
          title="Create team"
          confirmLabel="Create"
          pending={create.isPending}
          error={create.error}
          validate={() => (name.trim() ? undefined : 'Enter a team name')}
          onConfirm={(ticketRef) => create.mutate(ticketRef)}
          onCancel={() => setCreating(false)}
        >
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </ActionDialog>
      )}
    </section>
  );
}

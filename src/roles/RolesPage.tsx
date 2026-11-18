import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { umsRoles } from '../api/ums';

export function RolesPage() {
  const api = useApi();
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => umsRoles.list(api) });
  return (
    <section>
      <h1>Roles</h1>
      <p className="actions">
        <Link to="/roles/new">Create role</Link>
        <Link to="/roles/catalog">Permission catalog</Link>
      </p>
      <ApiErrorAlert error={roles.error} />
      {roles.isPending && <p>Loading roles…</p>}
      {roles.data && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Assignable to</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {roles.data.map((role) => (
              <tr key={role.name}>
                <td>
                  <Link to={`/roles/${encodeURIComponent(role.name)}`}>{role.name}</Link>
                </td>
                <td>{role.description}</td>
                <td>{role.assignableTo}</td>
                <td>{role.builtIn ? 'Built-in' : 'Custom'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

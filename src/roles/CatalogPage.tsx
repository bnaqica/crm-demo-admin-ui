import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { umsCatalog, type PermissionResponse } from '../api/ums';
import { groupCatalog } from './permissions';

/** The read-only permission catalog. Services register permissions; admins can only look. */
export function CatalogPage() {
  const api = useApi();
  const catalog = useQuery({ queryKey: ['catalog', {}], queryFn: () => umsCatalog.list(api) });
  return (
    <section>
      <p>
        <Link to="/roles">Back to roles</Link>
      </p>
      <h1>Permission catalog</h1>
      <p>Permissions come from the services that enforce them. They can&apos;t be created or deleted here.</p>
      <ApiErrorAlert error={catalog.error} />
      {catalog.isPending && <p>Loading catalog…</p>}
      {catalog.data?.length === 0 && <p>No permissions registered yet.</p>}
      {catalog.data && groupCatalog(catalog.data).map((g) => <ServiceGroup key={g.service} {...g} />)}
    </section>
  );
}

function ServiceGroup({
  service,
  resources,
}: {
  service: string;
  resources: { resource: string; permissions: PermissionResponse[] }[];
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="panel">
      <h2 id={id}>{service}</h2>
      {resources.map(({ resource, permissions }) => (
        <div key={resource}>
          <h3>{resource}</h3>
          <ul aria-label={resource}>
            {permissions.map((p) => (
              <li key={p.key}>
                <code>{p.key}</code> <span className="muted">{p.realm}</span> {p.description}
                {p.sensitive && <span className="badge warning">Sensitive</span>}
                {p.deprecated && <span className="badge muted">Deprecated</span>}
                {p.deprecated && p.grantedBy.length > 0 && (
                  <span className="muted"> Still granted by: {p.grantedBy.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

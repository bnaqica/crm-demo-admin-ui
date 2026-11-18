import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { realmFor, umsCatalog, umsRoleAdmin, USER_TYPES, type RoleResponse, type UserType } from '../api/ums';
import { SelectField, TextField } from '../components/Field';
import { TicketField } from '../components/TicketField';
import { ticketError } from '../components/ticket';
import { groupCatalog, lockedBy, togglePermission } from './permissions';

const NAME = /^[a-z][a-z0-9-]{1,99}$/;
/** Names the UMS accepts but that clash with the app's own /roles/new and /roles/catalog routes. */
const RESERVED = ['new', 'catalog'];

/** `/roles/new` creates a role; `/roles/:name` edits one (name and assignableTo never change). */
export function RoleEditorPage() {
  const name = useParams().name;
  const api = useApi();
  const role = useQuery({
    queryKey: ['roles', name],
    queryFn: () => umsRoleAdmin.get(api, name!),
    enabled: name !== undefined,
  });
  return (
    <section>
      <p>
        <Link to="/roles">Back to roles</Link>
      </p>
      <ApiErrorAlert error={role.error} />
      {role.isLoading && <p>Loading role…</p>}
      {name === undefined ? (
        <RoleForm />
      ) : role.data ? (
        <RoleForm key={role.data.name} role={role.data} />
      ) : null}
    </section>
  );
}

interface Draft {
  name: string;
  assignableTo: UserType;
  description: string;
  owner: string;
  permissions: string[];
  ticketRef: string;
}

type Errors = Partial<Record<keyof Draft, string>>;

function RoleForm({ role }: { role?: RoleResponse }) {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({
    name: role?.name ?? '',
    assignableTo: role?.assignableTo ?? 'INTERNAL',
    description: role?.description ?? '',
    owner: role?.owner ?? '',
    permissions: role?.permissions ?? [],
    ticketRef: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);
  const realm = realmFor(draft.assignableTo);
  const catalog = useQuery({
    queryKey: ['catalog', { realm }],
    queryFn: () => umsCatalog.list(api, { realm }),
  });
  // Grantable permissions, plus deprecated ones the role still holds so they can be removed.
  const offered = (catalog.data ?? []).filter((p) => !p.deprecated || draft.permissions.includes(p.key));

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = {
        description: d.description.trim(),
        owner: d.owner.trim(),
        permissions: d.permissions,
        ticketRef: d.ticketRef.trim(),
      };
      return role
        ? umsRoleAdmin.update(api, role.name, body)
        : umsRoleAdmin.create(api, { name: d.name.trim(), assignableTo: d.assignableTo, ...body });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['roles', result.name], result);
      void queryClient.invalidateQueries({ queryKey: ['roles'], exact: true });
      if (role) {
        setSaved(true);
        setDraft((d) => ({ ...d, permissions: result.permissions, ticketRef: '' }));
      } else navigate(`/roles/${encodeURIComponent(result.name)}`);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    if (!role && !NAME.test(draft.name.trim())) found.name = 'Use lower-case letters, digits and hyphens';
    else if (!role && RESERVED.includes(draft.name.trim()))
      found.name = `${draft.name.trim()} is reserved; choose another name`;
    if (!draft.description.trim()) found.description = 'Enter a description';
    if (!draft.owner.trim()) found.owner = 'Enter an owner';
    const ticket = ticketError(draft.ticketRef);
    if (ticket) found.ticketRef = ticket;
    setErrors(found);
    setSaved(false);
    if (Object.keys(found).length === 0) save.mutate(draft);
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1>{role ? `Edit role ${role.name}` : 'Create role'}</h1>
      {saved && (
        <p role="status" className="success">
          Role saved.
        </p>
      )}
      {role ? (
        <p>
          Assignable to {role.assignableTo} users ({realm}).
        </p>
      ) : (
        <>
          <TextField
            label="Name"
            value={draft.name}
            error={errors.name}
            hint="The Keycloak role name, such as deal-desk"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <SelectField
            label="Assignable to"
            value={draft.assignableTo}
            onChange={(e) =>
              setDraft({ ...draft, assignableTo: e.target.value as UserType, permissions: [] })
            }
          >
            {USER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
        </>
      )}
      <TextField
        label="Description"
        value={draft.description}
        error={errors.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
      />
      <TextField
        label="Owner"
        value={draft.owner}
        error={errors.owner}
        onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
      />

      <fieldset>
        <legend>Permissions from the {realm} catalog</legend>
        <p className="field-hint">Choosing a write permission also grants its read permission.</p>
        <ApiErrorAlert error={catalog.error} />
        {catalog.isPending && <p>Loading catalog…</p>}
        {groupCatalog(offered).map(({ service, resources }) => (
          <div key={service}>
            <h2>{service}</h2>
            {resources.map(({ resource, permissions }) => (
              <div key={resource} className="permission-group">
                <h3>{resource}</h3>
                {permissions.map((p) => (
                  <label key={p.key} className="checkbox">
                    <input
                      type="checkbox"
                      aria-label={p.key}
                      checked={draft.permissions.includes(p.key)}
                      disabled={lockedBy(draft.permissions, p.key)}
                      onChange={() =>
                        setDraft((d) => ({ ...d, permissions: togglePermission(d.permissions, p.key) }))
                      }
                    />
                    <code>{p.key}</code> {p.description}
                    {p.sensitive && <span className="badge warning">Sensitive</span>}
                    {p.deprecated && <span className="badge muted">Deprecated</span>}
                  </label>
                ))}
              </div>
            ))}
          </div>
        ))}
      </fieldset>

      <TicketField
        value={draft.ticketRef}
        error={errors.ticketRef}
        onChange={(v) => setDraft({ ...draft, ticketRef: v })}
      />
      <ApiErrorAlert error={save.error} />
      <button type="submit" disabled={save.isPending}>
        {role ? 'Save role' : 'Create role'}
      </button>
    </form>
  );
}

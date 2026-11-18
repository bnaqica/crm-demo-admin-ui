import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { PORTAL_ROLES, umsUsers, type UserResponse } from '../api/ums';
import { SelectField, TextField } from '../components/Field';
import { TicketField } from '../components/TicketField';
import { ticketError } from '../components/ticket';

interface Draft {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  ticketRef: string;
}

type Errors = Partial<Record<keyof Draft, string>>;

function validate(draft: Draft, external: boolean): Errors {
  const errors: Errors = {};
  if (!draft.email.trim()) errors.email = 'Enter an email address';
  else if (!/^[^\s@]+@[^\s@]+$/.test(draft.email.trim())) errors.email = 'Enter a valid email address';
  if (!draft.firstName.trim()) errors.firstName = 'Enter a first name';
  if (!draft.lastName.trim()) errors.lastName = 'Enter a last name';
  if (external && !draft.role) errors.role = 'Choose the initial portal role';
  const ticket = ticketError(draft.ticketRef);
  if (ticket) errors.ticketRef = ticket;
  return errors;
}

/** Create an INTERNAL user (`/users/new/internal`) or invite an EXTERNAL one (`/users/new/external`). */
export function CreateUserPage({ kind }: { kind?: 'internal' | 'external' }) {
  const param = useParams().kind;
  const external = (kind ?? param) === 'external';
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({
    email: '',
    firstName: '',
    lastName: '',
    role: '',
    ticketRef: '',
  });
  const [errors, setErrors] = useState<Errors>({});

  const create = useMutation({
    mutationFn: (d: Draft) => {
      const profile = {
        email: d.email.trim(),
        firstName: d.firstName.trim(),
        lastName: d.lastName.trim(),
        ticketRef: d.ticketRef.trim(),
      };
      return external
        ? umsUsers.inviteExternal(api, { ...profile, role: d.role })
        : umsUsers.createInternal(api, profile);
    },
    onSuccess: (user: UserResponse) => {
      queryClient.setQueryData(['users', user.sub], user);
      void queryClient.invalidateQueries({ queryKey: ['users', 'search'] });
      navigate(`/users/${encodeURIComponent(user.sub)}`);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(draft, external);
    setErrors(found);
    if (Object.keys(found).length === 0) create.mutate(draft);
  };

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const title = external ? 'Invite external user' : 'Create internal user';

  return (
    <section>
      <p>
        <Link to="/users">Back to users</Link>
      </p>
      <h1>{title}</h1>
      <p>
        {external
          ? 'The user gets an email to join the customer portal.'
          : 'The user gets an email to set a password and TOTP for the CRM.'}
      </p>
      <form onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          value={draft.email}
          error={errors.email}
          onChange={(e) => set('email')(e.target.value)}
        />
        <TextField
          label="First name"
          value={draft.firstName}
          error={errors.firstName}
          onChange={(e) => set('firstName')(e.target.value)}
        />
        <TextField
          label="Last name"
          value={draft.lastName}
          error={errors.lastName}
          onChange={(e) => set('lastName')(e.target.value)}
        />
        {external && (
          <SelectField
            label="Portal role"
            value={draft.role}
            error={errors.role}
            onChange={(e) => set('role')(e.target.value)}
          >
            <option value="">Choose…</option>
            {PORTAL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectField>
        )}
        <TicketField value={draft.ticketRef} onChange={set('ticketRef')} error={errors.ticketRef} />
        <ApiErrorAlert error={create.error} />
        <button type="submit" disabled={create.isPending}>
          {external ? 'Send invite' : 'Create user'}
        </button>
      </form>
    </section>
  );
}

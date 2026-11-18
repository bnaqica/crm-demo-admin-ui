import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { fullName, umsUsers, type UserResponse } from '../api/ums';
import { ActionDialog } from '../components/ActionDialog';
import { TextField } from '../components/Field';
import { allowedActions, type UserAction } from './userActions';
import { RolesPanel, TeamsPanel } from './UserAccessPanels';

interface ActionCopy {
  button: string;
  title: string;
  confirm: string;
  destructive: boolean;
  done: string;
  explain: (u: UserResponse) => string;
}

const COPY: Record<UserAction, ActionCopy> = {
  disable: {
    button: 'Disable',
    title: 'Disable account',
    confirm: 'Disable',
    destructive: true,
    done: 'Account disabled.',
    explain: (u) => `Disable ${u.email}? This disables the account and signs them out of every session.`,
  },
  enable: {
    button: 'Enable',
    title: 'Enable account',
    confirm: 'Enable',
    destructive: false,
    done: 'Account enabled.',
    explain: (u) => `Enable ${u.email} again. They can sign in afterwards.`,
  },
  unlock: {
    button: 'Unlock',
    title: 'Unlock account',
    confirm: 'Unlock',
    destructive: false,
    done: 'Account unlocked.',
    explain: (u) => `Clear the brute-force lockout for ${u.email}.`,
  },
  logout: {
    button: 'Force logout',
    title: 'Force logout',
    confirm: 'Force logout',
    destructive: true,
    done: 'All sessions ended.',
    explain: (u) => `Force logout ${u.email}? This ends every session the user has.`,
  },
  'reset-mfa': {
    button: 'Reset MFA',
    title: 'Reset MFA',
    confirm: 'Reset MFA',
    destructive: true,
    done: 'MFA reset. The user sets up TOTP at their next login.',
    explain: (u) =>
      `Reset MFA for ${u.email}? Their OTP and WebAuthn credentials are removed and they must set up TOTP again at their next login.`,
  },
  edit: {
    button: 'Edit profile',
    title: 'Edit profile',
    confirm: 'Save',
    destructive: false,
    done: 'Profile saved.',
    explain: () => 'The user must verify a new email address again.',
  },
};

export function UserDetailPage() {
  const sub = useParams().sub ?? '';
  const api = useApi();
  const user = useQuery({ queryKey: ['users', sub], queryFn: () => umsUsers.get(api, sub) });

  return (
    <section>
      <p>
        <Link to="/users">Back to users</Link>
      </p>
      <ApiErrorAlert error={user.error} />
      {user.isPending && <p>Loading user…</p>}
      {user.data && <UserDetail user={user.data} />}
    </section>
  );
}

function UserDetail({ user }: { user: UserResponse }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<UserAction | null>(null);
  const [message, setMessage] = useState<string>();
  const [profile, setProfile] = useState({ email: '', firstName: '', lastName: '' });

  const run = useMutation({
    mutationFn: async ({ action, ticketRef }: { action: UserAction; ticketRef: string }) => {
      if (action === 'edit') return umsUsers.update(api, user.sub, { ...profileTrimmed(profile), ticketRef });
      return umsUsers.action(api, user.sub, action, { ticketRef });
    },
    onSuccess: (result, { action }) => {
      const key = ['users', user.sub];
      if (result && typeof result === 'object') queryClient.setQueryData(key, result);
      else if (action === 'unlock') queryClient.setQueryData<UserResponse>(key, { ...user, locked: false });
      void queryClient.invalidateQueries({ queryKey: ['users', 'search'] });
      setMessage(COPY[action].done);
      setOpen(null);
    },
  });

  const start = (action: UserAction) => {
    run.reset();
    setMessage(undefined);
    if (action === 'edit')
      setProfile({ email: user.email, firstName: user.firstName, lastName: user.lastName });
    setOpen(action);
  };

  const copy = open ? COPY[open] : undefined;
  return (
    <>
      <h1>{fullName(user)}</h1>
      <dl className="details">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Type</dt>
        <dd>{user.userType}</dd>
        <dt>Status</dt>
        <dd>
          {user.status}
          {user.locked === true && <span className="badge warning">Locked</span>}
        </dd>
      </dl>

      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}

      <div role="group" aria-label="Account actions" className="actions">
        {allowedActions(user).map((action) => (
          <button
            key={action}
            type="button"
            className={COPY[action].destructive ? 'danger' : undefined}
            onClick={() => start(action)}
          >
            {COPY[action].button}
          </button>
        ))}
      </div>

      <RolesPanel user={user} />
      {user.userType === 'INTERNAL' && <TeamsPanel user={user} />}

      {open && copy && (
        <ActionDialog
          title={copy.title}
          confirmLabel={copy.confirm}
          destructive={copy.destructive}
          pending={run.isPending}
          error={run.error}
          validate={open === 'edit' ? () => profileError(profile) : undefined}
          onConfirm={(ticketRef) => run.mutate({ action: open, ticketRef })}
          onCancel={() => setOpen(null)}
        >
          <p>{copy.explain(user)}</p>
          {open === 'edit' && (
            <>
              <TextField
                label="Email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
              <TextField
                label="First name"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              />
              <TextField
                label="Last name"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              />
            </>
          )}
        </ActionDialog>
      )}
    </>
  );
}

const profileTrimmed = (p: { email: string; firstName: string; lastName: string }) => ({
  email: p.email.trim(),
  firstName: p.firstName.trim(),
  lastName: p.lastName.trim(),
});

function profileError(p: { email: string; firstName: string; lastName: string }) {
  const t = profileTrimmed(p);
  if (!t.email || !t.firstName || !t.lastName) return 'Email, first name and last name are required.';
  if (!/^[^\s@]+@[^\s@]+$/.test(t.email)) return 'Enter a valid email address.';
  return undefined;
}

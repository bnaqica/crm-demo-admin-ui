import { useAuth } from 'react-oidc-context';
import { NavLink, Outlet } from 'react-router';
import { appTitle } from '../appTitle';
import { usePendingGrants } from '../approvals/useGrantRequests';

const areas = [
  { to: '/users', label: 'Users' },
  { to: '/teams', label: 'Teams' },
  { to: '/roles', label: 'Roles' },
  { to: '/approvals', label: 'Approvals' },
  { to: '/audit', label: 'Audit' },
] as const;

/** The frame around every admin screen: title, signed-in admin, sign out and navigation. */
export function AppShell() {
  const auth = useAuth();
  const profile = auth.user?.profile;
  const name = profile?.name ?? profile?.preferred_username ?? '';
  const pending = usePendingGrants().data?.length ?? 0;
  return (
    <div className="app">
      <header>
        <span className="app-title">{appTitle}</span>
        <span className="app-user">{name}</span>
        <button type="button" onClick={() => void auth.signoutRedirect()}>
          Sign out
        </button>
      </header>
      <nav aria-label="Main">
        <ul>
          {areas.map((area) => (
            <li key={area.to}>
              {area.to === '/approvals' && pending > 0 ? (
                <NavLink to={area.to} aria-label={`${area.label}, ${pending} pending`}>
                  {area.label} <span className="badge">{pending}</span>
                </NavLink>
              ) : (
                <NavLink to={area.to}>{area.label}</NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

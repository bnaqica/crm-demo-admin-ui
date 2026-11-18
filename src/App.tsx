import { useAuth } from 'react-oidc-context';
import { Navigate, Route, Routes } from 'react-router';
import { ApiProvider } from './api/ApiProvider';
import { IdleTimeout } from './auth/IdleTimeout';
import { RequireAdmin } from './auth/RequireAdmin';
import { RequireAuth } from './auth/RequireAuth';
import { SessionWatcher } from './auth/SessionWatcher';
import { CatalogPage } from './roles/CatalogPage';
import { RoleEditorPage } from './roles/RoleEditorPage';
import { RolesPage } from './roles/RolesPage';
import { AppShell } from './shell/AppShell';
import { ApprovalsPage } from './approvals/ApprovalsPage';
import { AuditPage } from './audit/AuditPage';
import { AuditRecordPage } from './audit/AuditRecordPage';
import { TeamDetailPage } from './teams/TeamDetailPage';
import { TeamsPage } from './teams/TeamsPage';
import { CreateUserPage } from './users/CreateUserPage';
import { UserDetailPage } from './users/UserDetailPage';
import { UsersPage } from './users/UsersPage';

function Placeholder({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

/** The OIDC redirect target. The provider handles the code; this only shows progress or a failed callback. */
function SigninCallback() {
  const auth = useAuth();
  if (!auth.error) return <p role="status">Signing in…</p>;
  return (
    <main>
      <h1>Sign-in failed</h1>
      <p>We couldn&apos;t sign you in. Please try again.</p>
      <button type="button" onClick={() => void auth.signinRedirect({ state: { returnTo: '/' } })}>
        Sign in
      </button>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/callback" element={<SigninCallback />} />
      <Route
        element={
          <RequireAuth>
            <SessionWatcher />
            <RequireAdmin>
              <IdleTimeout />
              <ApiProvider>
                <AppShell />
              </ApiProvider>
            </RequireAdmin>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/new" element={<Navigate to="/users/new/internal" replace />} />
        <Route path="users/new/internal" element={<CreateUserPage kind="internal" />} />
        <Route path="users/new/external" element={<CreateUserPage kind="external" />} />
        <Route path="users/:sub" element={<UserDetailPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="teams/:id" element={<TeamDetailPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="roles/catalog" element={<CatalogPage />} />
        <Route path="roles/new" element={<RoleEditorPage />} />
        <Route path="roles/:name" element={<RoleEditorPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="audit/:eventId" element={<AuditRecordPage />} />
        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Route>
    </Routes>
  );
}

import { Route, Routes } from 'react-router';
import { server } from '../test/server';
import { renderWithProviders } from '../test/fakeAuth';
import { roleHandlers, userHandlers, type UmsDb } from '../test/umsHandlers';
import { CatalogPage } from './CatalogPage';
import { RoleEditorPage } from './RoleEditorPage';
import { RolesPage } from './RolesPage';

export function renderRoles(db: UmsDb, route: string) {
  server.use(...roleHandlers(db), ...userHandlers(db));
  return renderWithProviders(
    <Routes>
      <Route path="/roles" element={<RolesPage />} />
      <Route path="/roles/catalog" element={<CatalogPage />} />
      <Route path="/roles/new" element={<RoleEditorPage />} />
      <Route path="/roles/:name" element={<RoleEditorPage />} />
    </Routes>,
    { route },
  );
}

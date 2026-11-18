import { Route, Routes } from 'react-router';
import { server } from '../test/server';
import { renderWithProviders } from '../test/fakeAuth';
import { teamHandlers, userHandlers, type UmsDb } from '../test/umsHandlers';
import { TeamDetailPage } from './TeamDetailPage';
import { TeamsPage } from './TeamsPage';

export function renderTeams(db: UmsDb, route: string) {
  server.use(...teamHandlers(db), ...userHandlers(db));
  return renderWithProviders(
    <Routes>
      <Route path="/teams" element={<TeamsPage />} />
      <Route path="/teams/:id" element={<TeamDetailPage />} />
      <Route path="/users/:sub" element={<p>user page</p>} />
    </Routes>,
    { route },
  );
}

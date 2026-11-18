import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeAuth, renderWithProviders } from '../test/fakeAuth';
import { AppShell } from './AppShell';
import { server } from '../test/server';
import { aGrantRequest, allHandlers, createUmsDb } from '../test/umsHandlers';

beforeEach(() => server.use(...allHandlers(createUmsDb())));

test('shows the admin name, sign out and the five admin areas', async () => {
  const auth = fakeAuth({ name: 'Local Admin' });
  renderWithProviders(<AppShell />, { auth, route: '/users' });

  expect(screen.getByText('Local Admin')).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Main' });
  const links = within(nav).getAllByRole('link');
  expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
    ['Users', '/users'],
    ['Teams', '/teams'],
    ['Roles', '/roles'],
    ['Approvals', '/approvals'],
    ['Audit', '/audit'],
  ]);
  expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');

  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(auth.signoutRedirect).toHaveBeenCalled();
});

test('falls back to the username when the token has no name', () => {
  const auth = fakeAuth();
  auth.user!.profile.name = undefined;
  renderWithProviders(<AppShell />, { auth });
  expect(screen.getByText('admin.local')).toBeInTheDocument();
});

test('the Approvals item shows the number of pending requests', async () => {
  const db = createUmsDb({
    grantRequests: [aGrantRequest(), aGrantRequest(), aGrantRequest({ status: 'APPROVED' })],
  });
  server.use(...allHandlers(db));
  renderWithProviders(<AppShell />, { route: '/users' });
  const link = screen.getByRole('link', { name: /Approvals/ });
  expect(await within(link).findByText('2')).toBeInTheDocument();
  expect(link).toHaveAccessibleName('Approvals, 2 pending');
});

test('the Approvals badge refreshes every 60 seconds', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const db = createUmsDb({ grantRequests: [aGrantRequest()] });
    server.use(...allHandlers(db));
    renderWithProviders(<AppShell />, { route: '/users' });
    const link = screen.getByRole('link', { name: /Approvals/ });
    await within(link).findByText('1');
    db.grantRequests.push(aGrantRequest());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await within(link).findByText('2')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

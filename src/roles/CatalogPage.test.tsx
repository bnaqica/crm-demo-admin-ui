import { screen, within } from '@testing-library/react';
import { aPermission, createUmsDb } from '../test/umsHandlers';
import { renderRoles } from './rolesTestUtils';

function catalogDb() {
  return createUmsDb({
    catalog: [
      aPermission({ key: 'deals:read', description: 'Read deals' }),
      aPermission({ key: 'deals:write', description: 'Change deals' }),
      aPermission({ key: 'exports:write', description: 'Export data', sensitive: true }),
      aPermission({
        key: 'reports:read',
        deprecated: true,
        deprecatedAt: '2026-11-10T00:00:00Z',
        grantedBy: ['team-manager'],
      }),
      aPermission({ key: 'submissions:read', service: 'customer-portal-service', realm: 'portal' }),
    ],
  });
}

test('groups the catalog by service and resource', async () => {
  renderRoles(catalogDb(), '/roles/catalog');
  const core = await screen.findByRole('region', { name: 'core-service' });
  const resources = within(core)
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);
  expect(resources).toEqual(['deals', 'exports', 'reports']);
  const deals = within(core).getByRole('list', { name: 'deals' });
  expect(
    within(deals)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('code')?.textContent),
  ).toEqual(['deals:read', 'deals:write']);
  expect(screen.getByRole('region', { name: 'customer-portal-service' })).toHaveTextContent(
    'submissions:read',
  );
});

test('marks sensitive permissions as sensitive', async () => {
  renderRoles(catalogDb(), '/roles/catalog');
  const item = (await screen.findByText('exports:write')).closest('li')!;
  expect(within(item).getByText('Sensitive')).toBeInTheDocument();
  const plain = screen.getByText('deals:read').closest('li')!;
  expect(within(plain).queryByText('Sensitive')).not.toBeInTheDocument();
});

test('marks deprecated permissions with the roles still holding them', async () => {
  renderRoles(catalogDb(), '/roles/catalog');
  const item = (await screen.findByText('reports:read')).closest('li')!;
  expect(within(item).getByText('Deprecated')).toBeInTheDocument();
  expect(item).toHaveTextContent('Still granted by: team-manager');
});

test('offers no controls to create, change or delete permissions', async () => {
  renderRoles(catalogDb(), '/roles/catalog');
  await screen.findByText('deals:read');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

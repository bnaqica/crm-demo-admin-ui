import { screen, within } from '@testing-library/react';
import { createUmsDb } from '../test/umsHandlers';
import { renderRoles } from './rolesTestUtils';

test('lists roles with assignability and links to the editor, new role and catalog', async () => {
  renderRoles(createUmsDb(), '/roles');
  const row = (await screen.findByRole('link', { name: 'super-manager' })).closest('tr')!;
  expect(
    within(row)
      .getAllByRole('cell')
      .map((c) => c.textContent),
  ).toEqual(['super-manager', 'Sees every team', 'INTERNAL', 'Built-in']);
  expect(screen.getByRole('link', { name: 'super-manager' })).toHaveAttribute('href', '/roles/super-manager');
  expect(screen.getByRole('link', { name: 'Create role' })).toHaveAttribute('href', '/roles/new');
  expect(screen.getByRole('link', { name: 'Permission catalog' })).toHaveAttribute('href', '/roles/catalog');
});

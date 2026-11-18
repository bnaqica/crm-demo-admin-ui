import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { aPermission, aRole, createUmsDb } from '../test/umsHandlers';
import { renderRoles } from './rolesTestUtils';

function editorDb() {
  return createUmsDb({
    catalog: [
      aPermission({ key: 'deals:read' }),
      aPermission({ key: 'deals:write' }),
      aPermission({ key: 'reports:read', deprecated: true }),
      aPermission({ key: 'submissions:read', service: 'customer-portal-service', realm: 'portal' }),
      aPermission({ key: 'submissions:write', service: 'customer-portal-service', realm: 'portal' }),
    ],
  });
}

const box = (key: string) => screen.getByRole('checkbox', { name: key });

test('selecting submissions:write selects submissions:read, which cannot be deselected while write is selected', async () => {
  renderRoles(editorDb(), '/roles/new');
  await userEvent.selectOptions(await screen.findByLabelText('Assignable to'), 'EXTERNAL');
  await userEvent.click(await screen.findByRole('checkbox', { name: 'submissions:write' }));

  expect(box('submissions:read')).toBeChecked();
  expect(box('submissions:read')).toBeDisabled();
  await userEvent.click(box('submissions:read'));
  expect(box('submissions:read')).toBeChecked();

  await userEvent.click(box('submissions:write'));
  expect(box('submissions:read')).toBeChecked();
  expect(box('submissions:read')).toBeEnabled();
  await userEvent.click(box('submissions:read'));
  expect(box('submissions:read')).not.toBeChecked();
});

test("offers only the chosen realm's non-deprecated permissions", async () => {
  renderRoles(editorDb(), '/roles/new');
  await screen.findByRole('checkbox', { name: 'deals:read' });
  const keys = () =>
    screen
      .getAllByRole('checkbox')
      .map((c) => c.getAttribute('aria-label') ?? c.closest('label')?.textContent);
  expect(screen.queryByRole('checkbox', { name: 'submissions:read' })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'reports:read' })).not.toBeInTheDocument();
  expect(keys()).toHaveLength(2);

  await userEvent.selectOptions(screen.getByLabelText('Assignable to'), 'EXTERNAL');
  expect(await screen.findByRole('checkbox', { name: 'submissions:read' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'deals:read' })).not.toBeInTheDocument();
});

test('switching realm clears permissions from the other realm', async () => {
  renderRoles(editorDb(), '/roles/new');
  await userEvent.click(await screen.findByRole('checkbox', { name: 'deals:write' }));
  await userEvent.selectOptions(screen.getByLabelText('Assignable to'), 'EXTERNAL');
  await userEvent.selectOptions(screen.getByLabelText('Assignable to'), 'INTERNAL');
  expect(await screen.findByRole('checkbox', { name: 'deals:write' })).not.toBeChecked();
});

test('creates a role with name, assignableTo, description, owner, permissions and ticket', async () => {
  const db = editorDb();
  renderRoles(db, '/roles/new');
  await userEvent.type(await screen.findByLabelText('Name'), 'deal-desk');
  await userEvent.type(screen.getByLabelText('Description'), 'Deal desk');
  await userEvent.type(screen.getByLabelText('Owner'), 'sales-ops');
  await userEvent.click(await screen.findByRole('checkbox', { name: 'deals:write' }));
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-30');
  await userEvent.click(screen.getByRole('button', { name: 'Create role' }));

  expect(await screen.findByRole('heading', { name: 'Edit role deal-desk' })).toBeInTheDocument();
  expect(db.writes[0]).toEqual({
    method: 'POST',
    path: '/admin/roles',
    body: {
      name: 'deal-desk',
      assignableTo: 'INTERNAL',
      description: 'Deal desk',
      owner: 'sales-ops',
      permissions: ['deals:read', 'deals:write'],
      ticketRef: 'OPS-30',
    },
  });
});

test('validates the name and required fields before sending', async () => {
  const db = editorDb();
  renderRoles(db, '/roles/new');
  await userEvent.type(await screen.findByLabelText('Name'), 'Deal Desk');
  await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
  expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
    'Use lower-case letters, digits and hyphens',
  );
  expect(screen.getByLabelText('Description')).toHaveAccessibleDescription('Enter a description');
  expect(screen.getByLabelText('Owner')).toHaveAccessibleDescription('Enter an owner');
  expect(db.writes).toEqual([]);
});

test('edits an existing role: name and assignableTo are fixed', async () => {
  const db = editorDb();
  db.roles.push(
    aRole({
      name: 'deal-desk',
      builtIn: false,
      description: 'Deal desk',
      owner: 'sales-ops',
      permissions: ['deals:read'],
    }),
  );
  renderRoles(db, '/roles/deal-desk');
  expect(await screen.findByRole('heading', { name: 'Edit role deal-desk' })).toBeInTheDocument();
  expect(await screen.findByRole('checkbox', { name: 'deals:read' })).toBeChecked();
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Assignable to')).not.toBeInTheDocument();

  await userEvent.click(box('deals:write'));
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-31');
  await userEvent.click(screen.getByRole('button', { name: 'Save role' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Role saved.');
  expect(db.writes[0]).toEqual({
    method: 'PUT',
    path: '/admin/roles/deal-desk',
    body: {
      description: 'Deal desk',
      owner: 'sales-ops',
      permissions: ['deals:read', 'deals:write'],
      ticketRef: 'OPS-31',
    },
  });
});

test('a role that still holds a deprecated permission shows it so admins can remove it', async () => {
  const db = editorDb();
  db.roles.push(aRole({ name: 'old-role', builtIn: false, permissions: ['reports:read'] }));
  renderRoles(db, '/roles/old-role');
  const item = (await screen.findByRole('checkbox', { name: 'reports:read' })).closest('label')!;
  expect(within(item).getByText('Deprecated')).toBeInTheDocument();
});

test.each(['new', 'catalog'])(
  'refuses the reserved role name %s, which would clash with app routes',
  async (name) => {
    const db = editorDb();
    renderRoles(db, '/roles/new');
    await userEvent.type(await screen.findByLabelText('Name'), name);
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      `${name} is reserved; choose another name`,
    );
    expect(db.writes).toEqual([]);
  },
);

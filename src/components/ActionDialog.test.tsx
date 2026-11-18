import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ActionDialog } from './ActionDialog';

function Harness({ onConfirm = () => {} }: { onConfirm?: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <ActionDialog
          title="Disable account"
          confirmLabel="Disable"
          destructive
          onConfirm={(t) => {
            onConfirm(t);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        >
          <p>This signs them out.</p>
        </ActionDialog>
      )}
    </>
  );
}

test('returns focus to the control that opened it when cancelled', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByLabelText('Ticket reference')).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
});

test('returns focus after confirming', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-1');
  await userEvent.click(screen.getByRole('button', { name: 'Disable' }));
  expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
});

test('Escape cancels', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
});

test('a destructive dialog describes its consequence for screen readers', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByRole('alertdialog', { name: 'Disable account' })).toHaveAccessibleDescription(
    'This signs them out.',
  );
});

test('a form-level validation message is announced', async () => {
  render(
    <ActionDialog
      title="Assign role"
      confirmLabel="Assign"
      validate={() => 'Choose a role'}
      onConfirm={() => {}}
      onCancel={() => {}}
    />,
  );
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-1');
  await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a role');
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { TicketField } from './TicketField';
import { ticketError } from './ticket';

test.each([
  ['', 'Enter a ticket reference, such as OPS-12'],
  ['   ', 'Enter a ticket reference, such as OPS-12'],
  ['ops-12', 'A ticket reference looks like OPS-12'],
  ['OPS12', 'A ticket reference looks like OPS-12'],
  ['OPS-', 'A ticket reference looks like OPS-12'],
])('ticket %j is rejected with %j', (value, message) => {
  expect(ticketError(value)).toBe(message);
});

test.each(['OPS-12', 'SEC2-7', ' OPS-5 '])('ticket %j is accepted', (value) => {
  expect(ticketError(value)).toBeUndefined();
});

test('shows its error tied to the input', async () => {
  function Harness() {
    const [value, setValue] = useState('');
    return <TicketField value={value} onChange={setValue} error="Enter a ticket reference, such as OPS-12" />;
  }
  render(<Harness />);
  const input = screen.getByLabelText('Ticket reference');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Enter a ticket reference, such as OPS-12');
  await userEvent.type(input, 'OPS-1');
  expect(input).toHaveValue('OPS-1');
});

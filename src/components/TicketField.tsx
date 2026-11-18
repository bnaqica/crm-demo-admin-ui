import { TextField } from './Field';

/** The ticket reference every admin write carries. */
export function TicketField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <TextField
      label="Ticket reference"
      name="ticketRef"
      autoComplete="off"
      placeholder="OPS-12"
      value={value}
      error={error}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

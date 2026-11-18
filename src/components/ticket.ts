/** The UMS `@TicketReference` rule: an upper-case project key, a dash and a number, such as OPS-12. */
const TICKET_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;

/** The validation message for a ticket reference, or undefined when it is valid. */
export function ticketError(value: string): string | undefined {
  const ticket = value.trim();
  if (!ticket) return 'Enter a ticket reference, such as OPS-12';
  if (!TICKET_PATTERN.test(ticket)) return 'A ticket reference looks like OPS-12';
  return undefined;
}

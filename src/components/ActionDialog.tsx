import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { TicketField } from './TicketField';
import { ticketError } from './ticket';

export interface ActionDialogProps {
  title: string;
  /** What will happen; for destructive actions, the consequence the admin confirms. */
  children?: ReactNode;
  confirmLabel: string;
  /** Destructive actions are shown as an alert dialog the admin must confirm. */
  destructive?: boolean;
  pending?: boolean;
  error?: unknown;
  /** Extra fields; return a message to block submission. */
  validate?: () => string | undefined;
  onConfirm: (ticketRef: string) => void;
  onCancel: () => void;
}

/**
 * A modal for one admin action. It always asks for a ticket reference and sends nothing until the ticket is
 * valid; destructive actions use an alertdialog that spells out the consequence.
 */
export function ActionDialog({
  title,
  children,
  confirmLabel,
  destructive = false,
  pending = false,
  error,
  validate,
  onConfirm,
  onCancel,
}: ActionDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [ticket, setTicket] = useState('');
  const [ticketMessage, setTicketMessage] = useState<string>();
  const [formMessage, setFormMessage] = useState<string>();

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    dialog?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    return () => {
      // The dialog closes by unmounting, so hand focus back to whatever opened it.
      if (dialog?.open && typeof dialog.close === 'function') dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const tMessage = ticketError(ticket);
    const fMessage = validate?.();
    setTicketMessage(tMessage);
    setFormMessage(fMessage);
    if (!tMessage && !fMessage) onConfirm(ticket.trim());
  };

  return (
    <dialog
      ref={ref}
      role={destructive ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={children ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <form onSubmit={submit} noValidate>
        <h2 id={titleId}>{title}</h2>
        {children && <div id={descriptionId}>{children}</div>}
        {formMessage && (
          <p role="alert" className="field-error">
            {formMessage}
          </p>
        )}
        <TicketField value={ticket} onChange={setTicket} error={ticketMessage} />
        <ApiErrorAlert error={error} />
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={destructive ? 'danger' : undefined} disabled={pending}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

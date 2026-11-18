import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
}

/** A labelled input whose error (or hint) is its accessible description. */
export function TextField({
  label,
  error,
  hint,
  ...input
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        {...input}
      />
      {(error || hint) && (
        <span id={`${id}-desc`} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

export function SelectField({
  label,
  error,
  hint,
  children,
  ...select
}: FieldProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        {...select}
      >
        {children}
      </select>
      {(error || hint) && (
        <span id={`${id}-desc`} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

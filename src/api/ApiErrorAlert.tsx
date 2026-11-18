import { ApiError, GENERIC_ERROR_MESSAGE } from './client';

/** Shows a UMS error: ProblemDetail title and detail, or a generic message. Never a stack trace. */
export function ApiErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const title = error instanceof ApiError ? error.title : GENERIC_ERROR_MESSAGE;
  const detail = error instanceof ApiError ? error.detail : undefined;
  return (
    <div role="alert" className="error">
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { umsAudit, type AuditRecordResponse, type JsonValue } from '../api/ums';

const FIELDS: [keyof AuditRecordResponse, string][] = [
  ['eventId', 'Event id'],
  ['occurredAt', 'Occurred at'],
  ['source', 'Source'],
  ['realm', 'Realm'],
  ['actorType', 'Actor type'],
  ['actorId', 'Actor id'],
  ['action', 'Action'],
  ['targetType', 'Target type'],
  ['targetId', 'Target id'],
  ['outcome', 'Outcome'],
  ['ticketRef', 'Ticket'],
  ['reason', 'Reason'],
  ['ipAddress', 'IP address'],
  ['correlationId', 'Correlation id'],
];

export function AuditRecordPage() {
  const eventId = useParams().eventId ?? '';
  const api = useApi();
  const record = useQuery({
    queryKey: ['audit', 'record', eventId],
    queryFn: () => umsAudit.get(api, eventId),
  });
  const r = record.data;
  // The list passes its query string along so Back returns to the same search and page.
  const backSearch = (useLocation().state as { search?: string } | null)?.search ?? '';
  return (
    <section>
      <p>
        <Link to={`/audit${backSearch.startsWith('?') ? backSearch : ''}`}>Back to audit</Link>
      </p>
      <ApiErrorAlert error={record.error} />
      {record.isPending && <p>Loading record…</p>}
      {r && (
        <>
          <h1>{r.action}</h1>
          <ul aria-label="Record fields" className="details">
            {FIELDS.map(([key, label]) => (
              <li key={key}>
                <strong>{label}:</strong> {r[key] == null ? '—' : String(r[key])}
              </li>
            ))}
          </ul>
          <BeforeAfter before={r.before} after={r.after} />
        </>
      )}
    </section>
  );
}

const isObject = (v: JsonValue | null): v is { [key: string]: JsonValue } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Side-by-side before and after, one row per top-level field; changed rows are marked. Text only. */
function BeforeAfter({ before, after }: { before: JsonValue | null; after: JsonValue | null }) {
  const asFields = (v: JsonValue | null) => (v === null ? {} : isObject(v) ? v : { value: v });
  const b = asFields(before);
  const a = asFields(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  const show = (fields: Record<string, JsonValue>, key: string) =>
    Object.hasOwn(fields, key) ? JSON.stringify(fields[key], null, 2) : '—';
  return (
    <table aria-label="Before and after" className="diff">
      <thead>
        <tr>
          <th scope="col">Field</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.length === 0 && (
          <tr>
            <td colSpan={3}>No before or after values.</td>
          </tr>
        )}
        {keys.map((key) => {
          const changed = show(b, key) !== show(a, key);
          return (
            <tr key={key} className={changed ? 'changed' : undefined}>
              <th scope="row">{key}</th>
              <td>
                <pre>{show(b, key)}</pre>
              </td>
              <td>
                <pre>{show(a, key)}</pre>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

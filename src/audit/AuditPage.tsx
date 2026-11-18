import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import { AUDIT_FILTERS, umsAudit, type AuditFilter, type AuditSearch } from '../api/ums';
import { SelectField, TextField } from '../components/Field';
import {
  fromLocalInput,
  presetRange,
  PRESETS,
  toLocalInput,
  type Preset,
  type RangeChoice,
} from './auditRange';

const LABELS: Record<AuditFilter, string> = {
  source: 'Source',
  realm: 'Realm',
  actorId: 'Actor id',
  targetId: 'Target id',
  action: 'Action',
  outcome: 'Outcome',
  ticketRef: 'Ticket',
  correlationId: 'Correlation id',
};

const PRESET_LABELS: Record<Preset, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

type Filters = Record<AuditFilter, string>;
const emptyFilters = () => Object.fromEntries(AUDIT_FILTERS.map((k) => [k, ''])) as Filters;

const isPreset = (v: string | null): v is Preset => v !== null && v in PRESETS;

/** The committed search lives in the URL so returning from a record (or sharing the link) keeps it. */
function searchFromParams(params: URLSearchParams, fallback: { from: string; to: string }): AuditSearch {
  const page = Number(params.get('page') ?? 0);
  const filters = Object.fromEntries(
    AUDIT_FILTERS.flatMap((k) => (params.get(k) ? [[k, params.get(k)!]] : [])),
  );
  return {
    from: params.get('from') ?? fallback.from,
    to: params.get('to') ?? fallback.to,
    ...filters,
    page: Number.isInteger(page) && page > 0 ? page : 0,
  };
}

/** Read-only search over the central audit store. A time range is always required (default: last 24 hours). */
export function AuditPage() {
  const api = useApi();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [fallback] = useState(() => presetRange('24h'));
  const search = searchFromParams(params, fallback);
  const range: RangeChoice =
    params.get('range') === 'custom'
      ? 'custom'
      : isPreset(params.get('range'))
        ? (params.get('range') as Preset)
        : '24h';

  const results = useQuery({
    queryKey: ['audit', search],
    queryFn: () => umsAudit.search(api, search),
    placeholderData: keepPreviousData,
  });

  const commit = (next: AuditSearch, choice: RangeChoice) => {
    const p = new URLSearchParams({ range: choice, from: next.from, to: next.to });
    for (const k of AUDIT_FILTERS) if (next[k]) p.set(k, next[k]!);
    if (next.page) p.set('page', String(next.page));
    if (p.toString() === params.toString()) void results.refetch();
    else setParams(p);
  };

  const data = results.data;
  const searching = results.isFetching && results.isPlaceholderData;
  return (
    <section>
      <h1>Audit</h1>
      <AuditForm key={params.toString()} range={range} search={search} onSearch={commit} />

      <ApiErrorAlert error={results.error} />
      <section aria-label="Results" aria-busy={results.isFetching}>
        {(results.isPending || searching) && <p role="status">Searching…</p>}
        {data && !results.isError && (
          <>
            {data.totalElements === 0 ? (
              <p>No audit records match.</p>
            ) : (
              <p>
                {data.totalElements} {data.totalElements === 1 ? 'record' : 'records'}
              </p>
            )}
            {data.content.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Source</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Outcome</th>
                    <th>Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {data.content.map((r) => (
                    <tr key={`${r.eventId}-${r.occurredAt}`}>
                      <td>
                        <time dateTime={r.occurredAt}>{new Date(r.occurredAt).toLocaleString()}</time>
                      </td>
                      <td>{r.source}</td>
                      <td>
                        <Link
                          to={`/audit/${encodeURIComponent(r.eventId)}`}
                          state={{ search: location.search }}
                        >
                          {r.action}
                        </Link>
                      </td>
                      <td>{r.actorId}</td>
                      <td>{[r.targetType, r.targetId].filter(Boolean).join(' ')}</td>
                      <td>{r.outcome}</td>
                      <td>{r.ticketRef}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {data.totalPages > 1 && (
              <nav aria-label="Pagination" className="pagination">
                <button
                  type="button"
                  disabled={data.page <= 0}
                  onClick={() => commit({ ...search, page: data.page - 1 }, range)}
                >
                  Previous
                </button>
                <span>
                  Page {data.page + 1} of {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={data.page + 1 >= data.totalPages}
                  onClick={() => commit({ ...search, page: data.page + 1 }, range)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </section>
  );
}

function AuditForm({
  range: initialRange,
  search,
  onSearch,
}: {
  range: RangeChoice;
  search: AuditSearch;
  onSearch: (search: AuditSearch, range: RangeChoice) => void;
}) {
  const [range, setRange] = useState<RangeChoice>(initialRange);
  const [custom, setCustom] = useState(() => ({
    from: toLocalInput(new Date(search.from)),
    to: toLocalInput(new Date(search.to)),
  }));
  const [filters, setFilters] = useState<Filters>(() => ({
    ...emptyFilters(),
    ...Object.fromEntries(AUDIT_FILTERS.flatMap((k) => (search[k] ? [[k, search[k]]] : []))),
  }));
  const [rangeError, setRangeError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    let window: { from: string; to: string };
    if (range === 'custom') {
      const from = fromLocalInput(custom.from);
      const to = fromLocalInput(custom.to);
      if (!from || !to) return setRangeError('Enter both a start and an end');
      if (from >= to) return setRangeError('The start must be before the end');
      window = { from, to };
    } else window = presetRange(range);
    setRangeError(undefined);
    const chosen = Object.fromEntries(
      Object.entries(filters)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v),
    );
    onSearch({ ...window, ...chosen, page: 0 }, range);
  };

  return (
    <form onSubmit={submit} className="filters" noValidate>
      <SelectField label="Time range" value={range} onChange={(e) => setRange(e.target.value as RangeChoice)}>
        {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
          <option key={p} value={p}>
            {PRESET_LABELS[p]}
          </option>
        ))}
        <option value="custom">Custom</option>
      </SelectField>
      {range === 'custom' && (
        <>
          <TextField
            label="From"
            type="datetime-local"
            value={custom.from}
            hint="Your local time"
            onChange={(e) => setCustom({ ...custom, from: e.target.value })}
          />
          <TextField
            label="To"
            type="datetime-local"
            value={custom.to}
            error={rangeError}
            onChange={(e) => setCustom({ ...custom, to: e.target.value })}
          />
        </>
      )}
      {AUDIT_FILTERS.map((key) =>
        key === 'outcome' ? (
          <SelectField
            key={key}
            label={LABELS[key]}
            value={filters.outcome}
            onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}
          >
            <option value="">Any</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
          </SelectField>
        ) : (
          <TextField
            key={key}
            label={LABELS[key]}
            value={filters[key]}
            onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
          />
        ),
      )}
      <button type="submit">Search</button>
    </form>
  );
}

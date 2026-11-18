import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { server } from '../test/server';
import { renderWithProviders } from '../test/fakeAuth';
import { allHandlers, anAuditRecord, createUmsDb, UMS, type UmsDb } from '../test/umsHandlers';
import { AuditPage } from './AuditPage';
import { AuditRecordPage } from './AuditRecordPage';

const NOW = new Date('2026-11-12T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function renderAudit(db: UmsDb, route = '/audit', ...overrides: Parameters<typeof server.use>) {
  server.use(...overrides, ...allHandlers(db));
  return renderWithProviders(
    <Routes>
      <Route path="/audit" element={<AuditPage />} />
      <Route path="/audit/:eventId" element={<AuditRecordPage />} />
    </Routes>,
    { route },
  );
}

const resultRows = () => screen.getAllByRole('row').slice(1);

test('searches the last 24 hours by default', async () => {
  let query: URLSearchParams | undefined;
  const db = createUmsDb({
    audit: [anAuditRecord({ occurredAt: '2026-11-12T08:00:00Z', action: 'USER_CREATED' })],
  });
  renderAudit(
    db,
    '/audit',
    http.get(`${UMS}/admin/audit`, ({ request }) => {
      query = new URL(request.url).searchParams;
      return HttpResponse.json({ content: db.audit, page: 0, size: 50, totalElements: 1, totalPages: 1 });
    }),
  );
  expect(await screen.findByText('USER_CREATED')).toBeInTheDocument();
  expect(query?.get('from')).toBe('2026-11-11T12:00:00.000Z');
  expect(query?.get('to')).toBe('2026-11-12T12:00:00.000Z');
  expect(screen.getByLabelText('Time range')).toHaveValue('24h');
});

test('searching ticket OPS-12 in the last 7 days lists matching records newest first', async () => {
  const db = createUmsDb({
    audit: [
      anAuditRecord({ occurredAt: '2026-11-08T09:00:00Z', ticketRef: 'OPS-12', action: 'USER_CREATED' }),
      anAuditRecord({ occurredAt: '2026-11-11T09:00:00Z', ticketRef: 'OPS-12', action: 'USER_DISABLED' }),
      anAuditRecord({ occurredAt: '2026-11-10T09:00:00Z', ticketRef: 'OPS-99', action: 'TEAM_CREATED' }),
      anAuditRecord({ occurredAt: '2026-10-01T09:00:00Z', ticketRef: 'OPS-12', action: 'ROLE_ASSIGNED' }),
    ],
  });
  renderAudit(db);
  await screen.findByText(/record/);

  await userEvent.selectOptions(screen.getByLabelText('Time range'), '7d');
  await userEvent.type(screen.getByLabelText('Ticket'), 'OPS-12');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  await screen.findByText('2 records');
  expect(resultRows().map((r) => within(r).getAllByRole('cell')[2]!.textContent)).toEqual([
    'USER_DISABLED',
    'USER_CREATED',
  ]);
});

test('filters by every field the UMS supports', async () => {
  let query: URLSearchParams | undefined;
  renderAudit(
    createUmsDb(),
    '/audit',
    http.get(`${UMS}/admin/audit`, ({ request }) => {
      query = new URL(request.url).searchParams;
      return HttpResponse.json({ content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 });
    }),
  );
  await screen.findByText('No audit records match.');
  await userEvent.type(screen.getByLabelText('Source'), 'KEYCLOAK');
  await userEvent.type(screen.getByLabelText('Realm'), 'crm-internal');
  await userEvent.type(screen.getByLabelText('Actor id'), 'a1');
  await userEvent.type(screen.getByLabelText('Target id'), 't1');
  await userEvent.type(screen.getByLabelText('Action'), 'LOGIN_ERROR');
  await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'FAILURE');
  await userEvent.type(screen.getByLabelText('Ticket'), 'OPS-1');
  await userEvent.type(screen.getByLabelText('Correlation id'), 'c1');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  await vi.waitFor(() => expect(query?.get('correlationId')).toBe('c1'));
  expect(Object.fromEntries(query!)).toMatchObject({
    source: 'KEYCLOAK',
    realm: 'crm-internal',
    actorId: 'a1',
    targetId: 't1',
    action: 'LOGIN_ERROR',
    outcome: 'FAILURE',
    ticketRef: 'OPS-1',
    correlationId: 'c1',
  });
});

test('a range the UMS rejects as too wide states the allowed maximum', async () => {
  const db = createUmsDb({ auditMaxDays: 90 });
  renderAudit(db);
  await screen.findByText('No audit records match.');
  await userEvent.selectOptions(screen.getByLabelText('Time range'), 'custom');
  const from = screen.getByLabelText('From');
  await userEvent.clear(from);
  await userEvent.type(from, '2024-11-12T12:00');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('The time range can be at most 90 days');
});

test('pages through results', async () => {
  const db = createUmsDb({
    audit: Array.from({ length: 60 }, (_, i) =>
      anAuditRecord({ occurredAt: new Date(NOW.getTime() - (i + 1) * 60_000).toISOString() }),
    ),
  });
  renderAudit(db);
  await screen.findByText('Page 1 of 2');
  expect(resultRows()).toHaveLength(50);
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2 of 2');
  expect(resultRows()).toHaveLength(10);
});

test('opening a USER_DISABLED record shows all fields and ACTIVE before, DISABLED after', async () => {
  const record = anAuditRecord({
    action: 'USER_DISABLED',
    ticketRef: 'OPS-12',
    occurredAt: '2026-11-12T10:00:00Z',
  });
  renderAudit(createUmsDb({ audit: [record] }));
  await userEvent.click(await screen.findByRole('link', { name: /USER_DISABLED/ }));

  expect(await screen.findByRole('heading', { name: 'USER_DISABLED' })).toBeInTheDocument();
  const fields = screen.getByRole('list', { name: 'Record fields' });
  for (const value of [
    record.eventId,
    'UMS',
    'crm-internal',
    'ADMIN',
    'USER',
    'target-sub',
    'SUCCESS',
    'OPS-12',
    '10.0.0.1',
    'corr-1',
  ]) {
    expect(fields).toHaveTextContent(value);
  }
  const diff = screen.getByRole('table', { name: 'Before and after' });
  const status = within(diff).getByRole('rowheader', { name: 'status' }).closest('tr')!;
  expect(
    within(status)
      .getAllByRole('cell')
      .map((c) => c.textContent),
  ).toEqual(['"ACTIVE"', '"DISABLED"']);
});

test('before/after values render as text, never HTML', async () => {
  const record = anAuditRecord({ before: null, after: { note: '<img src=x onerror=alert(1)>' } });
  renderAudit(createUmsDb({ audit: [record] }), `/audit/${record.eventId}`);
  const diff = await screen.findByRole('table', { name: 'Before and after' });
  expect(diff).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(document.querySelector('img')).toBeNull();
});

test('coming back from a record keeps the search and its results', async () => {
  const db = createUmsDb({
    audit: [
      anAuditRecord({ occurredAt: '2026-11-10T09:00:00Z', ticketRef: 'OPS-12', action: 'USER_DISABLED' }),
    ],
  });
  renderAudit(db);
  await screen.findByText('No audit records match.');
  await userEvent.selectOptions(screen.getByLabelText('Time range'), '7d');
  await userEvent.type(screen.getByLabelText('Ticket'), 'OPS-12');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await userEvent.click(await screen.findByRole('link', { name: 'USER_DISABLED' }));
  await screen.findByRole('heading', { name: 'USER_DISABLED' });

  await userEvent.click(screen.getByRole('link', { name: 'Back to audit' }));
  expect(await screen.findByText('1 record')).toBeInTheDocument();
  expect(screen.getByLabelText('Ticket')).toHaveValue('OPS-12');
  expect(screen.getByLabelText('Time range')).toHaveValue('7d');
});

test('shows that a new search is running while the previous results are still on screen', async () => {
  const db = createUmsDb({ audit: [anAuditRecord({ occurredAt: '2026-11-12T11:00:00Z' })] });
  renderAudit(db);
  await screen.findByText('1 record');
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  server.use(
    http.get(`${UMS}/admin/audit`, async () => {
      await gate;
      return HttpResponse.json({ content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 });
    }),
  );
  await userEvent.type(screen.getByLabelText('Ticket'), 'OPS-1');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByText('Searching…')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Results' })).toHaveAttribute('aria-busy', 'true');
  release();
  expect(await screen.findByText('No audit records match.')).toBeInTheDocument();
});

test('shows nested before/after values as indented JSON and ignores inherited keys', async () => {
  const record = anAuditRecord({ before: { constructor: 1 } as never, after: { rep: { a: 1 } } });
  renderAudit(createUmsDb({ audit: [record] }), `/audit/${record.eventId}`);
  const diff = await screen.findByRole('table', { name: 'Before and after' });
  const rep = within(diff).getByRole('rowheader', { name: 'rep' }).closest('tr')!;
  expect(within(rep).getAllByRole('cell')[1]!.textContent).toBe('{\n  "a": 1\n}');
  const ctor = within(diff).getByRole('rowheader', { name: 'constructor' }).closest('tr')!;
  expect(within(ctor).getAllByRole('cell')[1]!.textContent).toBe('—');
});

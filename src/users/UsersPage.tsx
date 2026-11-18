import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../api/apiContext';
import { ApiErrorAlert } from '../api/ApiErrorAlert';
import {
  fullName,
  umsUsers,
  USER_STATUSES,
  USER_TYPES,
  type UserSearch,
  type UserStatus,
  type UserType,
} from '../api/ums';

const FILTER_KEYS = ['email', 'name', 'userType', 'status'] as const;

function searchFromParams(params: URLSearchParams): UserSearch {
  const userType = params.get('userType');
  const status = params.get('status');
  const page = Number(params.get('page') ?? 0);
  return {
    email: params.get('email') ?? undefined,
    name: params.get('name') ?? undefined,
    userType: USER_TYPES.includes(userType as UserType) ? (userType as UserType) : undefined,
    status: USER_STATUSES.includes(status as UserStatus) ? (status as UserStatus) : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 0,
  };
}

export function UsersPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const search = searchFromParams(params);
  const query = useQuery({
    queryKey: ['users', 'search', search],
    queryFn: () => umsUsers.search(api, search),
    placeholderData: keepPreviousData,
  });

  const applyFilters = (draft: Record<(typeof FILTER_KEYS)[number], string>) => {
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = draft[key].trim();
      if (value) next.set(key, value);
    }
    setParams(next);
  };

  const goToPage = (page: number) => {
    const next = new URLSearchParams(params);
    if (page > 0) next.set('page', String(page));
    else next.delete('page');
    setParams(next);
  };

  const data = query.data;
  return (
    <section>
      <h1>Users</h1>
      <p className="actions">
        <Link to="/users/new/internal">Create internal user</Link>
        <Link to="/users/new/external">Invite external user</Link>
      </p>
      {/* Keyed on the URL so the inputs follow navigation (nav link, back/forward), not just submits. */}
      <FilterForm key={params.toString()} search={search} onSearch={applyFilters} />

      <ApiErrorAlert error={query.error} />
      {query.isPending && <p role="status">Loading users…</p>}
      {data && (
        <>
          <p>
            {data.totalElements} {data.totalElements === 1 ? 'user' : 'users'}
          </p>
          {data.content.length === 0 ? (
            <p>No users match these filters.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((user) => (
                  <tr key={user.sub}>
                    <td>
                      <Link to={`/users/${encodeURIComponent(user.sub)}`}>{user.email}</Link>
                    </td>
                    <td>{fullName(user)}</td>
                    <td>{user.userType}</td>
                    <td>{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.totalPages > 0 && (
            <nav aria-label="Pagination" className="pagination">
              <button type="button" disabled={data.page <= 0} onClick={() => goToPage(data.page - 1)}>
                Previous
              </button>
              <span>
                Page {data.page + 1} of {data.totalPages}
              </span>
              <button
                type="button"
                disabled={data.page + 1 >= data.totalPages}
                onClick={() => goToPage(data.page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function FilterForm({
  search,
  onSearch,
}: {
  search: UserSearch;
  onSearch: (draft: Record<(typeof FILTER_KEYS)[number], string>) => void;
}) {
  const [draft, setDraft] = useState({
    email: search.email ?? '',
    name: search.name ?? '',
    userType: search.userType ?? '',
    status: search.status ?? '',
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(draft);
  };
  return (
    <form role="search" onSubmit={submit} className="filters">
      <label>
        Email
        <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
      </label>
      <label>
        Name
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <label>
        Type
        <select value={draft.userType} onChange={(e) => setDraft({ ...draft, userType: e.target.value })}>
          <option value="">Any</option>
          {USER_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          <option value="">Any</option>
          {USER_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <button type="submit">Search</button>
    </form>
  );
}

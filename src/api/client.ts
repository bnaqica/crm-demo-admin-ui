export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/** An RFC 9457 ProblemDetail body as the UMS returns it; extension members are kept. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
}

/** A failed UMS call. `title`/`detail` come from a ProblemDetail, or are the generic message otherwise. */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly problem?: ProblemDetail;

  constructor({
    status,
    title,
    detail,
    problem,
  }: {
    status: number;
    title?: string;
    detail?: string;
    problem?: ProblemDetail;
  }) {
    const shownTitle = title || GENERIC_ERROR_MESSAGE;
    super(detail ? `${shownTitle}: ${detail}` : shownTitle);
    this.name = 'ApiError';
    this.status = status;
    this.title = shownTitle;
    this.detail = detail;
    this.problem = problem;
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  query?: Record<string, QueryValue | QueryValue[]>;
  body?: unknown;
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => string | undefined;
  /** Silently renews the tokens and returns the new access token; throws when that isn't possible. */
  refreshAccessToken: () => Promise<string | undefined>;
  /** Called once the session can't be recovered: a failed refresh or a 401 after a refresh. */
  onSessionExpired: () => void;
}

export interface ApiClient {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string, body?: unknown): Promise<T>;
}

/** fetch wrapper for the UMS: bearer token, JSON, ProblemDetail mapping and one refresh-and-retry on 401. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  let pendingRefresh: Promise<string | undefined> | undefined;
  let sessionEnded = false;

  const refreshOnce = () => {
    pendingRefresh ??= options.refreshAccessToken().finally(() => {
      pendingRefresh = undefined;
    });
    return pendingRefresh;
  };

  const send = (method: string, url: string, token: string | undefined, body: unknown) => {
    const headers: Record<string, string> = { Accept: 'application/json, application/problem+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }).catch(
      () => {
        throw new ApiError({ status: 0 });
      },
    );
  };

  const expired = () => {
    // Several requests can fail together; start only one new login.
    if (!sessionEnded) {
      sessionEnded = true;
      options.onSessionExpired();
    }
    return new ApiError({ status: 401, title: 'Your session has expired', detail: 'Please sign in again.' });
  };

  async function request<T>(method: string, path: string, { query, body }: RequestOptions = {}): Promise<T> {
    const url = buildUrl(options.baseUrl, path, query);
    const sentToken = options.getAccessToken();
    let response = await send(method, url, sentToken, body);
    if (response.status === 401) {
      let token = options.getAccessToken();
      // Only refresh if nobody has replaced the token since this request was sent.
      if (token === sentToken) {
        try {
          token = await refreshOnce();
        } catch {
          throw expired();
        }
      }
      response = await send(method, url, token ?? options.getAccessToken(), body);
      if (response.status === 401) throw expired();
    }
    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    request,
    get: (path, opts) => request('GET', path, opts),
    post: (path, body) => request('POST', path, { body }),
    put: (path, body) => request('PUT', path, { body }),
    del: (path, body) => request('DELETE', path, { body }),
  };
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query']): string {
  const base = new URL(baseUrl);
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`Refusing to call ${path}: requests outside the UMS would carry the admin token`);
  }
  const url = new URL(`${base.pathname.replace(/\/$/, '')}${path}`, base.origin);
  if (url.origin !== base.origin) throw new Error(`Refusing to call ${path} outside the UMS`);
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.append(key, String(v));
    }
  }
  return url.toString();
}

async function toApiError(response: Response): Promise<ApiError> {
  const type = response.headers.get('Content-Type') ?? '';
  if (type.includes('json')) {
    try {
      const problem = (await response.json()) as ProblemDetail;
      if (problem && typeof problem === 'object') {
        return new ApiError({
          status: response.status,
          title: typeof problem.title === 'string' ? problem.title : undefined,
          detail: typeof problem.detail === 'string' ? problem.detail : undefined,
          problem,
        });
      }
    } catch {
      // fall through to the generic error
    }
  }
  return new ApiError({ status: response.status });
}

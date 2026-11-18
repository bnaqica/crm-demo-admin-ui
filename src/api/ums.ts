/**
 * Typed calls to the UMS admin API. Shapes follow the UMS docs (`admin-users-api.md`, `teams-api.md`,
 * `roles-api.md`, `audit.md`) and its response DTOs. Anything marked GAP is something the Admin UI specs need that
 * the UMS doesn't provide yet; see the "UMS contract" sections of this repo's design.md files.
 */
import type { ApiClient } from './client';

export type UserType = 'INTERNAL' | 'EXTERNAL';
export type UserStatus = 'INVITED' | 'STARTER' | 'ACTIVE' | 'DISABLED';
export const USER_TYPES: UserType[] = ['INTERNAL', 'EXTERNAL'];
export const USER_STATUSES: UserStatus[] = ['INVITED', 'STARTER', 'ACTIVE', 'DISABLED'];
export const PORTAL_ROLES = ['external-starter', 'external-standard'] as const;

export interface UserResponse {
  sub: string;
  userType: UserType;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  multiTeamAllowed: boolean;
  createdAt: string;
  updatedAt: string;
  /** GAP: the UMS doesn't report Keycloak's brute-force lockout. Shown only when a future UMS sends it. */
  locked?: boolean;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export type UserPage = Page<UserResponse>;

export interface UserSearch {
  email?: string;
  name?: string;
  userType?: UserType;
  status?: UserStatus;
  page?: number;
  size?: number;
}

export interface Ticketed {
  ticketRef: string;
}

export interface ProfileInput {
  email: string;
  firstName: string;
  lastName: string;
}

export interface RoleResponse {
  /** The Keycloak role name, such as `team-manager`; also the role's id in the API. */
  name: string;
  description: string;
  owner: string;
  assignableTo: UserType;
  builtIn: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRolesResponse {
  sub: string;
  roles: string[];
}

export type GrantRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export const GRANT_REQUEST_STATUSES: GrantRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'];

export interface GrantRequestResponse {
  id: string;
  type: 'SUPER_MANAGER' | 'ADMIN_ACCOUNT';
  /** The user's sub for SUPER_MANAGER, the new admin's email for ADMIN_ACCOUNT. */
  target: string;
  status: GrantRequestStatus;
  /** The requesting admin's sub. */
  requestedBy: string;
  decidedBy: string | null;
  ticketRef: string;
  details: { role?: string; email?: string; firstName?: string; lastName?: string; [key: string]: unknown };
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string;
}

export interface UserTeamResponse {
  teamId: string;
  teamName: string;
  archived: boolean;
  manager: boolean;
}

export type AssignRoleResult =
  { kind: 'assigned'; roles: string[] } | { kind: 'pending'; grantRequest: GrantRequestResponse };

export type AccountAction = 'disable' | 'enable' | 'unlock' | 'logout' | 'reset-mfa';

const userPath = (sub: string) => `/admin/users/${encodeURIComponent(sub)}`;

export const umsUsers = {
  search: (api: ApiClient, search: UserSearch) => api.get<UserPage>('/admin/users', { query: { ...search } }),
  get: (api: ApiClient, sub: string) => api.get<UserResponse>(userPath(sub)),
  createInternal: (api: ApiClient, input: ProfileInput & Ticketed) =>
    api.post<UserResponse>('/admin/users/internal', input),
  inviteExternal: (api: ApiClient, input: ProfileInput & { role: string } & Ticketed) =>
    api.post<UserResponse>('/admin/users/external', input),
  update: (api: ApiClient, sub: string, input: ProfileInput & Ticketed) =>
    api.put<UserResponse>(userPath(sub), input),
  action: (api: ApiClient, sub: string, action: AccountAction, ticket: Ticketed) =>
    api.post<UserResponse | undefined>(`${userPath(sub)}/${action}`, ticket),
  setMultiTeam: (api: ApiClient, sub: string, input: { allowed: boolean } & Ticketed) =>
    api.put<{ sub: string; multiTeamAllowed: boolean }>(`${userPath(sub)}/multi-team`, input),
  roles: async (api: ApiClient, sub: string) =>
    (await api.get<UserRolesResponse>(`${userPath(sub)}/roles`)).roles,
  teams: (api: ApiClient, sub: string) => api.get<UserTeamResponse[]>(`${userPath(sub)}/teams`),
  async assignRole(
    api: ApiClient,
    sub: string,
    input: { role: string } & Ticketed,
  ): Promise<AssignRoleResult> {
    // 200 carries the user's roles; 202 a grant request a second admin must approve (Super Manager).
    const result = await api.post<UserRolesResponse | GrantRequestResponse>(`${userPath(sub)}/roles`, input);
    return 'roles' in result
      ? { kind: 'assigned', roles: result.roles }
      : { kind: 'pending', grantRequest: result };
  },
  revokeRole: async (api: ApiClient, sub: string, role: string, ticket: Ticketed) =>
    (await api.del<UserRolesResponse>(`${userPath(sub)}/roles/${encodeURIComponent(role)}`, ticket)).roles,
};

export const umsRoles = {
  list: (api: ApiClient) => api.get<RoleResponse[]>('/admin/roles'),
};

export const SUPER_MANAGER = 'super-manager';

export const fullName = (u: Pick<UserResponse, 'firstName' | 'lastName'>) =>
  `${u.firstName} ${u.lastName}`.trim();

// ---- Teams (`teams-api.md`) ----

export interface TeamResponse {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
  archivedAt: string | null;
  memberCount: number;
  managerCount: number;
}

export interface TeamMemberResponse {
  teamId: string;
  sub: string;
  manager: boolean;
  email: string;
  firstName: string;
  lastName: string;
}

const teamPath = (id: string) => `/admin/teams/${encodeURIComponent(id)}`;

export const umsTeams = {
  list: (api: ApiClient) => api.get<TeamResponse[]>('/admin/teams'),
  get: (api: ApiClient, id: string) => api.get<TeamResponse>(teamPath(id)),
  create: (api: ApiClient, input: { name: string } & Ticketed) =>
    api.post<TeamResponse>('/admin/teams', input),
  archive: (api: ApiClient, id: string, ticket: Ticketed) =>
    api.post<TeamResponse>(`${teamPath(id)}/archive`, ticket),
  members: (api: ApiClient, id: string) => api.get<TeamMemberResponse[]>(`${teamPath(id)}/members`),
  addMember: (api: ApiClient, id: string, input: { sub: string; manager: boolean } & Ticketed) =>
    api.post<TeamMemberResponse>(`${teamPath(id)}/members`, input),
  setManager: (api: ApiClient, id: string, sub: string, input: { manager: boolean } & Ticketed) =>
    api.put<TeamMemberResponse>(`${teamPath(id)}/members/${encodeURIComponent(sub)}`, input),
  removeMember: (api: ApiClient, id: string, sub: string, ticket: Ticketed) =>
    api.del<void>(`${teamPath(id)}/members/${encodeURIComponent(sub)}`, ticket),
};

// ---- Roles and permission catalog (`roles-api.md`) ----

export type Realm = 'crm-internal' | 'portal';
/** A role's realm follows its `assignableTo`. */
export const realmFor = (type: UserType): Realm => (type === 'INTERNAL' ? 'crm-internal' : 'portal');

export interface PermissionResponse {
  key: string;
  service: string;
  realm: Realm;
  description: string;
  sensitive: boolean;
  deprecated: boolean;
  deprecatedAt: string | null;
  grantedBy: string[];
}

export interface RoleInput {
  description: string;
  owner: string;
  permissions: string[];
}

export const umsCatalog = {
  list: (api: ApiClient, filter: { service?: string; realm?: Realm; deprecated?: boolean } = {}) =>
    api.get<PermissionResponse[]>('/admin/catalog', { query: { ...filter } }),
};

const rolePath = (name: string) => `/admin/roles/${encodeURIComponent(name)}`;

export const umsRoleAdmin = {
  get: (api: ApiClient, name: string) => api.get<RoleResponse>(rolePath(name)),
  create: (api: ApiClient, input: RoleInput & { name: string; assignableTo: UserType } & Ticketed) =>
    api.post<RoleResponse>('/admin/roles', input),
  update: (api: ApiClient, name: string, input: RoleInput & Ticketed) =>
    api.put<RoleResponse>(rolePath(name), input),
};

// ---- Privileged grant approval (`roles-api.md`) ----

export const umsGrants = {
  list: (api: ApiClient, status?: GrantRequestStatus) =>
    api.get<GrantRequestResponse[]>('/admin/grant-requests', { query: { status } }),
  approve: (api: ApiClient, id: string, ticket: Ticketed) =>
    api.post<GrantRequestResponse>(`/admin/grant-requests/${encodeURIComponent(id)}/approve`, ticket),
  reject: (api: ApiClient, id: string, ticket: Ticketed) =>
    api.post<GrantRequestResponse>(`/admin/grant-requests/${encodeURIComponent(id)}/reject`, ticket),
};

/** Grant requests poll at this interval for the navigation badge. */
export const GRANT_POLL_MS = 60_000;

// ---- Audit search (`audit.md`) ----

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AuditRecordResponse {
  eventId: string;
  occurredAt: string;
  source: string;
  realm: string | null;
  actorId: string | null;
  actorType: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: string | null;
  ticketRef: string | null;
  before: JsonValue | null;
  after: JsonValue | null;
  ipAddress: string | null;
  correlationId: string | null;
  reason: string | null;
}

export const AUDIT_FILTERS = [
  'source',
  'realm',
  'actorId',
  'targetId',
  'action',
  'outcome',
  'ticketRef',
  'correlationId',
] as const;
export type AuditFilter = (typeof AUDIT_FILTERS)[number];

export type AuditSearch = { from: string; to: string; page?: number; size?: number } & Partial<
  Record<AuditFilter, string>
>;

export const umsAudit = {
  search: (api: ApiClient, search: AuditSearch) =>
    api.get<Page<AuditRecordResponse>>('/admin/audit', { query: { ...search } }),
  get: (api: ApiClient, eventId: string) =>
    api.get<AuditRecordResponse>(`/admin/audit/${encodeURIComponent(eventId)}`),
};

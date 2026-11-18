/**
 * An in-memory fake of the UMS admin API for MSW, following the UMS docs and response DTOs. Rules the UI relies on
 * (status transitions, assignability, the Super Manager grant request, ticket format) behave like the UMS.
 */
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { config } from '../config';
import { ADMIN_SUB } from './fakeAuth';
import type {
  AuditRecordResponse,
  GrantRequestResponse,
  PermissionResponse,
  TeamMemberResponse,
  TeamResponse,
  RoleResponse,
  UserPage,
  UserResponse,
  UserStatus,
  UserTeamResponse,
  UserType,
} from '../api/ums';

export const UMS = config.umsBaseUrl;

export interface UmsDb {
  users: UserResponse[];
  roles: RoleResponse[];
  userRoles: Record<string, string[]>;
  userTeams: Record<string, UserTeamResponse[]>;
  teams: TeamResponse[];
  catalog: PermissionResponse[];
  audit: AuditRecordResponse[];
  /** The UMS `UMS_AUDIT_SEARCH_MAX_RANGE`, in days. */
  auditMaxDays: number;
  /** Memberships by team id. Kept in step with `userTeams` by the team handlers. */
  members: Record<string, { sub: string; manager: boolean }[]>;
  grantRequests: GrantRequestResponse[];
  /** The sub of the admin the fake treats as the caller (requester of new grant requests). */
  currentAdminSub: string;
  /** Every write the fake received, for asserting on what the UI sent. */
  writes: { method: string; path: string; body: unknown }[];
}

let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

export function aUser(overrides: Partial<UserResponse> = {}): UserResponse {
  const id = overrides.sub ?? nextId();
  return {
    sub: id,
    userType: 'INTERNAL',
    email: `user${seq}@corp.example`,
    firstName: 'Test',
    lastName: `User${seq}`,
    status: 'ACTIVE',
    multiTeamAllowed: false,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

export function aRole(overrides: Partial<RoleResponse> = {}): RoleResponse {
  return {
    name: 'team-member',
    description: '',
    owner: 'ums',
    assignableTo: 'INTERNAL',
    builtIn: true,
    permissions: [],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

export const builtInRoles = (): RoleResponse[] => [
  aRole({ name: 'external-standard', description: 'Portal user', assignableTo: 'EXTERNAL' }),
  aRole({ name: 'external-starter', description: 'Self-registered portal user', assignableTo: 'EXTERNAL' }),
  aRole({ name: 'super-manager', description: 'Sees every team', permissions: ['deals:read'] }),
  aRole({ name: 'team-manager', description: "Manages a team's CRM data" }),
  aRole({ name: 'team-member', description: 'Works on team data' }),
];

export function createUmsDb(partial: Partial<UmsDb> = {}): UmsDb {
  return {
    users: [],
    roles: builtInRoles(),
    userRoles: {},
    userTeams: {},
    teams: [],
    catalog: [],
    audit: [],
    auditMaxDays: 90,
    members: {},
    grantRequests: [],
    currentAdminSub: ADMIN_SUB,
    writes: [],
    ...partial,
  };
}

const problem = (status: number, title: string, detail?: string, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ type: 'about:blank', title, status, detail, ...extra } as JsonBodyType, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

const TICKET = /^[A-Z][A-Z0-9]*-\d+$/;
const PRIVILEGED_ROLES = new Set(['super-manager']);

type Body = Record<string, unknown>;

async function readWrite(db: UmsDb, request: Request): Promise<Body> {
  const text = await request.text();
  const body = (text ? JSON.parse(text) : {}) as Body;
  db.writes.push({ method: request.method, path: new URL(request.url).pathname, body });
  return body;
}

function badTicket(body: Body) {
  return typeof body.ticketRef !== 'string' || !TICKET.test(body.ticketRef)
    ? problem(400, 'Bad Request', 'ticketRef must be a ticket reference such as OPS-12')
    : undefined;
}

export function userHandlers(db: UmsDb) {
  const find = (sub: unknown) => db.users.find((u) => u.sub === sub);
  const notFound = () => problem(404, 'Not Found', 'User not found');
  const transition = (from: UserStatus, to: UserStatus) =>
    http.post(
      `${UMS}/admin/users/:sub/${to === 'DISABLED' ? 'disable' : 'enable'}`,
      async ({ request, params }) => {
        const body = await readWrite(db, request);
        const user = find(params.sub);
        if (!user) return notFound();
        const invalid = badTicket(body);
        if (invalid) return invalid;
        if (user.status !== from)
          return problem(409, 'Conflict', `Cannot change status from ${user.status} to ${to}`);
        user.status = to;
        return HttpResponse.json(user);
      },
    );
  const noContentAction = (action: string, apply: (u: UserResponse) => void = () => {}) =>
    http.post(`${UMS}/admin/users/:sub/${action}`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const user = find(params.sub);
      if (!user) return notFound();
      const invalid = badTicket(body);
      if (invalid) return invalid;
      apply(user);
      return new HttpResponse(null, { status: 200 });
    });

  return [
    http.get(`${UMS}/admin/users`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      const contains = (value: string, needle: string | null) =>
        !needle || value.toLowerCase().includes(needle.toLowerCase());
      const matches = db.users.filter(
        (u) =>
          contains(u.email, q.get('email')) &&
          contains(`${u.firstName} ${u.lastName}`, q.get('name')) &&
          (!q.get('userType') || u.userType === q.get('userType')) &&
          (!q.get('status') || u.status === q.get('status')),
      );
      const page = Number(q.get('page') ?? 0);
      const size = Number(q.get('size') ?? 20);
      const body: UserPage = {
        content: matches.slice(page * size, page * size + size),
        page,
        size,
        totalElements: matches.length,
        totalPages: Math.ceil(matches.length / size),
      };
      return HttpResponse.json(body);
    }),
    http.get(`${UMS}/admin/users/:sub`, ({ params }) => {
      const user = find(params.sub);
      return user ? HttpResponse.json(user) : notFound();
    }),
    ...(['internal', 'external'] as const).map((kind) =>
      http.post(`${UMS}/admin/users/${kind}`, async ({ request }) => {
        const body = await readWrite(db, request);
        const invalid = badTicket(body);
        if (invalid) return invalid;
        const email = String(body.email ?? '');
        if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          return problem(409, 'Conflict', 'Email already in use');
        }
        const userType: UserType = kind === 'internal' ? 'INTERNAL' : 'EXTERNAL';
        const user = aUser({
          email,
          firstName: String(body.firstName),
          lastName: String(body.lastName),
          userType,
          status: 'INVITED',
          multiTeamAllowed: false,
        });
        db.users.push(user);
        db.userRoles[user.sub] = kind === 'external' ? [String(body.role)] : [];
        return HttpResponse.json(user, { status: 201 });
      }),
    ),
    http.put(`${UMS}/admin/users/:sub`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const user = find(params.sub);
      if (!user) return notFound();
      const invalid = badTicket(body);
      if (invalid) return invalid;
      Object.assign(user, { email: body.email, firstName: body.firstName, lastName: body.lastName });
      return HttpResponse.json(user);
    }),
    http.put(`${UMS}/admin/users/:sub/multi-team`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const user = find(params.sub);
      if (!user) return notFound();
      const invalid = badTicket(body);
      if (invalid) return invalid;
      if (user.userType !== 'INTERNAL')
        return problem(422, 'Unprocessable Entity', 'Only internal users have teams');
      user.multiTeamAllowed = Boolean(body.allowed);
      return HttpResponse.json({ sub: user.sub, multiTeamAllowed: user.multiTeamAllowed });
    }),
    transition('ACTIVE', 'DISABLED'),
    transition('DISABLED', 'ACTIVE'),
    noContentAction('unlock', (u) => {
      u.locked = false;
    }),
    noContentAction('logout'),
    noContentAction('reset-mfa'),
    http.get(`${UMS}/admin/users/:sub/roles`, ({ params }) =>
      HttpResponse.json({ sub: String(params.sub), roles: db.userRoles[String(params.sub)] ?? [] }),
    ),
    http.post(`${UMS}/admin/users/:sub/roles`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const user = find(params.sub);
      if (!user) return notFound();
      const invalid = badTicket(body);
      if (invalid) return invalid;
      const role = db.roles.find((r) => r.name === body.role);
      if (!role) return problem(404, 'Not Found', 'Role not found');
      if (role.assignableTo !== user.userType) {
        return problem(
          422,
          'Unprocessable Entity',
          `${role.name} can't be assigned to ${user.userType} users`,
        );
      }
      if (PRIVILEGED_ROLES.has(role.name)) {
        const grant: GrantRequestResponse = {
          id: nextId(),
          type: 'SUPER_MANAGER',
          target: user.sub,
          status: 'PENDING',
          requestedBy: db.currentAdminSub,
          decidedBy: null,
          ticketRef: String(body.ticketRef),
          details: { role: role.name },
          createdAt: '2026-11-12T10:00:00Z',
          decidedAt: null,
          expiresAt: '2026-11-15T10:00:00Z',
        };
        db.grantRequests.push(grant);
        return HttpResponse.json(grant, { status: 202 });
      }
      const current = (db.userRoles[user.sub] ??= []);
      if (!current.includes(role.name)) current.push(role.name);
      return HttpResponse.json({ sub: user.sub, roles: current });
    }),
    http.delete(`${UMS}/admin/users/:sub/roles/:role`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const invalid = badTicket(body);
      if (invalid) return invalid;
      const sub = String(params.sub);
      const current = db.userRoles[sub] ?? [];
      if (!current.includes(String(params.role)))
        return problem(404, 'Not Found', "The user doesn't hold that role");
      db.userRoles[sub] = current.filter((r) => r !== params.role);
      return HttpResponse.json({ sub, roles: db.userRoles[sub] });
    }),
    http.get(`${UMS}/admin/users/:sub/teams`, ({ params }) =>
      HttpResponse.json(db.userTeams[String(params.sub)] ?? []),
    ),
    http.get(`${UMS}/admin/roles`, () => HttpResponse.json(db.roles)),
  ];
}

export { problem };

export function aTeam(overrides: Partial<TeamResponse> = {}): TeamResponse {
  return {
    id: overrides.id ?? nextId(),
    name: `Team ${seq}`,
    archived: false,
    createdAt: '2026-11-01T10:00:00Z',
    archivedAt: null,
    memberCount: 0,
    managerCount: 0,
    ...overrides,
  };
}

/** Adds a membership to the fake, keeping team counts and the user's team list in step. */
export function addMembership(db: UmsDb, team: TeamResponse, user: UserResponse, manager = false) {
  (db.members[team.id] ??= []).push({ sub: user.sub, manager });
  syncTeam(db, team.id);
}

function syncTeam(db: UmsDb, teamId: string) {
  const team = db.teams.find((t) => t.id === teamId);
  if (!team) return;
  const list = db.members[teamId] ?? [];
  team.memberCount = list.length;
  team.managerCount = list.filter((m) => m.manager).length;
  for (const user of db.users) {
    const mine = (db.userTeams[user.sub] ?? []).filter((t) => t.teamId !== teamId);
    const membership = list.find((m) => m.sub === user.sub);
    if (membership)
      mine.push({ teamId, teamName: team.name, archived: team.archived, manager: membership.manager });
    db.userTeams[user.sub] = mine;
  }
}

export function teamHandlers(db: UmsDb) {
  const team = (id: unknown) => db.teams.find((t) => t.id === id);
  const noTeam = () => problem(404, 'Not Found', 'Team not found');
  const memberResponse = (teamId: string, m: { sub: string; manager: boolean }): TeamMemberResponse => {
    const u = db.users.find((x) => x.sub === m.sub);
    return {
      teamId,
      sub: m.sub,
      manager: m.manager,
      email: u?.email ?? '',
      firstName: u?.firstName ?? '',
      lastName: u?.lastName ?? '',
    };
  };
  const eligible = (u: UserResponse | undefined) => {
    if (!u) return problem(404, 'Not Found', 'User not found');
    if (u.userType !== 'INTERNAL')
      return problem(422, 'Unprocessable Entity', 'Only internal users can be in teams');
    if (u.status === 'DISABLED')
      return problem(422, 'Unprocessable Entity', "A disabled user can't join or manage a team");
    return undefined;
  };
  return [
    http.get(`${UMS}/admin/teams`, () =>
      HttpResponse.json([...db.teams].sort((a, b) => a.name.localeCompare(b.name))),
    ),
    http.get(`${UMS}/admin/teams/:id`, ({ params }) => {
      const t = team(params.id);
      return t ? HttpResponse.json(t) : noTeam();
    }),
    http.post(`${UMS}/admin/teams`, async ({ request }) => {
      const body = await readWrite(db, request);
      const invalid = badTicket(body);
      if (invalid) return invalid;
      const name = String(body.name ?? '').trim();
      if (db.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        return problem(409, 'Conflict', 'A team with that name already exists');
      }
      const created = aTeam({ name });
      db.teams.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.post(`${UMS}/admin/teams/:id/archive`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const t = team(params.id);
      if (!t) return noTeam();
      const invalid = badTicket(body);
      if (invalid) return invalid;
      if (t.archived) return problem(409, 'Conflict', 'The team is already archived');
      t.archived = true;
      t.archivedAt = '2026-11-12T12:00:00Z';
      syncTeam(db, t.id);
      return HttpResponse.json(t);
    }),
    http.get(`${UMS}/admin/teams/:id/members`, ({ params }) => {
      const t = team(params.id);
      if (!t) return noTeam();
      const list = (db.members[t.id] ?? []).map((m) => memberResponse(t.id, m));
      return HttpResponse.json(list.sort((a, b) => a.email.localeCompare(b.email)));
    }),
    http.post(`${UMS}/admin/teams/:id/members`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const t = team(params.id);
      if (!t) return noTeam();
      const invalid = badTicket(body);
      if (invalid) return invalid;
      const user = db.users.find((u) => u.sub === body.sub);
      const refused = eligible(user);
      if (refused) return refused;
      if (t.archived)
        return problem(409, 'Conflict', 'The team is archived and takes no new members or managers');
      if ((db.members[t.id] ?? []).some((m) => m.sub === user!.sub)) {
        return problem(409, 'Conflict', 'The user is already in this team');
      }
      if ((db.userTeams[user!.sub] ?? []).length > 0 && !user!.multiTeamAllowed) {
        return problem(
          422,
          'Unprocessable Entity',
          "The user is already in a team and isn't allowed in more than one",
        );
      }
      const m = { sub: user!.sub, manager: Boolean(body.manager) };
      (db.members[t.id] ??= []).push(m);
      syncTeam(db, t.id);
      return HttpResponse.json(memberResponse(t.id, m), { status: 201 });
    }),
    http.put(`${UMS}/admin/teams/:id/members/:sub`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const t = team(params.id);
      if (!t) return noTeam();
      const invalid = badTicket(body);
      if (invalid) return invalid;
      const m = (db.members[t.id] ?? []).find((x) => x.sub === params.sub);
      if (!m) return problem(404, 'Not Found', "The user isn't in this team");
      if (body.manager && t.archived)
        return problem(409, 'Conflict', 'The team is archived and takes no new members or managers');
      m.manager = Boolean(body.manager);
      syncTeam(db, t.id);
      return HttpResponse.json(memberResponse(t.id, m));
    }),
    http.delete(`${UMS}/admin/teams/:id/members/:sub`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const t = team(params.id);
      if (!t) return noTeam();
      const invalid = badTicket(body);
      if (invalid) return invalid;
      const list = db.members[t.id] ?? [];
      if (!list.some((x) => x.sub === params.sub))
        return problem(404, 'Not Found', "The user isn't in this team");
      db.members[t.id] = list.filter((x) => x.sub !== params.sub);
      syncTeam(db, t.id);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

export function aPermission(overrides: Partial<PermissionResponse> = {}): PermissionResponse {
  return {
    key: 'deals:read',
    service: 'core-service',
    realm: 'crm-internal',
    description: '',
    sensitive: false,
    deprecated: false,
    deprecatedAt: null,
    grantedBy: [],
    ...overrides,
  };
}

const ROLE_NAME = /^[a-z][a-z0-9-]{1,99}$/;

export function roleHandlers(db: UmsDb) {
  const realmOf = (type: unknown) => (type === 'EXTERNAL' ? 'portal' : 'crm-internal');
  const checkPermissions = (keys: unknown, assignableTo: unknown) => {
    if (!Array.isArray(keys)) return problem(400, 'Bad Request', 'permissions is required');
    for (const key of keys) {
      const p = db.catalog.find((c) => c.key === key && c.realm === realmOf(assignableTo));
      if (!p || p.deprecated)
        return problem(422, 'Unprocessable Entity', `${String(key)} can't be granted in this realm`);
    }
    return undefined;
  };
  const withReads = (keys: string[]) => {
    const all = new Set(keys);
    for (const k of keys) if (k.endsWith(':write')) all.add(k.replace(/:write$/, ':read'));
    return [...all].sort();
  };
  return [
    http.get(`${UMS}/admin/catalog`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      return HttpResponse.json(
        db.catalog.filter(
          (p) =>
            (!q.get('service') || p.service === q.get('service')) &&
            (!q.get('realm') || p.realm === q.get('realm')) &&
            (!q.get('deprecated') || String(p.deprecated) === q.get('deprecated')),
        ),
      );
    }),
    http.get(`${UMS}/admin/roles/:name`, ({ params }) => {
      const role = db.roles.find((r) => r.name === params.name);
      return role ? HttpResponse.json(role) : problem(404, 'Not Found', 'Role not found');
    }),
    http.post(`${UMS}/admin/roles`, async ({ request }) => {
      const body = await readWrite(db, request);
      const invalid = badTicket(body);
      if (invalid) return invalid;
      if (typeof body.name !== 'string' || !ROLE_NAME.test(body.name)) {
        return problem(400, 'Bad Request', 'name must be lower-case letters, digits and hyphens');
      }
      if (db.roles.some((r) => r.name === body.name))
        return problem(409, 'Conflict', 'A role with that name exists');
      const refused = checkPermissions(body.permissions, body.assignableTo);
      if (refused) return refused;
      const role = aRole({
        name: body.name,
        description: String(body.description),
        owner: String(body.owner),
        assignableTo: body.assignableTo === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
        builtIn: false,
        permissions: withReads(body.permissions as string[]),
      });
      db.roles.push(role);
      return HttpResponse.json(role, { status: 201 });
    }),
    http.put(`${UMS}/admin/roles/:name`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const role = db.roles.find((r) => r.name === params.name);
      if (!role) return problem(404, 'Not Found', 'Role not found');
      const invalid = badTicket(body);
      if (invalid) return invalid;
      const refused = checkPermissions(body.permissions, role.assignableTo);
      if (refused) return refused;
      Object.assign(role, {
        description: String(body.description),
        owner: String(body.owner),
        permissions: withReads(body.permissions as string[]),
      });
      return HttpResponse.json(role);
    }),
  ];
}

export function aGrantRequest(overrides: Partial<GrantRequestResponse> = {}): GrantRequestResponse {
  return {
    id: overrides.id ?? nextId(),
    type: 'SUPER_MANAGER',
    target: 'target-sub',
    status: 'PENDING',
    requestedBy: 'other-admin-sub',
    decidedBy: null,
    ticketRef: 'OPS-21',
    details: { role: 'super-manager' },
    createdAt: '2026-11-12T09:00:00Z',
    decidedAt: null,
    expiresAt: '2026-11-15T09:00:00Z',
    ...overrides,
  };
}

export function grantHandlers(db: UmsDb) {
  const find = (id: unknown) => db.grantRequests.find((g) => g.id === id);
  const decide = (verb: 'approve' | 'reject') =>
    http.post(`${UMS}/admin/grant-requests/:id/${verb}`, async ({ request, params }) => {
      const body = await readWrite(db, request);
      const grant = find(params.id);
      if (!grant) return problem(404, 'Not Found', 'Grant request not found');
      const invalid = badTicket(body);
      if (invalid) return invalid;
      if (verb === 'approve' && grant.requestedBy === db.currentAdminSub) {
        return problem(403, 'Forbidden', 'A grant request must be approved by a different admin');
      }
      if (grant.status !== 'PENDING') return problem(409, 'Conflict', 'The grant request is closed');
      Object.assign(grant, {
        status: verb === 'approve' ? 'APPROVED' : 'REJECTED',
        decidedBy: db.currentAdminSub,
        decidedAt: '2026-11-12T12:00:00Z',
      });
      if (verb === 'approve' && grant.type === 'SUPER_MANAGER') {
        (db.userRoles[grant.target] ??= []).push(String(grant.details.role ?? 'super-manager'));
      }
      return HttpResponse.json(grant);
    });
  return [
    http.get(`${UMS}/admin/grant-requests`, ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      return HttpResponse.json(
        db.grantRequests
          .filter((g) => !status || g.status === status)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    }),
    http.get(`${UMS}/admin/grant-requests/:id`, ({ params }) => {
      const grant = find(params.id);
      return grant ? HttpResponse.json(grant) : problem(404, 'Not Found', 'Grant request not found');
    }),
    decide('approve'),
    decide('reject'),
  ];
}

export function anAuditRecord(overrides: Partial<AuditRecordResponse> = {}): AuditRecordResponse {
  return {
    eventId: overrides.eventId ?? nextId(),
    occurredAt: '2026-11-12T10:00:00Z',
    source: 'UMS',
    realm: 'crm-internal',
    actorId: ADMIN_SUB,
    actorType: 'ADMIN',
    action: 'USER_DISABLED',
    targetType: 'USER',
    targetId: 'target-sub',
    outcome: 'SUCCESS',
    ticketRef: 'OPS-12',
    before: { status: 'ACTIVE' },
    after: { status: 'DISABLED' },
    ipAddress: '10.0.0.1',
    correlationId: 'corr-1',
    reason: null,
    ...overrides,
  };
}

const AUDIT_FILTER_KEYS = [
  'source',
  'realm',
  'actorId',
  'targetId',
  'action',
  'outcome',
  'ticketRef',
  'correlationId',
] as const;

export function auditHandlers(db: UmsDb) {
  return [
    http.get(`${UMS}/admin/audit`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      const from = Date.parse(q.get('from') ?? '');
      const to = Date.parse(q.get('to') ?? '');
      if (Number.isNaN(from) || Number.isNaN(to) || to <= from) {
        return problem(400, 'Bad Request', 'A search needs a time range: from and to');
      }
      if (to - from > db.auditMaxDays * 86_400_000) {
        return problem(400, 'Bad Request', `The time range can be at most ${db.auditMaxDays} days`);
      }
      const matches = db.audit
        .filter((r) => {
          const at = Date.parse(r.occurredAt);
          return at >= from && at < to && AUDIT_FILTER_KEYS.every((k) => !q.get(k) || r[k] === q.get(k));
        })
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      const page = Number(q.get('page') ?? 0);
      const size = Number(q.get('size') ?? 50);
      return HttpResponse.json({
        content: matches.slice(page * size, page * size + size),
        page,
        size,
        totalElements: matches.length,
        totalPages: Math.ceil(matches.length / size),
      });
    }),
    http.get(`${UMS}/admin/audit/:eventId`, ({ params }) => {
      const record = db.audit.find((r) => r.eventId === params.eventId);
      return record ? HttpResponse.json(record) : problem(404, 'Not Found', 'Audit record not found');
    }),
  ];
}

/** Every fake endpoint, for tests that render the whole app. */
export const allHandlers = (db: UmsDb) => [
  ...userHandlers(db),
  ...teamHandlers(db),
  ...roleHandlers(db),
  ...grantHandlers(db),
  ...auditHandlers(db),
];

import type { PermissionResponse } from '../api/ums';

/** `deals:write` → `deals`; `ui:reports-tab` → `ui`. */
export const resourceOf = (key: string) => key.split(':')[0] ?? key;

/** The catalog grouped by service, then resource, each sorted by name. */
export function groupCatalog(permissions: PermissionResponse[]) {
  const services = new Map<string, Map<string, PermissionResponse[]>>();
  for (const p of permissions) {
    const resources = services.get(p.service) ?? new Map<string, PermissionResponse[]>();
    services.set(p.service, resources);
    const list = resources.get(resourceOf(p.key)) ?? [];
    resources.set(resourceOf(p.key), list);
    list.push(p);
  }
  const byName = <T>(entries: Iterable<[string, T]>) => [...entries].sort(([a], [b]) => a.localeCompare(b));
  return byName(services).map(([service, resources]) => ({
    service,
    resources: byName(resources).map(([resource, list]) => ({
      resource,
      permissions: [...list].sort((a, b) => a.key.localeCompare(b.key)),
    })),
  }));
}

/** The `:read` permission that a `:write` permission brings with it, if any. */
export const readFor = (key: string) =>
  key.endsWith(':write') ? key.replace(/:write$/, ':read') : undefined;

/**
 * Toggles a permission in a selection. Selecting `<resource>:write` also selects `<resource>:read`, which can't be
 * deselected while the write is selected.
 */
export function togglePermission(selected: string[], key: string): string[] {
  const set = new Set(selected);
  if (set.has(key)) {
    if (lockedBy(selected, key)) return selected;
    set.delete(key);
  } else {
    set.add(key);
    const read = readFor(key);
    if (read) set.add(read);
  }
  return [...set].sort();
}

/** True when `key` is a read held in place by its selected write. */
export const lockedBy = (selected: string[], key: string) =>
  key.endsWith(':read') && selected.includes(key.replace(/:read$/, ':write'));

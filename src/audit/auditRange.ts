export const PRESETS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 } as const;
export type Preset = keyof typeof PRESETS;
export type RangeChoice = Preset | 'custom';

const DAY = 86_400_000;

/** The `from`/`to` instants for a preset, ending now. */
export function presetRange(preset: Preset, now = new Date()) {
  return { from: new Date(now.getTime() - PRESETS[preset] * DAY).toISOString(), to: now.toISOString() };
}

/** `2026-11-12T12:00` in local time, for a datetime-local input. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A datetime-local value as an ISO instant, or undefined if it isn't a date. */
export function fromLocalInput(value: string): string | undefined {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

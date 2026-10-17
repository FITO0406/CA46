export const REQUEST_KINDS = ['soporte', 'derechos', 'baja', 'exportacion', 'restauracion'] as const;
export type RequestKind = typeof REQUEST_KINDS[number];
export function validateServiceRequest(value: unknown, isAdmin: boolean) {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const kind = String(body.kind || '') as RequestKind;
  const message = String(body.message || '').trim();
  if (!REQUEST_KINDS.includes(kind) || message.length < 10 || message.length > 4000) return null;
  if (!isAdmin && ['baja', 'exportacion', 'restauracion'].includes(kind)) return null;
  return { kind, message };
}
export function rightsDueAt(now: Date) {
  const due = new Date(now);
  const day = due.getUTCDate();
  due.setUTCDate(1);
  due.setUTCMonth(due.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
  due.setUTCDate(Math.min(day, lastDay));
  return due.toISOString();
}

/**
 * Row highlight helpers for admin list tables (notification-driven).
 */

import type { AdminFeedEvent, AdminFeedEventType, AdminFeedNotificationKind } from '@/lib/admin/adminNotificationTypes';
import { cn } from '@/lib/utils';

export type RowHighlightKind = 'new' | 'updated' | 'paid' | 'status';

export type RowHighlightScope = 'online_order' | 'ambassador_sale' | 'ambassador_application';

export type ApplicationStatusTint = 'approved' | 'rejected' | 'removed' | 'other';

export interface RowHighlightEntry {
  kind: RowHighlightKind;
  expiresAt: number;
  statusTint?: ApplicationStatusTint;
}

export type GetRowHighlight = (recordId: string) => RowHighlightEntry | undefined;

export const ROW_HIGHLIGHT_TTL_MS: Record<RowHighlightKind, number> = {
  new: 5000,
  updated: 4000,
  paid: 4000,
  status: 4000,
};

/** Machine-readable feed event id: `application:<recordId>:status:<status>` */
const APPLICATION_STATUS_EVENT_ID_RE =
  /^application:[^:]+:status:(approved|rejected|suspended|removed)$/;

export function rowHighlightKey(scope: RowHighlightScope, recordId: string): string {
  return `${scope}:${recordId}`;
}

export function rowHighlightScopeFromFeedKind(
  kind: AdminFeedNotificationKind,
): RowHighlightScope | null {
  switch (kind) {
    case 'online_order':
      return 'online_order';
    case 'ambassador_order':
      return 'ambassador_sale';
    case 'ambassador_application':
      return 'ambassador_application';
    default:
      return null;
  }
}

export function mapFeedEventToRowHighlightKind(
  type: AdminFeedEventType,
): RowHighlightKind | null {
  switch (type) {
    case 'online_order_created':
    case 'ambassador_sale_created':
    case 'ambassador_application_created':
      return 'new';
    case 'online_order_paid':
      return 'paid';
    case 'online_order_status_changed':
    case 'ambassador_sale_status_changed':
    case 'ambassador_application_status_changed':
      return 'status';
    default:
      return null;
  }
}

/**
 * Application status tint from structured feed event id (not human message text).
 * Falls back to neutral amber when status is not present in the event id.
 */
export function applicationStatusTintFromFeedEvent(
  ev: AdminFeedEvent,
): ApplicationStatusTint | undefined {
  if (ev.type !== 'ambassador_application_status_changed') return undefined;
  const match = ev.id.match(APPLICATION_STATUS_EVENT_ID_RE);
  if (!match) return 'other';
  const status = match[1];
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'suspended' || status === 'removed') return 'removed';
  return 'other';
}

export function buildRowHighlightFromFeedEvent(ev: AdminFeedEvent): RowHighlightEntry | null {
  const kind = mapFeedEventToRowHighlightKind(ev.type);
  if (!kind) return null;
  const ttl = ROW_HIGHLIGHT_TTL_MS[kind];
  return {
    kind,
    expiresAt: Date.now() + ttl,
    statusTint: applicationStatusTintFromFeedEvent(ev),
  };
}

export function rowHighlightStorageKeyFromFeedEvent(ev: AdminFeedEvent): string | null {
  const scope = rowHighlightScopeFromFeedKind(ev.kind);
  if (!scope || !ev.recordId) return null;
  return rowHighlightKey(scope, ev.recordId);
}

export function isRowHighlightActive(entry: RowHighlightEntry | undefined, now = Date.now()): boolean {
  if (!entry) return false;
  return entry.expiresAt > now;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function shouldPulseStatusDot(entry: RowHighlightEntry | undefined): boolean {
  if (!isRowHighlightActive(entry)) return false;
  return entry!.kind === 'paid' || entry!.kind === 'status';
}

function statusTintClasses(tint: ApplicationStatusTint | undefined): string {
  switch (tint) {
    case 'approved':
      return 'bg-emerald-500/10';
    case 'rejected':
    case 'removed':
      return 'bg-red-500/8';
    default:
      return 'bg-amber-500/8';
  }
}

export function getRowHighlightClass(
  entry: RowHighlightEntry | undefined,
  options?: { reducedMotion?: boolean },
): string {
  if (!isRowHighlightActive(entry)) return '';

  const reduced = options?.reducedMotion ?? prefersReducedMotion();
  const kind = entry!.kind;

  if (kind === 'new') {
    return cn(
      'border-l-2 border-l-primary/60 bg-primary/5',
      !reduced && 'motion-safe:animate-admin-row-enter',
    );
  }

  if (kind === 'paid') {
    return 'bg-emerald-500/8';
  }

  if (kind === 'status') {
    return statusTintClasses(entry!.statusTint);
  }

  return 'bg-amber-500/8';
}

export function getStatusPulseClass(entry: RowHighlightEntry | undefined): string {
  if (!shouldPulseStatusDot(entry)) return '';
  if (prefersReducedMotion()) return '';
  const kind = entry!.kind;
  if (kind === 'paid') {
    return 'motion-safe:animate-admin-status-pulse-emerald';
  }
  return 'motion-safe:animate-admin-status-pulse-amber';
}

export function mergeRowHighlightsFromFeedEvents(
  prev: Map<string, RowHighlightEntry>,
  events: AdminFeedEvent[],
): Map<string, RowHighlightEntry> {
  const next = new Map(prev);
  for (const ev of events) {
    const entry = buildRowHighlightFromFeedEvent(ev);
    const key = rowHighlightStorageKeyFromFeedEvent(ev);
    if (!entry || !key) continue;
    next.set(key, entry);
  }
  return next;
}

export function pruneExpiredRowHighlights(
  map: Map<string, RowHighlightEntry>,
  now = Date.now(),
): Map<string, RowHighlightEntry> {
  let changed = false;
  const next = new Map(map);
  for (const [id, entry] of map) {
    if (entry.expiresAt <= now) {
      next.delete(id);
      changed = true;
    }
  }
  return changed ? next : map;
}

export function lookupRowHighlight(
  map: Map<string, RowHighlightEntry>,
  scope: RowHighlightScope,
  recordId: string,
): RowHighlightEntry | undefined {
  const entry = map.get(rowHighlightKey(scope, recordId));
  if (!isRowHighlightActive(entry)) return undefined;
  return entry;
}

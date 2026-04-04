/**
 * Centralized date formatting utilities.
 * All dates across the site use day/month/year (DD/MM/YYYY) format.
 */

import { format } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

export type DateLocale = 'en' | 'fr';

/**
 * Format a date as DD/MM/YYYY (day/month/year).
 * Use this for all date displays across the site.
 */
export function formatDateDMY(
  date: Date | string | number,
  locale: DateLocale = 'en'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const loc = locale === 'fr' ? fr : enGB;
  return format(d, 'dd/MM/yyyy', { locale: loc });
}

/**
 * Format a date with time as DD/MM/YYYY HH:mm.
 */
export function formatDateTimeDMY(
  date: Date | string | number,
  locale: DateLocale = 'en'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const loc = locale === 'fr' ? fr : enGB;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: loc });
}

/**
 * Format a date for display with weekday and full month (e.g. "Monday, 15 March 2026").
 * Uses day/month/year ordering via locale.
 */
export function formatDateLong(
  date: Date | string | number,
  locale: DateLocale = 'en'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const loc = locale === 'fr' ? fr : enGB;
  return format(d, "EEEE, d MMMM yyyy", { locale: loc });
}

/**
 * Format a date short (e.g. "15 Mar 2026") for meta titles etc.
 */
export function formatDateShortDMY(
  date: Date | string | number,
  locale: DateLocale = 'en'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const loc = locale === 'fr' ? fr : enGB;
  return format(d, 'dd MMM yyyy', { locale: loc });
}

/**
 * Format a date with time for long display.
 */
export function formatDateTimeLong(
  date: Date | string | number,
  locale: DateLocale = 'en'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const loc = locale === 'fr' ? fr : enGB;
  const pattern = locale === 'fr' ? "EEEE d MMMM yyyy 'à' HH:mm" : "EEEE, d MMMM yyyy 'at' HH:mm";
  return format(d, pattern, { locale: loc });
}

/**
 * Format an instant from the DB (ISO / timestamptz) for <input type="datetime-local">.
 * Uses the user's local calendar clock so edits match what they see in the picker.
 */
export function toDatetimeLocalValue(date: Date | string | number): string {
  const d =
    typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Parse datetime-local value (with optional seconds) or a full ISO string → UTC ISO for the API.
 */
export function fromDatetimeLocalToIso(value: string): string | null {
  const s = value.trim();
  if (!s) return null;
  const localMatch = s.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?$/
  );
  if (localMatch) {
    const y = +localMatch[1];
    const mo = +localMatch[2] - 1;
    const day = +localMatch[3];
    const h = +localMatch[4];
    const min = +localMatch[5];
    const sec = localMatch[6] ? +localMatch[6] : 0;
    const d = new Date(y, mo, day, h, min, sec, 0);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** @deprecated Pass sales no longer use a time-based grace; kept for any legacy imports. */
export const PASS_PURCHASE_GRACE_HOURS = 2;
export const PASS_PURCHASE_GRACE_MS = PASS_PURCHASE_GRACE_HOURS * 60 * 60 * 1000;

/**
 * True when pass purchase / Book Now should be closed.
 * Only admin-driven lifecycle: `completed` or `cancelled` (not event date).
 */
export function isPassPurchaseWindowClosed(
  _eventDate: string | Date | number,
  eventStatus?: string | null,
  _now: Date = new Date()
): boolean {
  return eventStatus === 'completed' || eventStatus === 'cancelled';
}

/** How many days after the event admins can still pick it in the dashboard (orders, reports). */
export const ADMIN_DASHBOARD_EVENT_LOOKBACK_DAYS = 30;

/**
 * Whether an event appears in the admin dashboard event selector (non-gallery).
 * Includes active upcoming sales window, and events whose start was within the lookback window.
 */
export function isEventOnAdminDashboardSelector(
  eventDate: string | Date | number,
  opts: { eventType?: string | null; eventStatus?: string | null } = {},
  now: Date = new Date()
): boolean {
  if (opts.eventType === 'gallery') return false;
  if (!isPassPurchaseWindowClosed(eventDate, opts.eventStatus ?? null, now)) return true;
  const start =
    typeof eventDate === 'string' || typeof eventDate === 'number'
      ? new Date(eventDate)
      : eventDate;
  if (isNaN(start.getTime())) return false;
  const cutoff =
    now.getTime() - ADMIN_DASHBOARD_EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return start.getTime() >= cutoff;
}

function parseEventDateMs(
  d: string | Date | number | null | undefined
): number {
  if (d == null || d === '') return 0;
  const t =
    typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  const ms = t.getTime();
  return isNaN(ms) ? 0 : ms;
}

/**
 * Order for admin dashboard event dropdown: upcoming first (by `date` ascending), then past (by `date` descending).
 */
export function sortEventsForAdminDashboardSelector<
  T extends { date?: string | null },
>(events: readonly T[], now: Date = new Date()): T[] {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const e of events) {
    const ms = parseEventDateMs(e.date);
    if (ms >= startOfToday) upcoming.push(e);
    else past.push(e);
  }
  upcoming.sort((a, b) => parseEventDateMs(a.date) - parseEventDateMs(b.date));
  past.sort((a, b) => parseEventDateMs(b.date) - parseEventDateMs(a.date));
  return [...upcoming, ...past];
}

/**
 * Default selected event: next upcoming by calendar `date`, or if none, the most recently created (`created_at`).
 */
export function getDefaultAdminDashboardEventId(
  events: ReadonlyArray<{
    id: string;
    date?: string | null;
    created_at?: string | null;
  }>,
  now: Date = new Date()
): string {
  if (events.length === 0) return '';
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const upcoming = events
    .filter((e) => parseEventDateMs(e.date) >= startOfToday)
    .sort((a, b) => parseEventDateMs(a.date) - parseEventDateMs(b.date));
  if (upcoming.length > 0) return upcoming[0].id;
  const byCreated = [...events].sort(
    (a, b) => parseEventDateMs(b.created_at) - parseEventDateMs(a.created_at)
  );
  return byCreated[0]?.id ?? '';
}

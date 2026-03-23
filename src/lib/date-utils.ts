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

/** Hours after event start when pass purchase / Book Now closes (client + listings). */
export const PASS_PURCHASE_GRACE_HOURS = 2;
export const PASS_PURCHASE_GRACE_MS = PASS_PURCHASE_GRACE_HOURS * 60 * 60 * 1000;

/**
 * True when pass purchase should be closed: event start + grace has passed, or status is completed.
 */
export function isPassPurchaseWindowClosed(
  eventDate: string | Date | number,
  eventStatus?: string | null,
  now: Date = new Date()
): boolean {
  if (eventStatus === 'completed') return true;
  const start =
    typeof eventDate === 'string' || typeof eventDate === 'number'
      ? new Date(eventDate)
      : eventDate;
  if (isNaN(start.getTime())) return false;
  return now.getTime() >= start.getTime() + PASS_PURCHASE_GRACE_MS;
}

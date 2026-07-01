import { useCallback, useEffect, useRef } from 'react';
import { adminApi } from '@/lib/adminApi';
import {
  ADMIN_NOTIFICATION_BASELINE_KEY,
  ADMIN_NOTIFICATION_CURSOR_KEY,
  ADMIN_NOTIFICATION_SEEN_KEY,
  type AdminFeedEvent,
} from '@/lib/admin/adminNotificationTypes';
import {
  isAdminNotificationAudioUnlocked,
  playAdminNotificationSound,
} from '@/lib/admin/adminNotificationAudio';
import { showAdminDesktopNotification } from '@/lib/admin/adminNotificationDesktop';
import {
  initAdminNotificationFeedbackLock,
  isFeedbackClaimedRemotely,
  tryClaimFeedbackLock,
} from '@/lib/admin/adminNotificationFeedbackLock';

const POLL_VISIBLE_MS = 15_000;
const POLL_HIDDEN_MS = 120_000;
const SEEN_MAX = 500;
const DEBOUNCE_REFETCH_MS = 1000;

export type DesktopNotificationPermissionState =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied';

export function getDesktopNotificationPermissionState(): DesktopNotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const perm = Notification.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') {
    return perm;
  }
  return 'default';
}

function loadSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(ADMIN_NOTIFICATION_SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistSeenIds(seen: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = [...seen].slice(-SEEN_MAX);
    sessionStorage.setItem(ADMIN_NOTIFICATION_SEEN_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function loadCursor(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(ADMIN_NOTIFICATION_CURSOR_KEY);
  } catch {
    return null;
  }
}

function saveCursor(iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ADMIN_NOTIFICATION_CURSOR_KEY, iso);
  } catch {
    // ignore
  }
}

function loadBaseline(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(ADMIN_NOTIFICATION_BASELINE_KEY);
  } catch {
    return null;
  }
}

function saveBaseline(iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ADMIN_NOTIFICATION_BASELINE_KEY, iso);
  } catch {
    // ignore
  }
}

/** Suppress historical backlog; allow events strictly after dashboard baseline. */
export function filterEventsAfterBaseline(
  events: AdminFeedEvent[],
  baselineIso: string,
): AdminFeedEvent[] {
  const baselineMs = new Date(baselineIso).getTime();
  return events.filter((ev) => new Date(ev.occurredAt).getTime() > baselineMs);
}

export function buildFeedbackBatchKey(eventIds: string[]): string {
  return eventIds.slice().sort().join('|');
}

export function shouldPlayFeedbackForBatch(batchKey: string): boolean {
  if (isFeedbackClaimedRemotely(batchKey)) return false;
  return tryClaimFeedbackLock(batchKey);
}

export interface UseAdminNotificationFeedOptions {
  enabled: boolean;
  eventId: string | null;
  soundEnabled: boolean;
  desktopAlertsEnabled: boolean;
  onEvents: (events: AdminFeedEvent[]) => void;
  onRefreshOnlineOrders?: () => void;
  onRefreshAmbassadorSales?: () => void;
  onRefreshApplications?: () => void;
}

export function showDesktopNotificationForEvent(
  title: string,
  body: string,
  desktopAlertsEnabled: boolean,
): void {
  if (!desktopAlertsEnabled) return;
  showAdminDesktopNotification(title, body);
}

export function useAdminNotificationFeed({
  enabled,
  eventId,
  soundEnabled,
  desktopAlertsEnabled,
  onEvents,
  onRefreshOnlineOrders,
  onRefreshAmbassadorSales,
  onRefreshApplications,
}: UseAdminNotificationFeedOptions): void {
  const seenRef = useRef<Set<string>>(loadSeenIds());
  const cursorRef = useRef<string | null>(loadCursor());
  const baselineRef = useRef<string | null>(loadBaseline());
  const debounceTimers = useRef<{
    online?: ReturnType<typeof setTimeout>;
    ambassador?: ReturnType<typeof setTimeout>;
    applications?: ReturnType<typeof setTimeout>;
  }>({});

  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;
  const refreshOnlineRef = useRef(onRefreshOnlineOrders);
  refreshOnlineRef.current = onRefreshOnlineOrders;
  const refreshAmbRef = useRef(onRefreshAmbassadorSales);
  refreshAmbRef.current = onRefreshAmbassadorSales;
  const refreshAppsRef = useRef(onRefreshApplications);
  refreshAppsRef.current = onRefreshApplications;

  const scheduleRefetch = useCallback(
    (kind: 'online' | 'ambassador' | 'applications') => {
      const timers = debounceTimers.current;
      const key =
        kind === 'online' ? 'online' : kind === 'ambassador' ? 'ambassador' : 'applications';
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        timers[key] = undefined;
        if (kind === 'online') refreshOnlineRef.current?.();
        else if (kind === 'ambassador') refreshAmbRef.current?.();
        else refreshAppsRef.current?.();
      }, DEBOUNCE_REFETCH_MS);
    },
    [],
  );

  const processEvents = useCallback(
    (events: AdminFeedEvent[]) => {
      if (events.length === 0) return;

      const baseline = baselineRef.current;
      const eligible = baseline ? filterEventsAfterBaseline(events, baseline) : events;
      if (eligible.length === 0) return;

      const fresh: AdminFeedEvent[] = [];
      for (const ev of eligible) {
        if (seenRef.current.has(ev.id)) continue;
        seenRef.current.add(ev.id);
        fresh.push(ev);
      }
      if (fresh.length === 0) return;

      persistSeenIds(seenRef.current);
      onEventsRef.current(fresh);

      for (const ev of fresh) {
        if (ev.type.startsWith('online_order')) scheduleRefetch('online');
        if (ev.type.startsWith('ambassador_sale')) scheduleRefetch('ambassador');
        if (ev.type.startsWith('ambassador_application')) scheduleRefetch('applications');
      }

      const shouldPlaySound =
        soundEnabled &&
        isAdminNotificationAudioUnlocked() &&
        fresh.some((e) => e.playSound);

      const shouldDesktop =
        desktopAlertsEnabled && fresh.some((e) => e.showDesktop);

      const batchKey = buildFeedbackBatchKey(fresh.map((e) => e.id));
      const claimFeedback =
        (shouldPlaySound || shouldDesktop) && shouldPlayFeedbackForBatch(batchKey);

      if (claimFeedback && shouldPlaySound) {
        playAdminNotificationSound();
      }
      if (claimFeedback && shouldDesktop) {
        for (const ev of fresh) {
          if (ev.showDesktop) {
            showDesktopNotificationForEvent(ev.title, ev.message, desktopAlertsEnabled);
          }
        }
      }
    },
    [desktopAlertsEnabled, scheduleRefetch, soundEnabled],
  );

  useEffect(() => {
    if (!enabled) return;

    initAdminNotificationFeedbackLock();

    if (!baselineRef.current) {
      baselineRef.current = new Date().toISOString();
      saveBaseline(baselineRef.current);
    }
    if (!cursorRef.current) {
      cursorRef.current = baselineRef.current;
      saveCursor(baselineRef.current);
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (cancelled) return;

      let since = cursorRef.current || baselineRef.current || new Date().toISOString();
      let keepFetching = true;

      while (keepFetching && !cancelled) {
        try {
          const result = await adminApi.fetchNotificationFeed({
            since,
            eventId,
          });

          if (cancelled) return;

          processEvents(result.events);

          if (result.hasMore) {
            since = result.nextCursor;
            cursorRef.current = since;
            saveCursor(since);
            keepFetching = true;
          } else {
            cursorRef.current = result.nextCursor;
            saveCursor(result.nextCursor);
            keepFetching = false;
          }
        } catch (e) {
          console.warn('Admin notification feed poll failed (non-blocking):', e);
          keepFetching = false;
        }
      }
    };

    const schedule = () => {
      if (intervalId) clearInterval(intervalId);
      const ms =
        typeof document !== 'undefined' && document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
      intervalId = setInterval(() => {
        void poll();
      }, ms);
    };

    void poll();
    schedule();

    const onVisibility = () => {
      schedule();
      if (!document.hidden) {
        void poll();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      const timers = debounceTimers.current;
      if (timers.online) clearTimeout(timers.online);
      if (timers.ambassador) clearTimeout(timers.ambassador);
      if (timers.applications) clearTimeout(timers.applications);
    };
  }, [enabled, eventId, processEvents]);
}

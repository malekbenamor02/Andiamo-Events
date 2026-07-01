import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildFeedbackBatchKey,
  filterEventsAfterBaseline,
  getDesktopNotificationPermissionState,
  showDesktopNotificationForEvent,
} from './useAdminNotificationFeed';
import { ADMIN_NOTIFICATION_SEEN_KEY } from '@/lib/admin/adminNotificationTypes';
import type { AdminFeedEvent } from '@/lib/admin/adminNotificationTypes';
import {
  isFeedbackClaimedRemotely,
  resetAdminNotificationFeedbackLockForTests,
  tryClaimFeedbackLock,
} from '@/lib/admin/adminNotificationFeedbackLock';

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function makeEvent(id: string, occurredAt: string): AdminFeedEvent {
  return {
    id,
    type: 'online_order_created',
    kind: 'online_order',
    eventId: 'e1',
    recordId: id,
    occurredAt,
    title: 'New online order',
    message: 'Order #1',
    severity: 'info',
    tabTarget: 'online-orders',
    playSound: true,
    showDesktop: true,
  };
}

describe('useAdminNotificationFeed helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', createStorageMock());
    vi.stubGlobal('localStorage', createStorageMock());
    vi.stubGlobal('window', globalThis);
    resetAdminNotificationFeedbackLockForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAdminNotificationFeedbackLockForTests();
  });

  it('getDesktopNotificationPermissionState returns unsupported without Notification API', () => {
    const original = global.Notification;
    // @ts-expect-error test override
    delete global.Notification;
    expect(getDesktopNotificationPermissionState()).toBe('unsupported');
    global.Notification = original;
  });

  it('showDesktopNotificationForEvent does not call Notification when disabled', () => {
    const spy = vi.fn();
    global.Notification = spy as unknown as typeof Notification;
    showDesktopNotificationForEvent('T', 'B', false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('sessionStorage seen ids persist for dedupe', () => {
    sessionStorage.setItem(ADMIN_NOTIFICATION_SEEN_KEY, JSON.stringify(['a', 'b']));
    const raw = sessionStorage.getItem(ADMIN_NOTIFICATION_SEEN_KEY);
    expect(JSON.parse(raw!)).toEqual(['a', 'b']);
  });

  it('filterEventsAfterBaseline suppresses historical backlog only', () => {
    const baseline = '2026-07-01T12:00:00.000Z';
    const events = [
      makeEvent('old', '2026-07-01T11:00:00.000Z'),
      makeEvent('at-baseline', baseline),
      makeEvent('new', '2026-07-01T12:00:01.000Z'),
    ];
    const filtered = filterEventsAfterBaseline(events, baseline);
    expect(filtered.map((e) => e.id)).toEqual(['new']);
  });

  it('localStorage feedback lock prevents duplicate claims for same batch', () => {
    const batchKey = buildFeedbackBatchKey(['a', 'b']);
    expect(tryClaimFeedbackLock(batchKey)).toBe(true);
    expect(tryClaimFeedbackLock(batchKey)).toBe(false);
  });

  it('remote feedback claim blocks playback in this tab', async () => {
    if (typeof BroadcastChannel === 'undefined') return;

    const { initAdminNotificationFeedbackLock } = await import(
      '@/lib/admin/adminNotificationFeedbackLock'
    );
    initAdminNotificationFeedbackLock();

    const batchKey = 'order:1:created';
    const bc = new BroadcastChannel('admin-notifications');
    bc.postMessage({
      type: 'feedback-claimed',
      batchKey,
      tabId: 'other-tab',
      ts: Date.now(),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    bc.close();

    expect(isFeedbackClaimedRemotely(batchKey)).toBe(true);
  });
});

describe('Dashboard notification permission UX contract', () => {
  it('does not auto-request permission on dashboard mount', () => {
    const dashboardSrc = readFileSync(
      join(process.cwd(), 'src/pages/admin/Dashboard.tsx'),
      'utf8',
    );
    expect(dashboardSrc).not.toMatch(
      /useEffect\(\(\) => \{[\s\S]{0,200}Notification\.requestPermission\(\)/,
    );
    expect(dashboardSrc).toMatch(/handleEnableAlerts/);
    expect(dashboardSrc).toMatch(/useAdminNotificationFeed/);
  });

  it('feed poll failures are non-blocking in hook source', () => {
    const hookSrc = readFileSync(
      join(process.cwd(), 'src/hooks/useAdminNotificationFeed.ts'),
      'utf8',
    );
    expect(hookSrc).toMatch(/console\.warn\('Admin notification feed poll failed/);
    expect(hookSrc).not.toMatch(/throw e/);
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AdminFeedEvent } from '@/lib/admin/adminNotificationTypes';
import {
  ROW_HIGHLIGHT_TTL_MS,
  applicationStatusTintFromFeedEvent,
  buildRowHighlightFromFeedEvent,
  getRowHighlightClass,
  getStatusPulseClass,
  isRowHighlightActive,
  lookupRowHighlight,
  mapFeedEventToRowHighlightKind,
  mergeRowHighlightsFromFeedEvents,
  pruneExpiredRowHighlights,
  rowHighlightKey,
  rowHighlightStorageKeyFromFeedEvent,
  shouldPulseStatusDot,
} from './rowHighlight';

function feedEvent(overrides: Partial<AdminFeedEvent> = {}): AdminFeedEvent {
  return {
    id: 'evt-1',
    type: 'online_order_created',
    kind: 'online_order',
    title: 'New order',
    message: 'Order created',
    occurredAt: '2026-07-01T12:00:00.000Z',
    recordId: 'order-1',
    eventId: null,
    tabTarget: 'online-orders',
    severity: 'info',
    playSound: true,
    showDesktop: true,
    ...overrides,
  };
}

describe('mapFeedEventToRowHighlightKind', () => {
  it('maps feed event types to highlight kinds', () => {
    expect(mapFeedEventToRowHighlightKind('online_order_created')).toBe('new');
    expect(mapFeedEventToRowHighlightKind('online_order_paid')).toBe('paid');
    expect(mapFeedEventToRowHighlightKind('online_order_status_changed')).toBe('status');
    expect(mapFeedEventToRowHighlightKind('ambassador_sale_created')).toBe('new');
    expect(mapFeedEventToRowHighlightKind('ambassador_application_status_changed')).toBe('status');
  });
});

describe('buildRowHighlightFromFeedEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('assigns TTL by kind', () => {
    const created = buildRowHighlightFromFeedEvent(feedEvent({ type: 'online_order_created' }));
    expect(created?.kind).toBe('new');
    expect(created?.expiresAt).toBe(1_700_000_000_000 + ROW_HIGHLIGHT_TTL_MS.new);

    const paid = buildRowHighlightFromFeedEvent(
      feedEvent({ type: 'online_order_paid', recordId: 'order-2' }),
    );
    expect(paid?.expiresAt).toBe(1_700_000_000_000 + ROW_HIGHLIGHT_TTL_MS.paid);
  });

  it('derives application status tint from structured event id, not message text', () => {
    expect(
      applicationStatusTintFromFeedEvent(
        feedEvent({
          type: 'ambassador_application_status_changed',
          kind: 'ambassador_application',
          id: 'application:app-1:status:approved',
          message: 'Texte traduit quelconque',
        }),
      ),
    ).toBe('approved');
    expect(
      applicationStatusTintFromFeedEvent(
        feedEvent({
          type: 'ambassador_application_status_changed',
          kind: 'ambassador_application',
          id: 'application:app-2:status:rejected',
          message: 'Application approved',
        }),
      ),
    ).toBe('rejected');
    expect(
      applicationStatusTintFromFeedEvent(
        feedEvent({
          type: 'ambassador_application_status_changed',
          kind: 'ambassador_application',
          id: 'evt-1',
          message: 'Application approved',
        }),
      ),
    ).toBe('other');
  });
});

describe('rowHighlightKey', () => {
  it('namespaces highlights by entity scope', () => {
    expect(rowHighlightKey('online_order', 'abc')).toBe('online_order:abc');
    expect(rowHighlightKey('ambassador_sale', 'abc')).toBe('ambassador_sale:abc');
    expect(rowHighlightKey('ambassador_application', 'abc')).toBe('ambassador_application:abc');
  });

  it('builds storage keys from feed events', () => {
    expect(
      rowHighlightStorageKeyFromFeedEvent(
        feedEvent({ kind: 'online_order', recordId: 'o1' }),
      ),
    ).toBe('online_order:o1');
    expect(
      rowHighlightStorageKeyFromFeedEvent(
        feedEvent({ kind: 'ambassador_order', recordId: 's1', type: 'ambassador_sale_created' }),
      ),
    ).toBe('ambassador_sale:s1');
  });
});

describe('mergeRowHighlightsFromFeedEvents', () => {
  it('stores highlights under scoped keys', () => {
    const sharedId = 'shared-id';
    const next = mergeRowHighlightsFromFeedEvents(new Map(), [
      feedEvent({ recordId: sharedId, kind: 'online_order' }),
      feedEvent({
        recordId: sharedId,
        type: 'ambassador_sale_created',
        kind: 'ambassador_order',
        tabTarget: 'ambassador-sales',
      }),
    ]);
    expect(next.size).toBe(2);
    expect(next.get(rowHighlightKey('online_order', sharedId))?.kind).toBe('new');
    expect(next.get(rowHighlightKey('ambassador_sale', sharedId))?.kind).toBe('new');
  });
});

describe('lookupRowHighlight', () => {
  it('reads highlights only for the requested scope', () => {
    const map = new Map([
      [rowHighlightKey('online_order', 'x'), { kind: 'paid' as const, expiresAt: Date.now() + 4000 }],
      [rowHighlightKey('ambassador_sale', 'x'), { kind: 'new' as const, expiresAt: Date.now() + 5000 }],
    ]);
    expect(lookupRowHighlight(map, 'online_order', 'x')?.kind).toBe('paid');
    expect(lookupRowHighlight(map, 'ambassador_sale', 'x')?.kind).toBe('new');
    expect(lookupRowHighlight(map, 'ambassador_application', 'x')).toBeUndefined();
  });
});

describe('isRowHighlightActive', () => {
  it('returns false when expired', () => {
    expect(
      isRowHighlightActive({ kind: 'new', expiresAt: 100 }, 200),
    ).toBe(false);
  });
});

describe('pruneExpiredRowHighlights', () => {
  it('removes expired entries', () => {
    const map = new Map([
      ['a', { kind: 'new' as const, expiresAt: 100 }],
      ['b', { kind: 'paid' as const, expiresAt: 300 }],
    ]);
    const pruned = pruneExpiredRowHighlights(map, 200);
    expect(pruned.size).toBe(1);
    expect(pruned.has('b')).toBe(true);
  });
});

describe('visual class helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns highlight classes for active entries', () => {
    const entry = { kind: 'new' as const, expiresAt: Date.now() + 5000 };
    expect(getRowHighlightClass(entry, { reducedMotion: true })).toContain('border-l-primary/60');
    expect(getRowHighlightClass(entry, { reducedMotion: true })).not.toContain('animate-admin-row-enter');
  });

  it('pulses status dot only for paid/status kinds', () => {
    const paid = { kind: 'paid' as const, expiresAt: Date.now() + 4000 };
    const status = { kind: 'status' as const, expiresAt: Date.now() + 4000 };
    const fresh = { kind: 'new' as const, expiresAt: Date.now() + 5000 };
    expect(shouldPulseStatusDot(paid)).toBe(true);
    expect(shouldPulseStatusDot(status)).toBe(true);
    expect(shouldPulseStatusDot(fresh)).toBe(false);
    expect(getStatusPulseClass(paid)).toContain('animate-admin-status-pulse-emerald');
    expect(getStatusPulseClass(fresh)).toBe('');
  });
});

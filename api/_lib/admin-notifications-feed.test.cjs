'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const {
  buildAdminNotificationsFeed,
  buildOnlineOrderEvents,
  buildAmbassadorSaleEvents,
  buildAmbassadorReassignEvents,
  buildApplicationEvents,
  computeFeedPage,
  simulateFeedPagination,
  parseFeedCursor,
  encodeFeedCursor,
  sanitizeText,
  parseSince,
  FEED_PAGE_SIZE,
} = require('./admin-notifications-feed.cjs');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('admin-notifications-feed', () => {
  it('parseSince accepts valid ISO timestamps', () => {
    const iso = '2026-07-01T12:00:00.000Z';
    assert.equal(parseSince(iso), iso);
    assert.equal(parseSince('invalid'), null);
  });

  it('sanitizeText strips email-like patterns', () => {
    const out = sanitizeText('Contact user@example.com or 12345678');
    assert.ok(!out.includes('user@example.com'));
    assert.ok(!out.includes('12345678'));
  });

  it('buildOnlineOrderEvents emits created when created_at in window', () => {
    const since = '2026-07-01T10:00:00.000Z';
    const events = buildOnlineOrderEvents(
      {
        id: 'o1',
        event_id: 'e1',
        created_at: '2026-07-01T11:00:00.000Z',
        updated_at: '2026-07-01T11:00:00.000Z',
        order_number: 807105,
        payment_status: 'PENDING_PAYMENT',
        status: 'PENDING_ONLINE',
        total_with_fees: 120,
        order_passes: [{ quantity: 2 }],
      },
      since,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].id, 'order:o1:created');
    assert.equal(events[0].type, 'online_order_created');
    assert.equal(events[0].kind, 'online_order');
    assert.match(events[0].message, /#807105/);
    assert.match(events[0].message, /2 passes/);
    assert.ok(!events[0].message.includes('@'));
  });

  it('buildOnlineOrderEvents emits paid when updated in window', () => {
    const since = '2026-07-01T10:00:00.000Z';
    const events = buildOnlineOrderEvents(
      {
        id: 'o2',
        event_id: 'e1',
        created_at: '2026-07-01T08:00:00.000Z',
        updated_at: '2026-07-01T11:00:00.000Z',
        payment_status_set_at: '2026-07-01T11:00:00.000Z',
        order_number: 100,
        payment_status: 'PAID',
        status: 'PAID',
        order_passes: [{ quantity: 1 }],
      },
      since,
    );
    const paid = events.find((e) => e.type === 'online_order_paid');
    assert.ok(paid);
    assert.equal(paid.id, 'order:o2:paid');
    assert.match(paid.message, /marked paid/i);
  });

  it('buildOnlineOrderEvents does not duplicate created and paid for immediately-paid order', () => {
    const since = '2026-07-01T10:00:00.000Z';
    const events = buildOnlineOrderEvents(
      {
        id: 'o-paid-new',
        event_id: 'e1',
        created_at: '2026-07-01T11:00:00.000Z',
        updated_at: '2026-07-01T11:00:00.000Z',
        payment_status_set_at: '2026-07-01T11:00:00.000Z',
        order_number: 200,
        payment_status: 'PAID',
        status: 'PAID',
        order_passes: [{ quantity: 1 }],
      },
      since,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'online_order_created');
    assert.ok(!events.some((e) => e.type === 'online_order_paid'));
  });

  it('buildAmbassadorSaleEvents uses stable status dedupe id', () => {
    const since = '2026-07-01T10:00:00.000Z';
    const events = buildAmbassadorSaleEvents(
      {
        id: 'a1',
        event_id: 'e1',
        created_at: '2026-07-01T08:00:00.000Z',
        updated_at: '2026-07-01T12:00:00.000Z',
        status: 'PAID',
        order_number: 55,
        order_passes: [{ quantity: 1 }],
      },
      since,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].id, 'order:a1:status:PAID');
    assert.equal(events[0].playSound, true);
  });

  it('buildAmbassadorSaleEvents ignores non-meaningful status updates', () => {
    const since = '2026-07-01T10:00:00.000Z';
    const events = buildAmbassadorSaleEvents(
      {
        id: 'a2',
        event_id: 'e1',
        created_at: '2026-07-01T08:00:00.000Z',
        updated_at: '2026-07-01T12:00:00.000Z',
        status: 'PENDING',
        order_number: 56,
        order_passes: [{ quantity: 1 }],
      },
      since,
    );
    assert.equal(events.length, 0);
  });

  it('buildAmbassadorReassignEvents emits reassigned feed event without sound', () => {
    const since = '2026-07-01T10:00:00.000Z';
    const events = buildAmbassadorReassignEvents(
      {
        id: 'log1',
        order_id: 'o1',
        action: 'admin_reassigned',
        created_at: '2026-07-01T12:00:00.000Z',
        details: {
          new_ambassador_id: 'amb-new',
          order_number: 999,
          event_id: 'e1',
        },
      },
      since,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'ambassador_sale_reassigned');
    assert.equal(events[0].playSound, false);
    assert.equal(events[0].showDesktop, false);
    assert.equal(events[0].recordId, 'o1');
  });

  it('buildApplicationEvents emits created and status with stable ids', () => {
    const since = '2026-07-01T10:00:00.000Z';
    const created = buildApplicationEvents(
      {
        id: 'app1',
        created_at: '2026-07-01T11:00:00.000Z',
        updated_at: '2026-07-01T11:00:00.000Z',
        status: 'pending',
      },
      since,
    );
    assert.equal(created[0].id, 'application:app1:created');
    assert.equal(created[0].tabTarget, 'applications');

    const reviewed = buildApplicationEvents(
      {
        id: 'app2',
        created_at: '2026-07-01T08:00:00.000Z',
        updated_at: '2026-07-01T12:00:00.000Z',
        status: 'approved',
      },
      since,
    );
    assert.equal(reviewed[0].id, 'application:app2:status:approved');
    assert.equal(reviewed[0].playSound, false);
  });

  it('buildApplicationEvents does not emit reviewed for new pending application', () => {
    const since = '2026-07-01T10:00:00.000Z';
    const events = buildApplicationEvents(
      {
        id: 'app-new',
        created_at: '2026-07-01T11:00:00.000Z',
        updated_at: '2026-07-01T11:00:00.000Z',
        status: 'pending',
      },
      since,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'ambassador_application_created');
  });

  it('parseFeedCursor accepts ISO and compound cursors', () => {
    const iso = '2026-07-01T12:00:00.000Z';
    const plain = parseFeedCursor(iso);
    assert.equal(plain.occurredAt, iso);
    assert.equal(plain.afterId, null);

    const compound = parseFeedCursor(`${iso}#order:o50:created`);
    assert.equal(compound.occurredAt, iso);
    assert.equal(compound.afterId, 'order:o50:created');
    assert.equal(encodeFeedCursor(iso, 'order:o50:created'), `${iso}#order:o50:created`);
  });

  it('computeFeedPage sets hasMore and compound nextCursor when page is limited', () => {
    const serverTime = '2026-07-01T13:00:00.000Z';
    const events = [];
    for (let i = 0; i < FEED_PAGE_SIZE + 10; i++) {
      events.push({
        id: `order:o${i}:created`,
        type: 'online_order_created',
        kind: 'online_order',
        eventId: 'e1',
        recordId: `o${i}`,
        occurredAt: `2026-07-01T12:${String(i % 60).padStart(2, '0')}:00.000Z`,
        title: 'New online order',
        message: `Order #${i}`,
        severity: 'info',
        tabTarget: 'online-orders',
        playSound: true,
        showDesktop: true,
      });
    }

    const page1 = computeFeedPage(events, serverTime);
    assert.equal(page1.events.length, FEED_PAGE_SIZE);
    assert.equal(page1.hasMore, true);
    const last = page1.events[page1.events.length - 1];
    assert.equal(page1.nextCursor, encodeFeedCursor(last.occurredAt, last.id));
    assert.notEqual(page1.nextCursor, serverTime);

    const delivered = simulateFeedPagination(events, '2026-07-01T11:00:00.000Z', serverTime);
    assert.equal(delivered.length, events.length);
    assert.equal(new Set(delivered.map((e) => e.id)).size, events.length);
  });

  it('pagination returns every event exactly once when occurredAt is identical', () => {
    const serverTime = '2026-07-01T13:00:00.000Z';
    const sameTs = '2026-07-01T12:00:00.000Z';
    const events = [];
    const total = FEED_PAGE_SIZE + 15;

    for (let i = 0; i < total; i++) {
      const id = `order:o${String(i).padStart(3, '0')}:created`;
      events.push({
        id,
        type: 'online_order_created',
        kind: 'online_order',
        eventId: 'e1',
        recordId: `o${i}`,
        occurredAt: sameTs,
        title: 'New online order',
        message: `Order #${i}`,
        severity: 'info',
        tabTarget: 'online-orders',
        playSound: true,
        showDesktop: true,
      });
    }

    const page1 = computeFeedPage(events, serverTime);
    assert.equal(page1.events.length, FEED_PAGE_SIZE);
    assert.equal(page1.hasMore, true);
    assert.match(page1.nextCursor, /#order:o/);

    const delivered = simulateFeedPagination(events, '2026-07-01T11:00:00.000Z', serverTime);
    assert.equal(delivered.length, total);
    assert.equal(new Set(delivered.map((e) => e.id)).size, total);
  });

  it('timestamp-only cursor would repeat page without compound tie-breaker', () => {
    const serverTime = '2026-07-01T13:00:00.000Z';
    const sameTs = '2026-07-01T12:00:00.000Z';
    const events = [];
    for (let i = 0; i < FEED_PAGE_SIZE + 5; i++) {
      events.push({
        id: `order:o${String(i).padStart(3, '0')}:created`,
        type: 'online_order_created',
        kind: 'online_order',
        eventId: 'e1',
        recordId: `o${i}`,
        occurredAt: sameTs,
        title: 'New online order',
        message: `Order #${i}`,
        severity: 'info',
        tabTarget: 'online-orders',
        playSound: true,
        showDesktop: true,
      });
    }

    const page1 = computeFeedPage(events, serverTime);
    const unsafeCursor = page1.events[page1.events.length - 1].occurredAt;
    const page2Unsafe = computeFeedPage(events, serverTime, {
      cursorOccurredAt: unsafeCursor,
      cursorAfterId: null,
    });
    const overlap = page2Unsafe.events.filter((e) => page1.events.some((p) => p.id === e.id));
    assert.ok(overlap.length > 0, 'timestamp-only cursor repeats events on page 2');

    const page2Safe = computeFeedPage(events, serverTime, {
      cursorOccurredAt: page1.events[page1.events.length - 1].occurredAt,
      cursorAfterId: page1.events[page1.events.length - 1].id,
    });
    const overlapSafe = page2Safe.events.filter((e) => page1.events.some((p) => p.id === e.id));
    assert.equal(overlapSafe.length, 0);
    assert.equal(page1.events.length + page2Safe.events.length, events.length);
  });

  it('computeFeedPage hasMore when source truncated even if page not full', () => {
    const serverTime = '2026-07-01T13:00:00.000Z';
    const events = [
      {
        id: 'order:o1:created',
        type: 'online_order_created',
        kind: 'online_order',
        eventId: 'e1',
        recordId: 'o1',
        occurredAt: '2026-07-01T12:00:00.000Z',
        title: 'New online order',
        message: 'Order #1',
        severity: 'info',
        tabTarget: 'online-orders',
        playSound: true,
        showDesktop: true,
      },
    ];
    const page = computeFeedPage(events, serverTime, { sourceTruncated: true });
    assert.equal(page.hasMore, true);
    assert.match(page.nextCursor, /#order:o1:created/);
  });

  it('buildAdminNotificationsFeed respects permissions', async () => {
    const since = new Date(Date.now() - 60_000).toISOString();
    const db = {
      from(table) {
        const chain = {
          select() {
            return chain;
          },
          eq() {
            return chain;
          },
          neq() {
            return chain;
          },
          in() {
            return chain;
          },
          or() {
            return chain;
          },
          order() {
            return chain;
          },
          limit() {
            return chain;
          },
          then(resolve, reject) {
            if (table === 'orders') {
              return Promise.resolve({
                data: [
                  {
                    id: 'o-secret',
                    event_id: 'e1',
                    source: 'platform_online',
                    payment_method: 'online',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    order_number: 1,
                    payment_status: 'PENDING_PAYMENT',
                    status: 'PENDING_ONLINE',
                    user_email: 'secret@example.com',
                    user_phone: '12345678',
                    order_passes: [],
                  },
                ],
                error: null,
              }).then(resolve, reject);
            }
            if (table === 'ambassador_applications') {
              return Promise.resolve({
                data: [
                  {
                    id: 'app1',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    status: 'pending',
                    email: 'a@b.com',
                    phone_number: '98765432',
                  },
                ],
                error: null,
              }).then(resolve, reject);
            }
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          },
        };
        return chain;
      },
    };

    const none = await buildAdminNotificationsFeed(db, {
      since,
      eventId: null,
      permissions: ['dashboard:view'],
    });
    assert.equal(none.events.length, 0);

    const ordersOnly = await buildAdminNotificationsFeed(db, {
      since,
      eventId: null,
      permissions: ['orders:manage'],
    });
    assert.ok(ordersOnly.events.some((e) => e.type === 'online_order_created'));
    assert.ok(!ordersOnly.events.some((e) => e.type.startsWith('ambassador_application')));

    const appsOnly = await buildAdminNotificationsFeed(db, {
      since,
      eventId: null,
      permissions: ['applications:manage'],
    });
    assert.ok(appsOnly.events.some((e) => e.type === 'ambassador_application_created'));
    assert.equal(appsOnly.events.length, 1);
  });

  it('since cursor excludes old events', () => {
    const since = '2026-07-01T12:00:00.000Z';
    const events = buildOnlineOrderEvents(
      {
        id: 'old',
        event_id: 'e1',
        created_at: '2026-07-01T08:00:00.000Z',
        updated_at: '2026-07-01T08:00:00.000Z',
        payment_status: 'PENDING_PAYMENT',
        status: 'PENDING_ONLINE',
        order_passes: [],
      },
      since,
    );
    assert.equal(events.length, 0);
  });

  it('route is registered in admin-data-routes with dashboard auth', () => {
    const src = read('api/_lib/admin-data-routes.js');
    const block = src.slice(
      src.indexOf("'/api/admin/notifications/feed'"),
      src.indexOf("'/api/admin/ambassadors'"),
    );
    assert.match(block, /PERM\.DASHBOARD_BOOTSTRAP/);
    assert.match(block, /buildAdminNotificationsFeed/);
  });

  it('vercel.json rewrites /api/admin/notifications/feed to misc.js', () => {
    const vercel = read('vercel.json');
    assert.match(vercel, /"source":\s*"\/api\/admin\/notifications\/feed"/);
    const idx = vercel.indexOf('"/api/admin/notifications/feed"');
    const slice = vercel.slice(idx, idx + 200);
    assert.match(slice, /"destination":\s*"\/api\/misc\.js"/);
  });

  it('misc.js bundles admin-notifications-feed for Vercel', () => {
    const misc = read('api/misc.js');
    assert.match(misc, /admin-notifications-feed\.cjs/);
  });
});

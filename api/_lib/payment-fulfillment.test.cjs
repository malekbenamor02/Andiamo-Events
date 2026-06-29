'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

const {
  ORDER_PASSES_COLUMNS,
  FORBIDDEN_ORDER_PASSES_SELECT_COLUMNS,
  expectedTicketCount,
  ticketsNeededPerPass,
  buildTicketInsertPlan,
  insertTicketsUnderLock,
  fulfillPaidOrderTicketsAndEmail,
  buildPaymentConfirmJson,
} = require('./paid-order-fulfillment.cjs');

const { buildTicketInsertPlan: planFromModule } = require('./fulfillment-ticket-plan.cjs');
const {
  validateClicToPayPaymentForOrder,
  expectedOrderAmountMillimes,
} = require('./clictopay-payment-verify.cjs');
const { safeInsertEmailDeliveryLog } = require('./safe-email-delivery-log.cjs');

function mockDeps(overrides = {}) {
  return {
    buildTicketQrApiUrl: (token) => `https://qr.example/${token}`,
    prepareTicketsByPassTypeForEmail: async (map) => ({
      ticketsByPassType: map,
      qrAttachments: [],
    }),
    mergeEmailAttachments: (a, b) => [...(a || []), ...(b ? [b] : [])],
    sendTransactionalEmail: async () => {},
    canSendTransactionalEmail: () => true,
    computeOnlinePaymentFees: (sub) => ({ totalWithFees: sub * 1.05 }),
    inferFeeFromInclusiveTotal: (t) => t * 0.05,
    buildOnlineTicketEmailHtml: () => '<p>tickets</p>',
    tryBuildPremiumTicketsPdfAttachment: null,
    safeInsertEmailDeliveryLog,
    getEmailTransporter: () => ({}),
    ...overrides,
  };
}

describe('payment fulfillment static guards', () => {
  it('ORDER_PASSES_COLUMNS must not include order_pass_id', () => {
    for (const col of FORBIDDEN_ORDER_PASSES_SELECT_COLUMNS) {
      assert.doesNotMatch(ORDER_PASSES_COLUMNS, new RegExp(`\\b${col}\\b`));
    }
  });

  it('clictopay confirm module must not select order_pass_id from order_passes', () => {
    const src = read('api/_lib/clictopay-confirm-payment.cjs');
    assert.doesNotMatch(src, /\.from\(['"]order_passes['"]\)[\s\S]{0,80}order_pass_id/);
    assert.match(src, /verifyClicToPayForOrder/);
    assert.match(src, /validateClicToPayPaymentForOrder/);
    assert.doesNotMatch(src, /enforceRateLimits/);
  });

  it('payment confirm rate limits live in entrypoint only (no double-count)', () => {
    const entry = read('api/clictopay-confirm-payment.js');
    assert.match(entry, /enforceRateLimits/);
    assert.match(entry, /validatedOrderId/);
  });

  it('ORDER_CONFIRM_SELECT uses total_price (not total_amount — column does not exist on orders)', () => {
    const src = read('api/_lib/clictopay-confirm-payment.cjs');
    assert.match(src, /total_price/);
    assert.doesNotMatch(src, /ORDER_CONFIRM_SELECT[\s\S]*total_amount/);
  });

  it('migration defines advisory lock RPC and pass_sequence unique index', () => {
    const sql = read('supabase/migrations/20260627140000_order_fulfillment_concurrency.sql');
    assert.match(sql, /pg_advisory_xact_lock/);
    assert.match(sql, /insert_fulfillment_tickets_locked/);
    assert.match(sql, /idx_tickets_order_pass_pass_sequence/);
  });
});

describe('buildTicketInsertPlan concurrency slots', () => {
  const pass = { id: 'pass-a', quantity: 2, pass_type: 'Standard', price: 10 };

  it('assigns deterministic pass_sequence 0..quantity-1', () => {
    const plan = buildTicketInsertPlan([pass], []);
    assert.deepEqual(
      plan.map((p) => p.pass_sequence),
      [0, 1]
    );
  });

  it('second plan is empty when slots are filled', () => {
    const existing = [
      { order_pass_id: 'pass-a', pass_sequence: 0 },
      { order_pass_id: 'pass-a', pass_sequence: 1 },
    ];
    assert.equal(buildTicketInsertPlan([pass], existing).length, 0);
  });

  it('fills only missing sequence when one ticket exists', () => {
    const existing = [{ order_pass_id: 'pass-a', pass_sequence: 0 }];
    const plan = buildTicketInsertPlan([pass], existing);
    assert.deepEqual(plan, [{ pass, pass_sequence: 1 }]);
  });
});

describe('insertTicketsUnderLock concurrent behavior', () => {
  it('second concurrent batch skips duplicates via RPC ON CONFLICT', async () => {
    const store = new Map();
    const db = {
      rpc(name, { p_order_id, p_rows }) {
        assert.equal(name, 'insert_fulfillment_tickets_locked');
        let inserted = 0;
        let skipped = 0;
        for (const row of p_rows) {
          const key = `${row.order_pass_id}:${row.pass_sequence}`;
          if (store.has(key)) {
            skipped += 1;
          } else {
            store.set(key, row);
            inserted += 1;
          }
        }
        return Promise.resolve({ data: { ok: true, inserted, skipped }, error: null });
      },
      from() {
        throw new Error('direct insert should not run when RPC succeeds');
      },
    };
    const pass = { id: 'pass-a' };
    const row = {
      pass,
      pass_sequence: 0,
      secure_token: 'tok-1',
      qr_code_url: 'https://qr/1',
      generated_at: new Date().toISOString(),
    };
    const result = { warnings: [] };
    const first = await insertTicketsUnderLock(db, 'order-1', [row], result);
    const second = await insertTicketsUnderLock(db, 'order-1', [row], result);
    assert.equal(first.inserted, 1);
    assert.equal(second.inserted, 0);
    assert.equal(second.skipped, 1);
    assert.equal(store.size, 1);
  });
});

describe('validateClicToPayPaymentForOrder', () => {
  const order = {
    id: '11111111-1111-4111-8111-111111111111',
    order_number: 998935,
    total_with_fees: 1.05,
    payment_gateway_reference: 'gw-123',
  };
  const passes = [{ price: 1, quantity: 1 }];

  it('rejects unpaid gateway status', () => {
    const v = validateClicToPayPaymentForOrder(order, { orderStatus: 1, errorCode: 0 }, passes);
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'gateway_not_paid');
  });

  it('accepts paid status with matching amount and currency', () => {
    const millimes = expectedOrderAmountMillimes(order, passes);
    const v = validateClicToPayPaymentForOrder(
      order,
      {
        orderStatus: 2,
        errorCode: 0,
        orderNumber: '998935',
        amount: millimes,
        currency: 'TND',
      },
      passes
    );
    assert.equal(v.ok, true);
  });

  it('uses total_price when total_with_fees is absent', () => {
    const legacyOrder = { order_number: 100, total_price: 2.1, payment_gateway_reference: 'gw' };
    const millimes = expectedOrderAmountMillimes(legacyOrder, []);
    assert.equal(millimes, 2100);
  });

  it('rejects amount mismatch', () => {
    const v = validateClicToPayPaymentForOrder(
      order,
      { orderStatus: 2, errorCode: 0, orderNumber: '998935', amount: 999999, currency: 'TND' },
      passes
    );
    assert.equal(v.reason, 'amount_mismatch');
  });
});

describe('fulfillPaidOrderTicketsAndEmail integration mocks', () => {
  const orderId = 'order-uuid';
  const pass = {
    id: 'pass-a',
    order_id: orderId,
    quantity: 1,
    pass_type: 'Standard',
    price: 1,
    pass_id: 'event-pass',
  };

  function buildDb(state) {
    const resolveTable = (table) => {
      if (table === 'orders') return { data: state.order, error: null };
      if (table === 'order_passes') return { data: state.orderPasses, error: null };
      if (table === 'tickets') return { data: [...state.tickets], error: null };
      if (table === 'sms_logs') return { data: state.smsLogs || [], error: null };
      return { data: null, error: null };
    };

    const makeBuilder = (table) => {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        in() {
          return Promise.resolve({ data: null, error: null });
        },
        limit() {
          return builder;
        },
        single() {
          return Promise.resolve(resolveTable(table));
        },
        insert() {
          return Promise.resolve({ data: null, error: null });
        },
        update() {
          const upd = {
            in() {
              return Promise.resolve({ data: null, error: null });
            },
          };
          return upd;
        },
        then(resolve, reject) {
          return Promise.resolve(resolveTable(table)).then(resolve, reject);
        },
      };
      return builder;
    };

    return {
      from(table) {
        return makeBuilder(table);
      },
      rpc(name, args) {
        if (name !== 'insert_fulfillment_tickets_locked') {
          return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
        }
        const created = [];
        for (const row of args.p_rows) {
          const key = `${row.order_pass_id}:${row.pass_sequence}`;
          if (state.ticketKeys.has(key)) continue;
          state.ticketKeys.add(key);
          const ticket = {
            id: `ticket-${state.ticketKeys.size}`,
            order_id: orderId,
            order_pass_id: row.order_pass_id,
            pass_sequence: row.pass_sequence,
            secure_token: row.secure_token,
            qr_code_url: row.qr_code_url,
            status: 'GENERATED',
            email_delivery_status: null,
            generated_at: row.generated_at,
          };
          state.tickets.push(ticket);
          created.push(ticket);
        }
        return Promise.resolve({
          data: { ok: true, inserted: created.length, skipped: args.p_rows.length - created.length },
          error: null,
        });
      },
    };
  }

  it('refuses to generate tickets for unpaid order', async () => {
    const state = {
      order: { id: orderId, status: 'PENDING_ONLINE', user_email: 'a@b.com' },
      orderPasses: [pass],
      tickets: [],
      ticketKeys: new Set(),
    };
    const result = await fulfillPaidOrderTicketsAndEmail(buildDb(state), mockDeps(), {
      orderId,
    });
    assert.match(result.error, /not PAID/);
    assert.equal(result.ticketsCreatedCount, 0);
  });

  it('generates tickets for PAID order with zero tickets', async () => {
    const state = {
      order: {
        id: orderId,
        status: 'PAID',
        user_email: 'a@b.com',
        user_name: 'Test',
        order_number: 1,
        payment_method: 'online',
        total_with_fees: 1.05,
        events: { name: 'E', date: null, venue: null },
      },
      orderPasses: [pass],
      tickets: [],
      ticketKeys: new Set(),
      smsLogs: [],
    };
    let emailSent = false;
    const deps = mockDeps({
      sendTransactionalEmail: async () => {
        emailSent = true;
      },
    });
    const result = await fulfillPaidOrderTicketsAndEmail(buildDb(state), deps, { orderId });
    assert.equal(result.ticketsCreatedCount, 1);
    assert.equal(result.ticketsTotalCount, 1);
    assert.equal(emailSent, true);
    assert.equal(result.emailSent, true);
  });

  it('second run does not duplicate tickets or resend email', async () => {
    const state = {
      order: {
        id: orderId,
        status: 'PAID',
        user_email: 'a@b.com',
        user_name: 'Test',
        order_number: 1,
        payment_method: 'online',
        total_with_fees: 1.05,
        events: { name: 'E', date: null, venue: null },
      },
      orderPasses: [pass],
      tickets: [
        {
          id: 'ticket-1',
          order_id: orderId,
          order_pass_id: pass.id,
          pass_sequence: 0,
          secure_token: 'existing',
          qr_code_url: 'https://qr/x',
          status: 'DELIVERED',
          email_delivery_status: 'sent',
        },
      ],
      ticketKeys: new Set([`${pass.id}:0`]),
      smsLogs: [{ id: 'sms-1', status: 'sent' }],
    };
    let emailCalls = 0;
    const deps = mockDeps({
      sendTransactionalEmail: async () => {
        emailCalls += 1;
      },
    });
    const result = await fulfillPaidOrderTicketsAndEmail(buildDb(state), deps, { orderId });
    assert.equal(result.ticketsCreatedCount, 0);
    assert.equal(result.ticketsTotalCount, 1);
    assert.equal(emailCalls, 0);
    assert.equal(result.emailAttempted, false);
    assert.equal(result.smsAttempted, false);
  });

  it('dry-run creates zero tickets and sends zero notifications', async () => {
    const state = {
      order: {
        id: orderId,
        status: 'PAID',
        user_email: 'a@b.com',
        user_phone: '+21612345678',
        user_name: 'Test',
        order_number: 1,
        payment_method: 'online',
        total_with_fees: 1.05,
        events: { name: 'E', date: null, venue: null },
      },
      orderPasses: [pass],
      tickets: [],
      ticketKeys: new Set(),
    };
    let emailCalls = 0;
    const prevSmsKey = process.env.WINSMS_API_KEY;
    process.env.WINSMS_API_KEY = 'test-key';
    const deps = mockDeps({
      sendTransactionalEmail: async () => {
        emailCalls += 1;
      },
    });
    const result = await fulfillPaidOrderTicketsAndEmail(buildDb(state), deps, {
      orderId,
      dryRun: true,
    });
    process.env.WINSMS_API_KEY = prevSmsKey;
    assert.equal(state.tickets.length, 0);
    assert.equal(emailCalls, 0);
    assert.equal(result.emailSent, false);
    assert.equal(result.emailAttempted, false);
    assert.equal(result.smsSent, false);
    assert.equal(result.smsAttempted, false);
    assert.ok(result.dryRunActions.some((a) => a.includes('create ticket')));
    assert.ok(result.dryRunActions.some((a) => a.includes('send email')));
  });

  it('emailSent stays true when email_delivery_logs insert fails', async () => {
    const state = {
      order: {
        id: orderId,
        status: 'PAID',
        user_email: 'a@b.com',
        user_name: 'Test',
        order_number: 1,
        payment_method: 'online',
        total_with_fees: 1.05,
        events: { name: 'E', date: null, venue: null },
      },
      orderPasses: [pass],
      tickets: [],
      ticketKeys: new Set(),
      smsLogs: [],
    };
    const deps = mockDeps({
      safeInsertEmailDeliveryLog: async () => ({
        ok: false,
        warning: 'email_delivery_logs table not available',
      }),
    });
    const result = await fulfillPaidOrderTicketsAndEmail(buildDb(state), deps, { orderId });
    assert.equal(result.emailSent, true);
    assert.match(result.warnings.join('; '), /email_delivery_logs/);
  });
});

describe('ticketsNeededPerPass idempotency', () => {
  const passA = { id: 'pass-a', quantity: 2, pass_type: 'Standard', price: 10 };
  const passB = { id: 'pass-b', quantity: 1, pass_type: 'VIP', price: 20 };

  it('creates plan for all tickets when none exist', () => {
    const plan = ticketsNeededPerPass([passA, passB], []);
    assert.equal(expectedTicketCount([passA, passB]), 3);
    assert.equal(plan.reduce((n, r) => n + r.need, 0), 3);
  });

  it('creates no tickets when counts match', () => {
    const existing = [
      { order_pass_id: 'pass-a' },
      { order_pass_id: 'pass-a' },
      { order_pass_id: 'pass-b' },
    ];
    assert.equal(ticketsNeededPerPass([passA, passB], existing).length, 0);
  });
});

describe('buildPaymentConfirmJson', () => {
  it('marks fulfillmentComplete false when tickets missing', () => {
    const json = buildPaymentConfirmJson({
      success: false,
      orderId: 'x',
      ticketsGenerated: false,
      ticketsCreatedCount: 0,
      ticketsExistingCount: 0,
      ticketsTotalCount: 0,
      emailAttempted: false,
      emailSent: false,
      smsAttempted: false,
      smsSent: false,
      error: 'No passes found',
      warnings: [],
    });
    assert.equal(json.paymentConfirmed, true);
    assert.equal(json.fulfillmentComplete, false);
  });
});

describe('paid-order-fulfillment uuid generation', () => {
  const { randomUuid } = require('./random-uuid.cjs');

  it('randomUuid returns RFC 4122 v4 format', () => {
    const id = randomUuid();
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('paid-order-fulfillment.cjs does not import uuid package', () => {
    const src = read('api/_lib/paid-order-fulfillment.cjs');
    assert.doesNotMatch(src, /import\s*\(\s*['"]uuid['"]\s*\)/);
    assert.doesNotMatch(src, /require\s*\(\s*['"]uuid['"]\s*\)/);
    assert.match(src, /random-uuid\.cjs/);
  });

  it('paid-order-fulfillment.cjs loads without dynamic uuid import', () => {
    const mod = require('./paid-order-fulfillment.cjs');
    assert.equal(typeof mod.fulfillPaidOrderTicketsAndEmail, 'function');
    assert.equal(typeof mod.buildFulfillmentDepsFromMisc, 'function');
  });

  it('api serverless routes do not dynamic-import uuid', () => {
    for (const rel of [
      'api/clictopay-confirm-payment.js',
      'api/admin-approve-order.js',
      'api/admin-pos.js',
      'api/misc.js',
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /import\s*\(\s*['"]uuid['"]\s*\)/, rel);
      assert.doesNotMatch(src, /import\s*\(\s*['"]qrcode['"]\s*\)/, rel);
    }
  });
});

describe('buildFulfillmentDepsFromMisc lib path', () => {
  const nodePath = require('path');
  const {
    buildFulfillmentDepsFromMisc,
    assertFulfillmentLibDir,
  } = require('./paid-order-fulfillment.cjs');

  it('rejects api/ entrypoint directory with a clear error', () => {
    const apiDir = nodePath.join(root, 'api');
    assert.throws(
      () => buildFulfillmentDepsFromMisc(require, nodePath, apiDir),
      /Invalid fulfillment lib directory: expected api\/_lib/
    );
    const feePath = nodePath.join(apiDir, 'online-payment-fee.cjs').replace(/\\/g, '/');
    assert.doesNotMatch(feePath, /\/_lib\/online-payment-fee\.cjs$/);
  });

  it('loads online-payment-fee.cjs from api/_lib', () => {
    const apiLibDir = nodePath.join(root, 'api/_lib');
    assert.doesNotThrow(() => assertFulfillmentLibDir(apiLibDir, nodePath));
    const deps = buildFulfillmentDepsFromMisc(require, nodePath, apiLibDir);
    assert.equal(typeof deps.computeOnlinePaymentFees, 'function');
    assert.equal(typeof deps.buildOnlineTicketEmailHtml, 'function');
  });

  it('clictopay-confirm-payment.js passes fulfillmentLibDir under api/_lib', () => {
    const src = read('api/clictopay-confirm-payment.js');
    assert.match(src, /fulfillmentLibDir\s*=\s*nodePath\.join\(__dirname,\s*'_lib'\)/);
    assert.match(src, /fulfillmentLibDir,/);
    assert.doesNotMatch(src, /handleClicToPayConfirmPayment\([\s\S]*?\b__dirname,/);
  });

  it('misc.js passes fulfillmentLibDir under api/_lib to confirm handler', () => {
    const misc = read('api/misc.js');
    assert.match(misc, /fulfillmentLibDir:\s*nodePath\.join\(__dirname,\s*'_lib'\)/);
  });
});

describe('clictopay confirm public safety', () => {
  it('requires gateway verification before fulfillment', () => {
    const src = read('api/_lib/clictopay-confirm-payment.cjs');
    assert.match(src, /verifyClicToPayForOrder/);
    assert.match(src, /if \(!gateway\.ok\)/);
    assert.doesNotMatch(src, /fulfillPaidOrderTicketsAndEmail[\s\S]{0,120}order\.status !== 'PENDING_ONLINE'/);
  });

  it('misc.js delegates to hardened handler', () => {
    const misc = read('api/misc.js');
    assert.match(misc, /handleClicToPayConfirmPayment/);
  });

  it('vercel.json routes clictopay-confirm to dedicated function not misc.js', () => {
    const vercel = read('vercel.json');
    assert.match(
      vercel,
      /"source": "\/api\/clictopay-confirm-payment",\s*\n\s*"destination": "\/api\/clictopay-confirm-payment\.js"/
    );
    assert.doesNotMatch(
      vercel,
      /"source": "\/api\/clictopay-confirm-payment",\s*\n\s*"destination": "\/api\/misc\.js"/
    );
  });

  it('dedicated clictopay-confirm-payment.js exists', () => {
    const src = read('api/clictopay-confirm-payment.js');
    assert.match(src, /handleClicToPayConfirmPayment/);
  });
});

describe('insertTicketsUnderLock production fallback', () => {
  const {
    insertTicketsUnderLock,
    isProductionFulfillmentEnv,
    allowUnsafeFulfillmentFallback,
  } = require('./paid-order-fulfillment.cjs');

  const pass = { id: 'pass-a' };
  const row = {
    pass,
    pass_sequence: 0,
    secure_token: 'tok',
    qr_code_url: 'https://qr/x',
    generated_at: new Date().toISOString(),
  };

  it('fails in production when RPC is missing (no direct insert)', async () => {
    const prevNode = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_UNSAFE_FULFILLMENT_FALLBACK;
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_UNSAFE_FULFILLMENT_FALLBACK;

    const result = { warnings: [] };
    const db = {
      rpc() {
        return Promise.resolve({
          data: null,
          error: { message: 'Could not find the function insert_fulfillment_tickets_locked' },
        });
      },
      from() {
        throw new Error('direct insert must not run in production without unsafe flag');
      },
    };
    const out = await insertTicketsUnderLock(db, 'order-1', [row], result);
    assert.equal(out.failed, true);
    assert.equal(out.inserted, 0);
    assert.match(result.error, /RPC unavailable in production/i);

    process.env.NODE_ENV = prevNode;
    if (prevAllow !== undefined) process.env.ALLOW_UNSAFE_FULFILLMENT_FALLBACK = prevAllow;
  });

  it('allows direct insert fallback only with ALLOW_UNSAFE_FULFILLMENT_FALLBACK=1', async () => {
    const prevNode = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_UNSAFE_FULFILLMENT_FALLBACK = '1';

    const result = { warnings: [] };
    let directInsertCalled = false;
    const db = {
      rpc() {
        return Promise.resolve({
          data: null,
          error: { message: 'Could not find the function' },
        });
      },
      from(table) {
        if (table !== 'tickets') throw new Error('unexpected table');
        return {
          insert() {
            directInsertCalled = true;
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: {
                        id: 't1',
                        order_id: 'order-1',
                        order_pass_id: pass.id,
                        pass_sequence: 0,
                        secure_token: 'tok',
                        qr_code_url: 'https://qr/x',
                        status: 'GENERATED',
                      },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      },
    };
    const out = await insertTicketsUnderLock(db, 'order-1', [row], result);
    assert.equal(directInsertCalled, true);
    assert.equal(out.inserted, 1);

    process.env.NODE_ENV = prevNode;
    delete process.env.ALLOW_UNSAFE_FULFILLMENT_FALLBACK;
  });

  it('migration revokes PUBLIC, anon, authenticated grants', () => {
    const sql = read('supabase/migrations/20260627140000_order_fulfillment_concurrency.sql');
    assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC/);
    assert.match(sql, /FROM anon/);
    assert.match(sql, /FROM authenticated/);
    assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/);
    assert.match(sql, /SET search_path = public/);
    assert.match(sql, /op\.order_id = p_order_id/);
  });
});

describe('PaymentProcessing fulfillment visibility', () => {
  it('handles fulfillmentComplete and pending messages', () => {
    const src = read('src/pages/PaymentProcessing.tsx');
    assert.match(src, /fulfillmentComplete/);
    assert.match(src, /success_pending|fulfillmentPending/);
  });
});

assert.equal(planFromModule, buildTicketInsertPlan);

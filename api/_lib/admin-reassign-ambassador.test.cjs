'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  isAmbassadorCodOrder,
  isTransferableStatus,
  TRANSFERABLE_STATUSES,
  sanitizeNotifyError,
  mapAtomicReassignRpcResult,
  resolveNotificationStatus,
  mergeAuditLogNotificationDetails,
  applyNotificationResultsToAuditLog,
  resolveOverallNotificationStatus,
  ATOMIC_REASSIGN_RPC,
  reassignAmbassadorOrder,
} = require('./admin-reassign-ambassador.cjs');

function canShowChangeAmbassadorAction(order) {
  const paymentMethod = String(order.payment_method ?? '');
  const source = String(order.source ?? '');
  const status = String(order.status ?? '');
  const isCod =
    paymentMethod === 'ambassador_cash' &&
    (source === 'platform_cod' || source === 'ambassador_manual');
  return isCod && (status === 'PENDING_CASH' || status === 'PENDING_ADMIN_APPROVAL');
}

function formatAdminReassignedNotificationResult(details, language) {
  const en = language === 'en';
  if (!details) return '—';
  if (details.notify_ambassador === false || details.notification_status === 'skipped') {
    return en ? 'Notifications skipped' : 'Notifications ignorées';
  }
  if (details.notification_status === 'pending') {
    return en ? 'Notification pending' : 'Notification en attente';
  }
  const emailOk = details.email_sent === true;
  const smsOk = details.sms_sent === true;
  if (emailOk && smsOk) return en ? 'New ambassador notified by email and SMS' : 'x';
  if (emailOk && !smsOk) return en ? 'Email sent, SMS failed' : 'x';
  if (!emailOk && smsOk) return en ? 'SMS sent, email failed' : 'x';
  return en ? 'Notification failed' : 'x';
}

const BASE_ORDER = {
  id: 'o1',
  status: 'PENDING_CASH',
  source: 'platform_cod',
  payment_method: 'ambassador_cash',
  ambassador_id: 'a-old',
  city: 'Tunis',
  ville: null,
  event_id: 'e1',
  order_number: 42,
  updated_at: '2026-07-01T10:00:00.000Z',
};

const OLD_AMB = {
  id: 'a-old',
  full_name: 'Old Amb',
  status: 'approved',
  city: 'Tunis',
  ville: null,
  extra_villes: [],
};

const NEW_AMB = {
  id: 'a-new',
  full_name: 'New Amb',
  status: 'approved',
  city: 'Tunis',
  ville: null,
  extra_villes: [],
};

function loadReassignModuleWithMocks(options = {}) {
  const {
    rpcResult = null,
    rpcError = null,
    logUpdateError = null,
    notifyImpl = null,
    selectionSettings = { cities: [] },
  } = options;

  const reassignmentNotifyPath = require.resolve('./order-reassignment-notify.cjs');
  const settingsPath = require.resolve('./ambassador-selection-settings.cjs');
  const reassignPath = require.resolve('./admin-reassign-ambassador.cjs');
  delete require.cache[reassignPath];
  delete require.cache[reassignmentNotifyPath];

  const reassignmentNotifyModule = require(reassignmentNotifyPath);
  const settingsModule = require(settingsPath);
  settingsModule.fetchAmbassadorSelectionSettings = async () => selectionSettings;
  settingsModule.isAmbassadorCityWide = () => true;

  reassignmentNotifyModule.notifyReassignmentRecipients =
    notifyImpl ||
    (async (...args) => {
      loadReassignModuleWithMocks.lastNotifyCalls = loadReassignModuleWithMocks.lastNotifyCalls || [];
      loadReassignModuleWithMocks.lastNotifyCalls.push(args);
      return {
        ambassador: {
          emailSent: true,
          smsSent: true,
          emailError: null,
          smsError: null,
          skippedReason: null,
        },
        customer: {
          emailSent: true,
          smsSent: true,
          emailError: null,
          smsError: null,
          emailSkippedReason: null,
          smsSkippedReason: null,
          skippedReason: null,
        },
      };
    });

  return require(reassignPath);
}

function createMockDb(options = {}) {
  loadReassignModuleWithMocks.lastNotifyCalls = [];

  const {
    rpcResult = null,
    rpcError = null,
    logUpdateError = null,
  } = options;

  const state = {
    rpcCalls: [],
    logUpdates: [],
    get notifyCalls() {
      return loadReassignModuleWithMocks.lastNotifyCalls || [];
    },
  };

  loadReassignModuleWithMocks(options);

  const db = {
    state,
    from(table) {
      const chain = {
        table,
        _id: null,
        _logId: null,
        select() {
          return chain;
        },
        eq(col, val) {
          if (table === 'ambassadors' && col === 'id') chain._id = val;
          if (table === 'order_logs' && col === 'id') chain._logId = val;
          return chain;
        },
        in() {
          return chain;
        },
        maybeSingle: async () => {
          if (table === 'ambassadors') {
            if (chain._id === 'a-old') return { data: OLD_AMB, error: null };
            if (chain._id === 'a-new') return { data: NEW_AMB, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (table === 'orders') return { data: BASE_ORDER, error: null };
          return { data: null, error: null };
        },
      };

      if (table === 'order_logs') {
        chain.update = (payload) => {
          state.logUpdates.push({ id: chain._logId, payload });
          return {
            eq: async () => ({ error: logUpdateError }),
          };
        };
      }

      return chain;
    },
    rpc: async (name, params) => {
      state.rpcCalls.push({ name, params });
      if (typeof rpcResult === 'function') {
        return rpcResult(name, params, state);
      }
      return { data: rpcResult, error: rpcError };
    },
  };

  db.reassignAmbassadorOrder = loadReassignModuleWithMocks(options).reassignAmbassadorOrder;

  return db;
}

describe('admin-reassign-ambassador validation', () => {
  it('isAmbassadorCodOrder accepts platform_cod and ambassador_manual', () => {
    assert.equal(
      isAmbassadorCodOrder({ payment_method: 'ambassador_cash', source: 'platform_cod' }),
      true
    );
    assert.equal(
      isAmbassadorCodOrder({ payment_method: 'ambassador_cash', source: 'ambassador_manual' }),
      true
    );
    assert.equal(
      isAmbassadorCodOrder({ payment_method: 'online', source: 'platform_online' }),
      false
    );
    assert.equal(
      isAmbassadorCodOrder({ payment_method: 'pos', source: 'point_de_vente' }),
      false
    );
  });

  it('isTransferableStatus allows only PENDING_CASH and PENDING_ADMIN_APPROVAL', () => {
    for (const s of TRANSFERABLE_STATUSES) {
      assert.equal(isTransferableStatus(s), true);
    }
    for (const s of ['PAID', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED']) {
      assert.equal(isTransferableStatus(s), false);
    }
  });

  it('sanitizeNotifyError redacts emails', () => {
    const out = sanitizeNotifyError('Failed for user@example.com');
    assert.ok(!out.includes('user@example.com'));
  });
});

describe('mapAtomicReassignRpcResult', () => {
  it('maps conflict to 409', () => {
    assert.throws(
      () => mapAtomicReassignRpcResult({ ok: false, code: 'conflict', error: 'race' }, null),
      (err) => err.statusCode === 409
    );
  });

  it('maps rpc transport errors to 500', () => {
    assert.throws(
      () => mapAtomicReassignRpcResult(null, { message: 'audit insert failed' }),
      (err) => err.statusCode === 500
    );
  });
});

describe('orderActivityLogDisplay', () => {
  it('canShowChangeAmbassadorAction for transferable COD only', () => {
    assert.equal(
      canShowChangeAmbassadorAction({
        payment_method: 'ambassador_cash',
        source: 'platform_cod',
        status: 'PENDING_CASH',
      }),
      true
    );
    assert.equal(
      canShowChangeAmbassadorAction({
        payment_method: 'ambassador_cash',
        source: 'platform_cod',
        status: 'PAID',
      }),
      false
    );
  });

  it('formatAdminReassignedNotificationResult covers notify/skip/partial/pending', () => {
    assert.match(
      formatAdminReassignedNotificationResult(
        { notify_ambassador: true, email_sent: true, sms_sent: true },
        'en'
      ),
      /email and SMS/i
    );
    assert.match(
      formatAdminReassignedNotificationResult({ notify_ambassador: false }, 'en'),
      /skipped/i
    );
    assert.match(
      formatAdminReassignedNotificationResult({ notify_ambassador: true, notification_status: 'pending' }, 'en'),
      /pending/i
    );
    assert.match(
      formatAdminReassignedNotificationResult(
        { notify_ambassador: true, email_sent: true, sms_sent: false },
        'en'
      ),
      /SMS failed/i
    );
  });
});

describe('reassignAmbassadorOrder integration (mock db)', () => {
  it('rejects non-COD order', async () => {
    const db = {
      from(table) {
        assert.equal(table, 'orders');
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({
            data: {
              id: 'o1',
              status: 'PENDING_CASH',
              source: 'platform_online',
              payment_method: 'online',
              ambassador_id: 'a1',
              city: 'Tunis',
              ville: null,
            },
            error: null,
          }),
        };
      },
    };

    await assert.rejects(
      () =>
        reassignAmbassadorOrder(db, {
          orderId: 'o1',
          newAmbassadorId: 'a2',
          admin: { id: 'admin1' },
        }),
      (err) => err.statusCode === 400
    );
  });

  it('does not notify when atomic RPC fails (audit failure)', async () => {
    const db = createMockDb({
      rpcError: { message: 'insert into order_logs failed' },
    });

    await assert.rejects(
      () =>
        db.reassignAmbassadorOrder(db, {
          orderId: 'o1',
          newAmbassadorId: 'a-new',
          admin: { id: 'admin1', email: 'admin@example.com' },
        }),
      (err) => err.statusCode === 500
    );

    assert.equal(db.state.rpcCalls.length, 1);
    assert.equal(db.state.rpcCalls[0].name, ATOMIC_REASSIGN_RPC);
    assert.equal(db.state.notifyCalls.length, 0);
  });

  it('successful reassignment uses atomic RPC before notifications', async () => {
    const db = createMockDb({
      rpcResult: {
        ok: true,
        order: {
          id: 'o1',
          ambassador_id: 'a-new',
          status: 'PENDING_CASH',
          updated_at: '2026-07-02T12:00:00.000Z',
          event_id: 'e1',
          order_number: 42,
        },
        audit_log: {
          id: 'log-1',
          action: 'admin_reassigned',
          created_at: '2026-07-02T12:00:00.000Z',
          details: {
            old_ambassador_id: 'a-old',
            new_ambassador_id: 'a-new',
            notification_status: 'pending',
            notify_ambassador: true,
          },
        },
      },
    });

    const result = await db.reassignAmbassadorOrder(db, {
      orderId: 'o1',
      newAmbassadorId: 'a-new',
      reason: 'Coverage gap',
      notifyAmbassador: true,
      admin: { id: 'admin1', name: 'Admin One' },
    });

    assert.equal(result.success, true);
    assert.equal(result.order.ambassador_id, 'a-new');
    assert.equal(result.auditLog.action, 'admin_reassigned');
    assert.equal(result.auditLog.id, 'log-1');
    assert.equal(db.state.rpcCalls.length, 1);
    assert.equal(db.state.notifyCalls.length, 1);
    assert.equal(db.state.logUpdates.length, 1);
    assert.equal(db.state.logUpdates[0].payload.details.notification_status, 'sent');
  });

  it('notification failure does not rollback reassignment', async () => {
    const db = createMockDb({
      rpcResult: {
        ok: true,
        order: {
          id: 'o1',
          ambassador_id: 'a-new',
          status: 'PENDING_CASH',
          updated_at: '2026-07-02T12:00:00.000Z',
          event_id: 'e1',
          order_number: 42,
        },
        audit_log: {
          id: 'log-1',
          action: 'admin_reassigned',
          created_at: '2026-07-02T12:00:00.000Z',
          details: { notification_status: 'pending', notify_ambassador: true },
        },
      },
      notifyImpl: async () => {
        throw new Error('SMTP down');
      },
    });

    const result = await db.reassignAmbassadorOrder(db, {
      orderId: 'o1',
      newAmbassadorId: 'a-new',
      notifyAmbassador: true,
      admin: { id: 'admin1' },
    });

    assert.equal(result.success, true);
    assert.equal(result.order.ambassador_id, 'a-new');
    assert.equal(result.notifications.ambassador.emailSent, false);
    assert.equal(result.notifications.customer.emailSent, false);
    assert.equal(result.auditLog.details.notification_status, 'failed');
  });

  it('notification result update failure keeps core audit log', async () => {
    const db = createMockDb({
      rpcResult: {
        ok: true,
        order: {
          id: 'o1',
          ambassador_id: 'a-new',
          status: 'PENDING_ADMIN_APPROVAL',
          updated_at: '2026-07-02T12:00:00.000Z',
          event_id: 'e1',
          order_number: 42,
        },
        audit_log: {
          id: 'log-1',
          action: 'admin_reassigned',
          created_at: '2026-07-02T12:00:00.000Z',
          details: {
            old_ambassador_id: 'a-old',
            new_ambassador_id: 'a-new',
            notification_status: 'pending',
          },
        },
      },
      logUpdateError: { message: 'update failed' },
    });

    const result = await db.reassignAmbassadorOrder(db, {
      orderId: 'o1',
      newAmbassadorId: 'a-new',
      notifyAmbassador: true,
      admin: { id: 'admin1' },
    });

    assert.equal(result.success, true);
    assert.equal(result.auditLog.id, 'log-1');
    assert.equal(result.auditLog.details.old_ambassador_id, 'a-old');
    assert.equal(result.auditLog.details.notification_status, 'sent');
  });

  it('409 race condition from atomic RPC', async () => {
    const db = createMockDb({
      rpcResult: {
        ok: false,
        code: 'conflict',
        error: 'Order changed while reassignment was in progress. Refresh and try again.',
      },
    });

    await assert.rejects(
      () =>
        db.reassignAmbassadorOrder(db, {
          orderId: 'o1',
          newAmbassadorId: 'a-new',
          admin: { id: 'admin1' },
        }),
      (err) => err.statusCode === 409
    );
    assert.equal(db.state.notifyCalls.length, 0);
  });

  it('preserves order status from atomic RPC result', async () => {
    const db = createMockDb({
      rpcResult: {
        ok: true,
        order: {
          id: 'o1',
          ambassador_id: 'a-new',
          status: 'PENDING_ADMIN_APPROVAL',
          updated_at: '2026-07-02T12:00:00.000Z',
          event_id: 'e1',
          order_number: 42,
        },
        audit_log: {
          id: 'log-1',
          action: 'admin_reassigned',
          created_at: '2026-07-02T12:00:00.000Z',
          details: { notification_status: 'skipped', notify_ambassador: false },
        },
      },
    });

    const result = await db.reassignAmbassadorOrder(db, {
      orderId: 'o1',
      newAmbassadorId: 'a-new',
      notifyAmbassador: false,
      notifyCustomer: false,
      admin: { id: 'admin1' },
    });

    assert.equal(result.order.status, 'PENDING_ADMIN_APPROVAL');
    assert.equal(result.notifications.ambassador.skippedReason, 'notifications_disabled');
    assert.equal(result.notifications.customer.skippedReason, 'notifications_disabled');
    assert.equal(db.state.notifyCalls.length, 0);
  });
});

describe('notification detail helpers', () => {
  it('resolveOverallNotificationStatus', () => {
    assert.equal(
      resolveOverallNotificationStatus(false, false, { ambassador: {}, customer: {} }),
      'skipped'
    );
    assert.equal(
      resolveOverallNotificationStatus(
        true,
        true,
        {
          ambassador: { emailSent: true, smsSent: true },
          customer: { emailSent: true, smsSent: true },
        }
      ),
      'sent'
    );
    assert.equal(
      resolveOverallNotificationStatus(
        true,
        true,
        {
          ambassador: { emailSent: true, smsSent: false },
          customer: { emailSent: true, smsSent: true },
        }
      ),
      'partial_failed'
    );
  });

  it('mergeAuditLogNotificationDetails preserves core fields and customer results', () => {
    const merged = mergeAuditLogNotificationDetails(
      { old_ambassador_id: 'a-old', new_ambassador_id: 'a-new', reason: 'x' },
      {
        ambassador: { emailSent: true, smsSent: true, emailError: null, smsError: null },
        customer: { emailSent: false, smsSent: true, emailError: 'e', smsError: null },
      },
      true,
      true
    );
    assert.equal(merged.old_ambassador_id, 'a-old');
    assert.equal(merged.customer_sms_sent, true);
    assert.equal(merged.customer_email_error, 'e');
    assert.equal(merged.notification_status, 'partial_failed');
  });

  it('applyNotificationResultsToAuditLog is best-effort on update failure', async () => {
    const db = {
      from() {
        return {
          update() {
            return {
              eq: async () => ({ error: { message: 'fail' } }),
            };
          },
        };
      },
    };

    const merged = await applyNotificationResultsToAuditLog(
      db,
      'log-1',
      { old_ambassador_id: 'a-old' },
      {
        ambassador: { emailSent: true, smsSent: true, emailError: null, smsError: null },
        customer: { emailSent: true, smsSent: true, emailError: null, smsError: null },
      },
      true,
      true
    );
    assert.equal(merged.notification_status, 'sent');
    assert.equal(merged.old_ambassador_id, 'a-old');
  });
});

'use strict';

const { validateAmbassadorCashLocation } = require('./ambassador-extra-villes.cjs');
const {
  fetchAmbassadorSelectionSettings,
  isAmbassadorCityWide,
} = require('./ambassador-selection-settings.cjs');
const { notifyReassignmentRecipients } = require('./order-reassignment-notify.cjs');

const COD_SOURCES = ['platform_cod', 'ambassador_manual'];
const TRANSFERABLE_STATUSES = ['PENDING_CASH', 'PENDING_ADMIN_APPROVAL'];
const ACTIVE_AMBASSADOR_STATUSES = ['approved', 'ACTIVE'];
const ATOMIC_REASSIGN_RPC = 'admin_reassign_ambassador_order_atomic';

function isAmbassadorCodOrder(order) {
  if (!order) return false;
  return (
    order.payment_method === 'ambassador_cash' && COD_SOURCES.includes(String(order.source || ''))
  );
}

function isTransferableStatus(status) {
  return TRANSFERABLE_STATUSES.includes(status);
}

function sanitizeNotifyError(err) {
  if (!err) return null;
  const msg = String(err).slice(0, 200);
  return msg.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]');
}

function buildHttpError(statusCode, error, details) {
  const err = new Error(error);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
}

function resolveAdminIdentity(admin) {
  const adminName =
    admin?.name && String(admin.name).trim()
      ? String(admin.name).trim()
      : admin?.email
        ? String(admin.email).split('@')[0]
        : null;
  const adminEmail = admin?.email ? String(admin.email).trim() : null;
  return { adminName, adminEmail };
}

function isAtomicReassignRpcMissing(message) {
  return /admin_reassign_ambassador_order_atomic|function.*does not exist|Could not find the function/i.test(
    String(message || '')
  );
}

function mapAtomicReassignRpcResult(data, rpcError) {
  if (rpcError) {
    const msg = rpcError.message || String(rpcError);
    if (isAtomicReassignRpcMissing(msg)) {
      throw buildHttpError(
        500,
        'Ambassador reassignment RPC unavailable. Apply migration 20260702120000.'
      );
    }
    throw buildHttpError(500, 'Failed to reassign ambassador', msg);
  }

  if (!data || typeof data !== 'object') {
    throw buildHttpError(500, 'Failed to reassign ambassador', 'Invalid RPC response');
  }

  if (data.ok === true) {
    return data;
  }

  const code = data.code || 'invalid';
  const error = data.error || 'Reassignment failed';
  if (code === 'not_found') throw buildHttpError(404, error);
  if (code === 'conflict') throw buildHttpError(409, error);
  throw buildHttpError(400, error, code === 'invalid' ? error : undefined);
}

function channelOutcome(result) {
  if (result.emailSent && result.smsSent) return 'sent';
  if (result.emailSent || result.smsSent) return 'partial';
  if (result.skippedReason) return 'skipped';
  return 'failed';
}

function resolveOverallNotificationStatus(notifyAmbassador, notifyCustomer, notifications) {
  const targets = [];
  if (notifyAmbassador) targets.push(channelOutcome(notifications.ambassador));
  if (notifyCustomer) targets.push(channelOutcome(notifications.customer));
  if (targets.length === 0) return 'skipped';
  if (targets.every((t) => t === 'sent')) return 'sent';
  if (targets.every((t) => t === 'skipped')) return 'skipped';
  if (targets.some((t) => t === 'sent' || t === 'partial')) return 'partial_failed';
  return 'failed';
}

function mergeAuditLogNotificationDetails(coreDetails, notifications, notifyAmbassador, notifyCustomer) {
  const ambassador = notifications.ambassador || {};
  const customer = notifications.customer || {};

  return {
    ...coreDetails,
    notify_ambassador: notifyAmbassador === true,
    notify_customer: notifyCustomer === true,
    ambassador_email_sent: ambassador.emailSent === true,
    ambassador_sms_sent: ambassador.smsSent === true,
    ambassador_email_error: ambassador.emailError || null,
    ambassador_sms_error: ambassador.smsError || null,
    customer_email_sent: customer.emailSent === true,
    customer_sms_sent: customer.smsSent === true,
    customer_email_error: customer.emailError || null,
    customer_sms_error: customer.smsError || null,
    customer_email_skipped_reason: customer.emailSkippedReason || null,
    customer_sms_skipped_reason: customer.smsSkippedReason || null,
    // Backward-compatible ambassador fields used by existing UI/tests
    email_sent: ambassador.emailSent === true,
    sms_sent: ambassador.smsSent === true,
    email_error: ambassador.emailError || null,
    sms_error: ambassador.smsError || null,
    notification_status: resolveOverallNotificationStatus(
      notifyAmbassador === true,
      notifyCustomer === true,
      notifications
    ),
  };
}

async function applyNotificationResultsToAuditLog(
  db,
  logId,
  coreDetails,
  notifications,
  notifyAmbassador,
  notifyCustomer
) {
  const mergedDetails = mergeAuditLogNotificationDetails(
    coreDetails,
    notifications,
    notifyAmbassador,
    notifyCustomer
  );

  try {
    const { error } = await db.from('order_logs').update({ details: mergedDetails }).eq('id', logId);
    if (error) {
      console.warn('Failed to update admin_reassigned notification results (non-fatal):', error.message);
    }
  } catch (err) {
    console.warn('Failed to update admin_reassigned notification results (non-fatal):', err);
  }

  return mergedDetails;
}

async function loadAmbassador(db, ambassadorId) {
  const { data, error } = await db
    .from('ambassadors')
    .select('id, full_name, phone, email, city, ville, extra_villes, status')
    .eq('id', ambassadorId)
    .maybeSingle();
  if (error) throw buildHttpError(500, 'Failed to load ambassador', error.message);
  return data;
}

async function validateNewAmbassadorForOrder(db, order, newAmbassadorId, currentAmbassadorId) {
  if (!newAmbassadorId || typeof newAmbassadorId !== 'string') {
    throw buildHttpError(400, 'newAmbassadorId is required');
  }
  if (currentAmbassadorId && newAmbassadorId === currentAmbassadorId) {
    throw buildHttpError(400, 'Cannot reassign to the same ambassador');
  }

  const ambassador = await loadAmbassador(db, newAmbassadorId);
  if (!ambassador) {
    throw buildHttpError(400, 'Ambassador not found');
  }
  if (!ACTIVE_AMBASSADOR_STATUSES.includes(ambassador.status)) {
    throw buildHttpError(400, 'Ambassador cannot receive orders', 'Ambassador is not active or approved');
  }

  const selectionSettings = await fetchAmbassadorSelectionSettings(db);
  const cityWide = isAmbassadorCityWide(order.city, selectionSettings);
  const locationCheck = validateAmbassadorCashLocation({
    ambassador,
    customerCity: order.city,
    customerVille: order.ville,
    cityWide,
  });
  if (!locationCheck.ok) {
    throw buildHttpError(400, locationCheck.error, locationCheck.details);
  }

  return ambassador;
}

async function executeAtomicReassign(db, params) {
  const { data, error } = await db.rpc(ATOMIC_REASSIGN_RPC, params);
  return mapAtomicReassignRpcResult(data, error);
}

/**
 * Reassign ambassador ownership on an existing COD order.
 * Order update and core admin_reassigned audit log are atomic via Postgres RPC.
 */
async function reassignAmbassadorOrder(db, params) {
  const {
    orderId,
    newAmbassadorId,
    reason,
    notifyAmbassador = true,
    notifyCustomer = true,
    admin,
    getEmailTransporter,
  } = params;

  if (!orderId) throw buildHttpError(400, 'Order ID is required');
  if (!newAmbassadorId) throw buildHttpError(400, 'newAmbassadorId is required');

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, status, source, payment_method, ambassador_id, city, ville, event_id, order_number, updated_at')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw buildHttpError(404, 'Order not found');

  if (!isAmbassadorCodOrder(order)) {
    throw buildHttpError(400, 'Only ambassador cash orders can be reassigned');
  }
  if (!isTransferableStatus(order.status)) {
    throw buildHttpError(
      400,
      'Order cannot be reassigned in its current status',
      `Status ${order.status} is not transferable`
    );
  }
  if (!order.ambassador_id) {
    throw buildHttpError(400, 'Order has no ambassador assigned');
  }

  const oldAmbassadorId = order.ambassador_id;
  const oldAmbassador = await loadAmbassador(db, oldAmbassadorId);
  const newAmbassador = await validateNewAmbassadorForOrder(
    db,
    order,
    newAmbassadorId,
    oldAmbassadorId
  );

  const trimmedReason = reason && String(reason).trim() ? String(reason).trim().slice(0, 500) : null;
  const { adminName, adminEmail } = resolveAdminIdentity(admin);

  const atomicResult = await executeAtomicReassign(db, {
    p_order_id: orderId,
    p_expected_ambassador_id: oldAmbassadorId,
    p_new_ambassador_id: newAmbassadorId,
    p_admin_id: admin?.id || null,
    p_old_ambassador_name: oldAmbassador?.full_name || null,
    p_new_ambassador_name: newAmbassador.full_name || null,
    p_reason: trimmedReason,
    p_notify_ambassador: notifyAmbassador === true,
    p_admin_name: adminName,
    p_admin_email: adminEmail,
    p_notify_customer: notifyCustomer === true,
  });

  const updatedOrder = atomicResult.order;
  const auditLog = atomicResult.audit_log;
  const coreDetails = auditLog.details || {};

  let notifications = {
    ambassador: {
      emailSent: false,
      smsSent: false,
      emailError: null,
      smsError: null,
      skippedReason: notifyAmbassador ? null : 'notifications_disabled',
    },
    customer: {
      emailSent: false,
      smsSent: false,
      emailError: null,
      smsError: null,
      emailSkippedReason: notifyCustomer ? null : 'notifications_disabled',
      smsSkippedReason: notifyCustomer ? null : 'notifications_disabled',
      skippedReason: notifyCustomer ? null : 'notifications_disabled',
    },
  };

  if (notifyAmbassador || notifyCustomer) {
    try {
      notifications = await notifyReassignmentRecipients(db, orderId, {
        notifyAmbassador: notifyAmbassador === true,
        notifyCustomer: notifyCustomer === true,
        newAmbassador,
        getEmailTransporter,
      });
      notifications.ambassador = {
        ...notifications.ambassador,
        emailError: sanitizeNotifyError(notifications.ambassador.emailError),
        smsError: sanitizeNotifyError(notifications.ambassador.smsError),
      };
      notifications.customer = {
        ...notifications.customer,
        emailError: sanitizeNotifyError(notifications.customer.emailError),
        smsError: sanitizeNotifyError(notifications.customer.smsError),
      };
    } catch (notifyErr) {
      console.warn('Reassignment notification failed (non-fatal):', notifyErr);
      const errMsg = sanitizeNotifyError(notifyErr?.message || notifyErr);
      if (notifyAmbassador) {
        notifications.ambassador = {
          emailSent: false,
          smsSent: false,
          emailError: errMsg,
          smsError: errMsg,
          skippedReason: null,
        };
      }
      if (notifyCustomer) {
        notifications.customer = {
          emailSent: false,
          smsSent: false,
          emailError: errMsg,
          smsError: errMsg,
          emailSkippedReason: null,
          smsSkippedReason: null,
          skippedReason: null,
        };
      }
    }
  }

  const logDetails = await applyNotificationResultsToAuditLog(
    db,
    auditLog.id,
    coreDetails,
    notifications,
    notifyAmbassador === true,
    notifyCustomer === true
  );

  return {
    success: true,
    order: {
      id: updatedOrder.id,
      ambassador_id: updatedOrder.ambassador_id,
      status: updatedOrder.status,
      updated_at: updatedOrder.updated_at,
      event_id: updatedOrder.event_id,
      order_number: updatedOrder.order_number,
    },
    ambassador: {
      id: newAmbassador.id,
      full_name: newAmbassador.full_name,
    },
    previousAmbassador: {
      id: oldAmbassadorId,
      full_name: oldAmbassador?.full_name || null,
    },
    notifications,
    // Backward-compatible top-level ambassador notification fields
    emailSent: notifications.ambassador.emailSent,
    smsSent: notifications.ambassador.smsSent,
    emailError: notifications.ambassador.emailError,
    smsError: notifications.ambassador.smsError,
    skippedReason: notifications.ambassador.skippedReason,
    auditLog: {
      id: auditLog.id,
      action: auditLog.action,
      created_at: auditLog.created_at,
      details: logDetails,
    },
  };
}

module.exports = {
  COD_SOURCES,
  TRANSFERABLE_STATUSES,
  ATOMIC_REASSIGN_RPC,
  isAmbassadorCodOrder,
  isTransferableStatus,
  validateNewAmbassadorForOrder,
  reassignAmbassadorOrder,
  sanitizeNotifyError,
  mapAtomicReassignRpcResult,
  channelOutcome,
  resolveOverallNotificationStatus,
  mergeAuditLogNotificationDetails,
  applyNotificationResultsToAuditLog,
  executeAtomicReassign,
};

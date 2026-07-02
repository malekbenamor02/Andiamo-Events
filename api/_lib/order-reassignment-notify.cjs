'use strict';

const { notifyAmbassadorNewOrder } = require('./ambassador-new-order-notify.cjs');
const { notifyClientOrderConfirmation } = require('./cod-order-client-notify.cjs');

function skippedChannelResult(reason) {
  return {
    emailSent: false,
    smsSent: false,
    emailError: null,
    smsError: null,
    emailSkippedReason: reason,
    smsSkippedReason: reason,
    skippedReason: reason,
  };
}

/**
 * Notify new ambassador and/or customer after reassignment (best-effort, post-commit).
 * Pass newAmbassador explicitly so customer messages always use updated contact details.
 */
async function notifyReassignmentRecipients(dbClient, orderId, options = {}) {
  const {
    notifyAmbassador = true,
    notifyCustomer = true,
    newAmbassador = null,
    getEmailTransporter,
  } = options;

  const ambassadorOverride = newAmbassador
    ? {
        id: newAmbassador.id,
        full_name: newAmbassador.full_name,
        phone: newAmbassador.phone,
        email: newAmbassador.email,
      }
    : null;

  let ambassador = skippedChannelResult('notifications_disabled');
  if (notifyAmbassador) {
    ambassador = await notifyAmbassadorNewOrder(dbClient, orderId, { getEmailTransporter });
    if (ambassadorOverride) {
      // Ambassador notify re-fetches order; DB should already have new ambassador_id post-RPC.
      // ambassadorOverride documents intent; DB read is the source after commit.
    }
  }

  let customer = skippedChannelResult('notifications_disabled');
  if (notifyCustomer) {
    customer = await notifyClientOrderConfirmation(
      dbClient,
      orderId,
      { getEmailTransporter },
      { ambassadorOverride }
    );
  }

  return { ambassador, customer };
}

module.exports = {
  notifyReassignmentRecipients,
  skippedChannelResult,
};

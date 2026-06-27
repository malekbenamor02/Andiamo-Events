'use strict';

function isAcademyRegistrationPaymentComplete(status) {
  return status === 'paid_online' || status === 'approved';
}

function shouldSendOnlineConfirmedEmail(previousStatus) {
  return previousStatus === 'pending_payment' || previousStatus === 'pending_online';
}

/**
 * Admin resend template for a registration, or null if unsupported.
 * @param {{ status?: string, payment_method?: string, payment_gateway_reference?: string|null }} reg
 * @returns {'approved'|'online_confirmed'|null}
 */
function resolveAdminResendEmailTemplate(reg) {
  if (!reg || typeof reg !== 'object') return null;
  if (reg.status === 'approved') return 'approved';
  if (
    reg.status === 'paid_online' &&
    reg.payment_method === 'card' &&
    reg.payment_gateway_reference
  ) {
    return 'online_confirmed';
  }
  return null;
}

/**
 * When paid_online update returns no row, interpret current DB status for confirm response.
 * @returns {{ kind: 'idempotent'|'expired'|'unexpected', status?: string }}
 */
function interpretAcademyConfirmUpdateRace(currentStatus) {
  if (isAcademyRegistrationPaymentComplete(currentStatus)) {
    return { kind: 'idempotent', status: currentStatus };
  }
  if (currentStatus === 'cancelled') {
    return { kind: 'expired', status: currentStatus };
  }
  return { kind: 'unexpected', status: currentStatus };
}

module.exports = {
  isAcademyRegistrationPaymentComplete,
  shouldSendOnlineConfirmedEmail,
  resolveAdminResendEmailTemplate,
  interpretAcademyConfirmUpdateRace,
};

'use strict';

/**
 * True when ticket / transactional delivery can use Brevo REST API or SMTP fallback.
 * Matches sendTransactionalEmail in transactional-email.cjs (Brevo API first, then SMTP).
 */
function canSendTransactionalEmail() {
  const k = process.env.BREVO_API_KEY && String(process.env.BREVO_API_KEY).trim();
  if (k) return true;
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_HOST);
}

module.exports = { canSendTransactionalEmail };

'use strict';

/**
 * Best-effort email_delivery_logs insert — missing table must not fail fulfillment.
 * @returns {{ ok: boolean, warning?: string }}
 */
async function safeInsertEmailDeliveryLog(dbClient, payload) {
  if (!dbClient || !payload) return { ok: false, warning: 'no db client or payload' };
  try {
    const { error } = await dbClient.from('email_delivery_logs').insert(payload);
    if (error) {
      const msg = error.message || String(error);
      if (/does not exist|relation.*email_delivery_logs/i.test(msg)) {
        console.warn('[safeInsertEmailDeliveryLog] table missing — email send still counts as success');
        return { ok: false, warning: 'email_delivery_logs table not available' };
      }
      console.warn('[safeInsertEmailDeliveryLog] insert failed:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      return { ok: false, warning: msg };
    }
    return { ok: true };
  } catch (err) {
    const msg = err?.message || String(err);
    if (/does not exist|relation.*email_delivery_logs/i.test(msg)) {
      console.warn('[safeInsertEmailDeliveryLog] table missing — email send still counts as success');
      return { ok: false, warning: 'email_delivery_logs table not available' };
    }
    console.warn('[safeInsertEmailDeliveryLog] unexpected error:', msg);
    return { ok: false, warning: msg };
  }
}

module.exports = { safeInsertEmailDeliveryLog };

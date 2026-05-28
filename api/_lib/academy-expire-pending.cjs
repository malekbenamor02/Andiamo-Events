'use strict';

const { logAcademyEvent } = require('./academy-db.cjs');

const DEFAULT_ACADEMY_PENDING_EXPIRE_MINUTES = 17;
const MAX_ACADEMY_PENDING_EXPIRE_MINUTES = 24 * 60;

/** Only online (card) checkout — never RIB or D17 / proof_received */
const AUTO_EXPIRE_PAYMENT_METHOD = 'card';
const AUTO_EXPIRE_STATUSES = ['pending_payment', 'pending_online'];

function getAcademyPendingExpireMinutes() {
  const raw = process.env.ACADEMY_PENDING_EXPIRE_MINUTES ?? process.env.PENDING_ONLINE_EXPIRE_MINUTES;
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_ACADEMY_PENDING_EXPIRE_MINUTES;
  }
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_ACADEMY_PENDING_EXPIRE_MINUTES;
  return Math.min(MAX_ACADEMY_PENDING_EXPIRE_MINUTES, n);
}

async function decrementPromoUsed(db, promoId) {
  if (!promoId) return false;
  const { data: row } = await db
    .from('academy_promo_codes')
    .select('used_count')
    .eq('id', promoId)
    .maybeSingle();
  if (!row || row.used_count <= 0) return false;
  const { error } = await db
    .from('academy_promo_codes')
    .update({ used_count: row.used_count - 1, updated_at: new Date().toISOString() })
    .eq('id', promoId)
    .eq('used_count', row.used_count);
  return !error;
}

/**
 * Cancel online (card) registrations stuck in pending_payment / pending_online past the timeout.
 * Does not affect RIB, D17, or proof_received — manual payments stay until admin review.
 */
async function cancelExpiredAcademyPendingRegistrations(db, options = {}) {
  const expireMinutes = options.expireMinutes ?? getAcademyPendingExpireMinutes();
  const cutoffIso = new Date(Date.now() - expireMinutes * 60 * 1000).toISOString();
  const reason =
    options.reason ||
    `Auto-cancelled after ${expireMinutes} minutes without online card payment confirmation`;

  const { data: pending, error } = await db
    .from('academy_registrations')
    .select('id, status, payment_method, promo_code_id, registration_number')
    .eq('payment_method', AUTO_EXPIRE_PAYMENT_METHOD)
    .in('status', AUTO_EXPIRE_STATUSES)
    .lte('created_at', cutoffIso);

  if (error) throw error;

  const cancelledIds = [];

  for (const reg of pending || []) {
    if (reg.payment_method !== AUTO_EXPIRE_PAYMENT_METHOD) continue;

    try {
      const { data: updated, error: upErr } = await db
        .from('academy_registrations')
        .update({
          status: 'cancelled',
          rejection_reason: reason.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reg.id)
        .eq('payment_method', AUTO_EXPIRE_PAYMENT_METHOD)
        .in('status', AUTO_EXPIRE_STATUSES)
        .select('id')
        .maybeSingle();

      if (upErr || !updated) continue;

      if (reg.promo_code_id) {
        try {
          await decrementPromoUsed(db, reg.promo_code_id);
        } catch (promoErr) {
          console.warn('academy expire: promo decrement failed', reg.id, promoErr);
        }
      }

      await logAcademyEvent(db, {
        registrationId: reg.id,
        eventType: 'auto_cancelled',
        oldStatus: reg.status,
        newStatus: 'cancelled',
        notes: reason,
      });

      cancelledIds.push(reg.id);
    } catch (e) {
      console.warn('academy expire: failed for registration', reg.id, e);
    }
  }

  return {
    expireMinutes,
    cutoffIso,
    found_count: (pending || []).length,
    cancelled_count: cancelledIds.length,
    cancelled_ids: cancelledIds,
  };
}

module.exports = {
  getAcademyPendingExpireMinutes,
  cancelExpiredAcademyPendingRegistrations,
};

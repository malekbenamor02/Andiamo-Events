'use strict';

/**
 * Frozen influencer attribution on academy_registrations + query helpers for sales reports.
 */

/** Snapshot influencer_id from promo at registration time (nullable). */
function influencerIdAtRegistrationFromPromo(promo) {
  if (!promo?.influencer_id) return null;
  return promo.influencer_id;
}

/**
 * Build Supabase PostgREST .or() filter for influencer-attributed registrations.
 * - Rows frozen to this influencer
 * - Legacy rows (null frozen id) still owned via current promo assignment
 */
function buildInfluencerAttributionOrFilter(influencerId, promoIds) {
  const ids = (promoIds || []).filter(Boolean);
  if (!ids.length) {
    return `influencer_id_at_registration.eq.${influencerId}`;
  }
  const inList = ids.map((id) => `"${id}"`).join(',');
  return `influencer_id_at_registration.eq.${influencerId},and(influencer_id_at_registration.is.null,promo_code_id.in.(${inList}))`;
}

/**
 * Returns true if registration row is attributed to influencer under frozen + legacy rules.
 */
function registrationAttributedToInfluencer(row, influencerId, promoIdSet) {
  if (!row) return false;
  if (row.influencer_id_at_registration) {
    return row.influencer_id_at_registration === influencerId;
  }
  if (!row.promo_code_id) return false;
  return promoIdSet.has(row.promo_code_id);
}

module.exports = {
  influencerIdAtRegistrationFromPromo,
  buildInfluencerAttributionOrFilter,
  registrationAttributedToInfluencer,
};

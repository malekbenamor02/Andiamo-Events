'use strict';

/**
 * Server-side admin_logs writes for academy influencer actions (service role).
 */

async function writeAcademyInfluencerAudit(db, { admin, action, influencerId, influencerEmail, details }) {
  if (!db || !admin?.id || !action) return;
  const payload = {
    admin_id: admin.id,
    admin_name: admin.name || admin.full_name || 'Unknown',
    admin_email: admin.email || null,
    action: String(action).trim(),
    target_type: 'academy_influencer',
    target_id: influencerId || null,
    details: {
      influencer_email: influencerEmail || null,
      ...(details && typeof details === 'object' ? details : {}),
    },
  };
  const { error } = await db.from('admin_logs').insert(payload);
  if (error) {
    console.error('writeAcademyInfluencerAudit:', error.message || error);
  }
}

function diffPromoAssignment(previousIds, nextIds) {
  const prev = new Set(previousIds || []);
  const next = new Set(nextIds || []);
  const assigned = [...next].filter((id) => !prev.has(id));
  const unassigned = [...prev].filter((id) => !next.has(id));
  return { assigned, unassigned };
}

module.exports = {
  writeAcademyInfluencerAudit,
  diffPromoAssignment,
};

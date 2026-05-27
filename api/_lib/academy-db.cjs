'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const ACA_REG_NUM_MIN = 1;
const ACA_REG_NUM_MAX = 99999;
const ACA_REG_NUM_ATTEMPTS = 30;

function formatAcademyRegistrationNumber(n) {
  return `ACA-${String(n).padStart(5, '0')}`;
}

function randomAcademyRegistrationSuffix() {
  return crypto.randomInt(ACA_REG_NUM_MIN, ACA_REG_NUM_MAX + 1);
}

function getServiceDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getAcademySettings(db) {
  const { data, error } = await db.from('academy_settings').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return (
    data || {
      max_approved_total: 36,
      page_enabled: true,
      disabled_message_en: null,
      disabled_message_fr: null,
    }
  );
}

async function countApprovedRegistrations(db) {
  const { count, error } = await db
    .from('academy_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved');
  if (error) throw error;
  return count || 0;
}

async function canApproveMore(db) {
  const settings = await getAcademySettings(db);
  const approved = await countApprovedRegistrations(db);
  return approved < settings.max_approved_total;
}

async function isAcademyRegistrationNumberTaken(db, registrationNumber) {
  const { data, error } = await db
    .from('academy_registrations')
    .select('id')
    .eq('registration_number', registrationNumber)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** ACA-00042 — prefix + random 5-digit suffix, unique in academy_registrations */
async function generateRegistrationNumber(db) {
  for (let attempt = 0; attempt < ACA_REG_NUM_ATTEMPTS; attempt++) {
    const registrationNumber = formatAcademyRegistrationNumber(randomAcademyRegistrationSuffix());
    if (!(await isAcademyRegistrationNumberTaken(db, registrationNumber))) {
      return registrationNumber;
    }
  }
  throw new Error('Could not allocate unique academy registration number');
}

async function logAcademyEvent(db, { registrationId, eventType, oldStatus, newStatus, adminId, ip, notes, metadata }) {
  await db.from('academy_registration_logs').insert({
    registration_id: registrationId,
    event_type: eventType,
    old_status: oldStatus || null,
    new_status: newStatus || null,
    admin_id: adminId || null,
    ip_address: ip || null,
    notes: notes || null,
    metadata: metadata || null,
  });
}

const { normalizeAcademyPromoCode } = require('./academy-registration-validation.cjs');

async function resolvePromoCode(db, code) {
  if (!code) return { promo: null, discountAmount: 0 };
  const normalized = normalizeAcademyPromoCode(code);
  if (normalized === null) return { promo: null, discountAmount: 0, error: 'invalid' };
  if (!normalized) return { promo: null, discountAmount: 0 };
  const { data: promo, error } = await db
    .from('academy_promo_codes')
    .select('*')
    .eq('active', true)
    .is('revoked_at', null)
    .eq('code', normalized)
    .maybeSingle();
  if (error) throw error;
  if (!promo) return { promo: null, discountAmount: 0, error: 'invalid' };
  if (promo.used_count >= promo.max_uses) return { promo: null, discountAmount: 0, error: 'exhausted' };

  return { promo, discountAmount: 0, error: null };
}

function computePromoDiscount(promo, baseAmount) {
  if (!promo) return 0;
  const base = Number(baseAmount);
  if (promo.discount_type === 'percent') {
    return Math.min(base, (base * Number(promo.discount_value)) / 100);
  }
  return Math.min(base, Number(promo.discount_value));
}

async function incrementPromoUsed(db, promoId) {
  const { data: row } = await db.from('academy_promo_codes').select('used_count, max_uses').eq('id', promoId).single();
  if (!row || row.used_count >= row.max_uses) return false;
  const { error } = await db
    .from('academy_promo_codes')
    .update({ used_count: row.used_count + 1, updated_at: new Date().toISOString() })
    .eq('id', promoId)
    .eq('used_count', row.used_count);
  return !error;
}

module.exports = {
  getServiceDb,
  getAcademySettings,
  countApprovedRegistrations,
  canApproveMore,
  generateRegistrationNumber,
  logAcademyEvent,
  resolvePromoCode,
  computePromoDiscount,
  incrementPromoUsed,
};

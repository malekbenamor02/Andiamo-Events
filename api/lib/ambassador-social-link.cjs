'use strict';

/**
 * Phone variants for matching ambassador_applications.phone_number to ambassadors.phone.
 * Handles +216 / 216 / 00216 / spaces vs 8-digit local storage.
 */
function digitsLast8(phone) {
  const d = String(phone ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-8) : null;
}

function phoneVariantsForLookup(phone) {
  if (phone == null) return [];
  const s = String(phone).trim();
  if (!s) return [];
  const variants = new Set([s]);
  const digits = s.replace(/\D/g, '');
  if (digits) variants.add(digits);
  if (digits.length >= 8) {
    const last8 = digits.slice(-8);
    variants.add(last8);
    variants.add(`216${last8}`);
    variants.add(`+216${last8}`);
    variants.add(`00216${last8}`);
  }
  return Array.from(variants);
}

/**
 * Load social_link from ambassador_applications without .maybeSingle() (multiple rows per phone break it).
 * Tries each phone variant; picks newest row that has a non-empty social_link.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string|null|undefined} ambassadorPhone
 * @returns {Promise<string|null>}
 */
async function fetchAmbassadorSocialLinkFromApplications(db, ambassadorPhone) {
  const variants = phoneVariantsForLookup(ambassadorPhone);
  for (const pn of variants) {
    const { data: rows, error } = await db
      .from('ambassador_applications')
      .select('social_link, created_at')
      .eq('phone_number', pn)
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) continue;
    const hit = (rows || []).find((r) => r.social_link && String(r.social_link).trim());
    if (hit) return String(hit.social_link).trim();
  }

  // Fallback: DB phone may include spaces (e.g. "27 169 458") — match by last 8 digits
  const last8 = digitsLast8(ambassadorPhone);
  if (last8) {
    const { data: looseRows, error: looseErr } = await db
      .from('ambassador_applications')
      .select('social_link, phone_number, created_at')
      .ilike('phone_number', `%${last8}%`)
      .order('created_at', { ascending: false })
      .limit(40);
    if (!looseErr && looseRows?.length) {
      const hit = looseRows.find(
        (r) =>
          r.social_link &&
          String(r.social_link).trim() &&
          digitsLast8(r.phone_number) === last8
      );
      if (hit) return String(hit.social_link).trim();
    }
  }

  return null;
}

module.exports = {
  phoneVariantsForLookup,
  fetchAmbassadorSocialLinkFromApplications,
};

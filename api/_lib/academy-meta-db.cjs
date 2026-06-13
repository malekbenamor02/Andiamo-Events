'use strict';

const META_MIGRATION_HINT =
  'Run supabase/migrations/20260613120000_academy_meta_attribution.sql on your Supabase project (Dashboard → SQL Editor).';

function isMissingMetaColumnError(error) {
  if (!error) return false;
  if (error.code === 'PGRST204') return true;
  const msg = String(error.message || '');
  return msg.includes('meta_attribution') || msg.includes('meta_purchase_sent_at');
}

function stripMetaFields(row) {
  if (!row || typeof row !== 'object') return row;
  const next = { ...row };
  delete next.meta_attribution;
  delete next.meta_purchase_sent_at;
  return next;
}

function logMissingMetaColumnsWarning(context) {
  console.warn(`[Academy Meta] ${context}: ${META_MIGRATION_HINT}`);
}

/**
 * Insert registration; retry without Meta columns if migration not applied yet.
 */
async function insertAcademyRegistration(db, insertRow) {
  let result = await db.from('academy_registrations').insert(insertRow).select('*').single();
  if (isMissingMetaColumnError(result.error) && insertRow.meta_attribution != null) {
    logMissingMetaColumnsWarning('insert');
    result = await db
      .from('academy_registrations')
      .insert(stripMetaFields(insertRow))
      .select('*')
      .single();
  }
  return result;
}

/**
 * Update registration; retry without Meta columns if migration not applied yet.
 */
async function updateAcademyRegistration(db, id, patch) {
  let result = await db.from('academy_registrations').update(patch).eq('id', id);
  if (
    isMissingMetaColumnError(result.error) &&
    (patch.meta_attribution != null || patch.meta_purchase_sent_at != null)
  ) {
    logMissingMetaColumnsWarning('update');
    result = await db.from('academy_registrations').update(stripMetaFields(patch)).eq('id', id);
  }
  return result;
}

module.exports = {
  META_MIGRATION_HINT,
  isMissingMetaColumnError,
  stripMetaFields,
  insertAcademyRegistration,
  updateAcademyRegistration,
  logMissingMetaColumnsWarning,
};

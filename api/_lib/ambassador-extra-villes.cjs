'use strict';

/**
 * Normalize admin-selected extra villes: dedupe, drop primary, keep allowed only.
 */
function normalizeExtraVilles({ primaryVille, extraVilles, allowedVilles }) {
  const allowed = new Set(allowedVilles || []);
  const primary = String(primaryVille ?? '').trim();
  const seen = new Set();
  const result = [];

  for (const raw of extraVilles || []) {
    const v = String(raw).trim();
    if (!v || v === primary || !allowed.has(v) || seen.has(v)) continue;
    seen.add(v);
    result.push(v);
  }

  return result.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Quote a PostgREST filter value when it contains spaces or special characters.
 */
function formatPostgrestFilterValue(value) {
  const s = String(value).trim();
  if (/^[A-Za-z0-9_-]+$/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Build OR filter: primary ville match OR extra_villes array contains ville.
 */
function buildVilleCoverageOrFilter(ville) {
  const v = formatPostgrestFilterValue(ville);
  return `ville.eq.${v},extra_villes.cs.{${v}}`;
}

/**
 * Apply checkout ville coverage filter to a Supabase query builder.
 */
function applyVilleCoverageFilter(query, ville) {
  const normalized = ville && String(ville).trim() !== '' ? String(ville).trim() : null;
  if (!normalized) return query;
  return query.or(buildVilleCoverageOrFilter(normalized));
}

/**
 * Whether an ambassador serves the customer's neighborhood (primary ville or extra_villes).
 */
function ambassadorCoversVille(ambassador, customerVille) {
  const v = customerVille && String(customerVille).trim() !== '' ? String(customerVille).trim() : null;
  if (!v) return true;
  const primary = String(ambassador?.ville ?? '').trim();
  if (primary === v) return true;
  const extras = ambassador?.extra_villes || [];
  return extras.some((entry) => String(entry).trim() === v);
}

/**
 * Validate ambassador location for ambassador_cash orders.
 */
function validateAmbassadorCashLocation({
  ambassador,
  customerCity,
  customerVille,
  cityWide,
}) {
  const normalizedCustomerCity = String(customerCity ?? '').trim();
  const normalizedAmbassadorCity = String(ambassador?.city ?? '').trim();

  if (!normalizedCustomerCity || normalizedAmbassadorCity !== normalizedCustomerCity) {
    return {
      ok: false,
      error: 'Ambassador location mismatch',
      details: 'The selected ambassador does not serve this city.',
    };
  }

  if (cityWide) {
    return { ok: true };
  }

  const normalizedCustomerVille =
    customerVille && String(customerVille).trim() !== '' ? String(customerVille).trim() : null;
  if (normalizedCustomerVille && !ambassadorCoversVille(ambassador, normalizedCustomerVille)) {
    return {
      ok: false,
      error: 'Ambassador location mismatch',
      details: 'The selected ambassador does not serve this neighborhood.',
    };
  }

  return { ok: true };
}

module.exports = {
  normalizeExtraVilles,
  formatPostgrestFilterValue,
  buildVilleCoverageOrFilter,
  applyVilleCoverageFilter,
  ambassadorCoversVille,
  validateAmbassadorCashLocation,
};

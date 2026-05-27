/**
 * Presale discount policy + unit price math (uniform or per-pass).
 * Server authority for order pricing; mirrored in src/lib/presale/presaleDiscount.ts for display.
 */

export function roundPresaleMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {unknown} type
 * @param {unknown} value
 * @returns {{ discount_type: 'percent'|'fixed', discount_value: number } | null}
 */
export function normalizePresaleDiscountRule(type, value) {
  if (type !== 'percent' && type !== 'fixed') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return { discount_type: type, discount_value: n };
}

/**
 * @param {number} listPrice
 * @param {{ discount_type: string, discount_value: number } | null | undefined} rule
 * @returns {number}
 */
export function applyDiscountToUnitPrice(listPrice, rule) {
  const base = parseFloat(String(listPrice ?? 0));
  if (!Number.isFinite(base) || base <= 0 || !rule) return roundPresaleMoney(Math.max(0, base));
  if (rule.discount_type === 'percent') {
    const pct = Math.min(100, Math.max(0, parseFloat(String(rule.discount_value))));
    return roundPresaleMoney(Math.max(0, base * (1 - pct / 100)));
  }
  const fixedPerUnit = Math.max(0, parseFloat(String(rule.discount_value)));
  return roundPresaleMoney(Math.max(0, base - fixedPerUnit));
}

/**
 * @param {Record<string, unknown>} codeRow
 * @param {Array<Record<string, unknown>>} passDiscountRows
 * @returns {{
 *   mode: 'uniform'|'per_pass',
 *   uniform?: { discount_type: 'percent'|'fixed', discount_value: number },
 *   pass_rules?: Record<string, { discount_type: 'percent'|'fixed', discount_value: number }>,
 * }}
 */
export function buildPresaleDiscountPolicy(codeRow, passDiscountRows = []) {
  const mode = codeRow?.discount_mode === 'per_pass' ? 'per_pass' : 'uniform';
  if (mode === 'per_pass') {
    /** @type {Record<string, { discount_type: 'percent'|'fixed', discount_value: number }>} */
    const pass_rules = Object.create(null);
    for (const row of passDiscountRows || []) {
      const passId = row?.event_pass_id != null ? String(row.event_pass_id) : '';
      if (!passId) continue;
      const rule = normalizePresaleDiscountRule(row.discount_type, row.discount_value);
      if (rule && rule.discount_value > 0) {
        pass_rules[passId] = rule;
      }
    }
    return { mode: 'per_pass', pass_rules };
  }
  const uniform = normalizePresaleDiscountRule(codeRow?.discount_type, codeRow?.discount_value);
  return {
    mode: 'uniform',
    uniform: uniform || { discount_type: 'percent', discount_value: 0 },
  };
}

/**
 * @param {{ mode: string, uniform?: { discount_type: string, discount_value: number }, pass_rules?: Record<string, { discount_type: string, discount_value: number }> }} policy
 * @param {string} passId
 * @returns {{ discount_type: 'percent'|'fixed', discount_value: number } | null}
 */
export function getPassDiscountRuleFromPolicy(policy, passId) {
  if (!policy) return null;
  if (policy.mode === 'per_pass') {
    const rule = policy.pass_rules?.[passId];
    return rule && rule.discount_value > 0 ? rule : null;
  }
  if (policy.uniform && policy.uniform.discount_value > 0) {
    return policy.uniform;
  }
  return policy.uniform?.discount_value === 0 ? null : policy.uniform || null;
}

/**
 * @param {Array<{ passId?: string, price: number, quantity: number, passName?: string, eventPass: { id?: string, price: unknown, name?: string } }>} validatedPasses
 * @param {{ mode: string, uniform?: { discount_type: string, discount_value: number }, pass_rules?: Record<string, { discount_type: string, discount_value: number }> }} policy
 */
export function applyPresaleDiscountToPasses(validatedPasses, policy) {
  if (!policy || !validatedPasses?.length) return;
  for (const vp of validatedPasses) {
    const passId = String(vp.passId || vp.eventPass?.id || '');
    const base = parseFloat(vp.eventPass?.price);
    const rule = getPassDiscountRuleFromPolicy(policy, passId);
    vp.price = applyDiscountToUnitPrice(base, rule);
  }
}

/**
 * JSON payload for session/redeem APIs (client display only).
 * @param {{ mode: string, uniform?: object, pass_rules?: Record<string, object> }} policy
 */
export function presaleDiscountPolicyToApi(policy) {
  if (!policy) return null;
  if (policy.mode === 'per_pass') {
    return {
      mode: 'per_pass',
      pass_rules: policy.pass_rules || {},
    };
  }
  return {
    mode: 'uniform',
    uniform: policy.uniform || { discount_type: 'percent', discount_value: 0 },
  };
}

/**
 * @param {Array<{ passId?: string, quantity: number, passName?: string, price: number, eventPass: { id?: string, price: unknown, name?: string } }>} validatedPasses
 * @param {{ mode: string, uniform?: object, pass_rules?: Record<string, object> }} policy
 */
export function buildPresalePassBreakdown(validatedPasses, policy) {
  const lines = [];
  for (const vp of validatedPasses) {
    const passId = String(vp.passId || vp.eventPass?.id || '');
    const unitList = roundPresaleMoney(parseFloat(vp.eventPass?.price));
    const unitDiscounted = roundPresaleMoney(parseFloat(vp.price));
    const rule = getPassDiscountRuleFromPolicy(policy, passId);
    lines.push({
      pass_id: passId,
      pass_name: vp.passName || vp.eventPass?.name || null,
      discount_type: rule?.discount_type || null,
      discount_value: rule != null ? rule.discount_value : null,
      unit_list: unitList,
      unit_discounted: unitDiscounted,
      quantity: vp.quantity || 0,
    });
  }
  return lines;
}

/**
 * @param {Record<string, unknown>} codeRow
 * @param {Array<Record<string, unknown>>} passDiscountRows
 * @param {number} originalSubtotal
 * @param {number} discountedSubtotal
 * @param {Array<Record<string, unknown>>} passBreakdown
 */
export function buildPresaleOrderSnapshot(codeRow, passDiscountRows, originalSubtotal, discountedSubtotal, passBreakdown) {
  const mode = codeRow?.discount_mode === 'per_pass' ? 'per_pass' : 'uniform';
  const base = {
    code_id: codeRow.id,
    code_label: codeRow.label || null,
    discount_mode: mode,
    original_subtotal: roundPresaleMoney(originalSubtotal),
    discounted_subtotal: roundPresaleMoney(discountedSubtotal),
  };
  if (mode === 'per_pass') {
    return {
      ...base,
      pass_breakdown: passBreakdown,
    };
  }
  return {
    ...base,
    discount_type: codeRow.discount_type,
    discount_value: parseFloat(codeRow.discount_value),
  };
}

/**
 * Validate admin pass_discounts payload.
 * @param {unknown} raw
 * @param {string} eventId
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @returns {Promise<{ ok: true, rows: Array<{ event_pass_id: string, discount_type: string, discount_value: number }> } | { ok: false, error: string }>}
 */
export async function validateAdminPassDiscounts(raw, eventId, db) {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'pass_discounts must be an array when discount_mode is per_pass' };
  }
  const { data: eventPasses, error: passErr } = await db
    .from('event_passes')
    .select('id')
    .eq('event_id', eventId);
  if (passErr) return { ok: false, error: passErr.message };
  const allowed = new Set((eventPasses || []).map((p) => String(p.id)));
  /** @type {Array<{ event_pass_id: string, discount_type: string, discount_value: number }>} */
  const rows = [];
  const seen = new Set();
  for (const item of raw) {
    const passId = item?.event_pass_id != null ? String(item.event_pass_id) : '';
    if (!passId || !allowed.has(passId)) {
      return { ok: false, error: 'Invalid event_pass_id in pass_discounts' };
    }
    if (seen.has(passId)) {
      return { ok: false, error: 'Duplicate event_pass_id in pass_discounts' };
    }
    seen.add(passId);
    const rule = normalizePresaleDiscountRule(item?.discount_type, item?.discount_value);
    if (!rule) {
      return { ok: false, error: 'Each pass_discounts entry needs valid discount_type and discount_value >= 0' };
    }
    if (rule.discount_value > 0) {
      rows.push({
        event_pass_id: passId,
        discount_type: rule.discount_type,
        discount_value: rule.discount_value,
      });
    }
  }
  return { ok: true, rows };
}

export type PresaleDiscountRule = {
  discount_type: 'percent' | 'fixed';
  discount_value: number;
};

export type PresaleDiscountPolicy =
  | { mode: 'uniform'; uniform: PresaleDiscountRule }
  | { mode: 'per_pass'; pass_rules: Record<string, PresaleDiscountRule> };

export function roundPresaleMoneyDisplay(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

export function normalizePresaleDiscountRule(
  type: unknown,
  value: unknown
): PresaleDiscountRule | null {
  if (type !== 'percent' && type !== 'fixed') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return { discount_type: type, discount_value: n };
}

export function applyDiscountToUnitPrice(
  listPrice: number,
  rule: PresaleDiscountRule | null | undefined
): number {
  const base = Number(listPrice);
  if (!Number.isFinite(base) || base <= 0 || !rule) {
    return roundPresaleMoneyDisplay(Math.max(0, base));
  }
  if (rule.discount_type === 'percent') {
    const pct = Math.min(100, Math.max(0, rule.discount_value));
    return roundPresaleMoneyDisplay(Math.max(0, base * (1 - pct / 100)));
  }
  const fixedPerUnit = Math.max(0, rule.discount_value);
  return roundPresaleMoneyDisplay(Math.max(0, base - fixedPerUnit));
}

export function getPassDiscountRule(
  policy: PresaleDiscountPolicy | null | undefined,
  passId: string
): PresaleDiscountRule | null {
  if (!policy) return null;
  if (policy.mode === 'per_pass') {
    const rule = policy.pass_rules[passId];
    return rule && rule.discount_value > 0 ? rule : null;
  }
  if (policy.uniform.discount_value > 0) return policy.uniform;
  return null;
}

export function presaleAdjustedUnitPrice(
  unitList: number,
  passId: string,
  policy: PresaleDiscountPolicy | null | undefined
): number {
  const rule = getPassDiscountRule(policy, passId);
  return applyDiscountToUnitPrice(unitList, rule);
}

export function parsePresaleDiscountPolicyFromApi(
  body: Record<string, unknown>
): PresaleDiscountPolicy | null {
  const raw = body.discount_policy;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const pol = raw as Record<string, unknown>;
    if (pol.mode === 'per_pass') {
      const passRulesRaw = pol.pass_rules;
      const pass_rules: Record<string, PresaleDiscountRule> = {};
      if (passRulesRaw && typeof passRulesRaw === 'object' && !Array.isArray(passRulesRaw)) {
        for (const [passId, ruleRaw] of Object.entries(passRulesRaw as Record<string, unknown>)) {
          if (!ruleRaw || typeof ruleRaw !== 'object') continue;
          const r = ruleRaw as Record<string, unknown>;
          const rule = normalizePresaleDiscountRule(r.discount_type, r.discount_value);
          if (rule && rule.discount_value > 0) pass_rules[passId] = rule;
        }
      }
      return { mode: 'per_pass', pass_rules };
    }
    if (pol.mode === 'uniform') {
      const u = pol.uniform;
      if (u && typeof u === 'object' && !Array.isArray(u)) {
        const ur = u as Record<string, unknown>;
        const rule = normalizePresaleDiscountRule(ur.discount_type, ur.discount_value);
        if (rule) return { mode: 'uniform', uniform: rule };
      }
    }
  }
  const legacy = normalizePresaleDiscountRule(body.discount_type, body.discount_value);
  if (legacy) return { mode: 'uniform', uniform: legacy };
  return null;
}

export function formatPresalePolicySummary(
  policy: PresaleDiscountPolicy | null | undefined,
  language: 'en' | 'fr'
): string | null {
  if (!policy) return null;
  if (policy.mode === 'per_pass') {
    const count = Object.keys(policy.pass_rules).length;
    if (count === 0) {
      return language === 'en' ? 'Per pass (none configured)' : 'Par pass (aucune configurée)';
    }
    return language === 'en' ? `Per pass (${count} rules)` : `Par pass (${count} règles)`;
  }
  const u = policy.uniform;
  if (u.discount_type === 'percent') return `${u.discount_value}%`;
  return `${u.discount_value} TND`;
}

export type PresalePassBreakdownRow = {
  pass_id?: string;
  pass_name?: string;
  discount_type?: string;
  discount_value?: number;
  unit_list?: number;
  unit_discounted?: number;
  quantity?: number;
};

export type PresaleOrderSnapshot = {
  code_id?: string;
  code_label?: string | null;
  discount_mode?: 'uniform' | 'per_pass';
  discount_type?: string;
  discount_value?: number;
  original_subtotal?: number;
  discounted_subtotal?: number;
  pass_breakdown?: PresalePassBreakdownRow[];
};

export function parsePresaleOrderSnapshot(raw: unknown): PresaleOrderSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const pass_breakdown = Array.isArray(p.pass_breakdown)
    ? (p.pass_breakdown as Record<string, unknown>[]).map((row) => ({
        pass_id: typeof row.pass_id === 'string' ? row.pass_id : undefined,
        pass_name: typeof row.pass_name === 'string' ? row.pass_name : undefined,
        discount_type: typeof row.discount_type === 'string' ? row.discount_type : undefined,
        discount_value:
          typeof row.discount_value === 'number' ? row.discount_value : undefined,
        unit_list: typeof row.unit_list === 'number' ? row.unit_list : undefined,
        unit_discounted:
          typeof row.unit_discounted === 'number' ? row.unit_discounted : undefined,
        quantity: typeof row.quantity === 'number' ? row.quantity : undefined,
      }))
    : undefined;
  return {
    code_id: typeof p.code_id === 'string' ? p.code_id : undefined,
    code_label: typeof p.code_label === 'string' ? p.code_label : null,
    discount_mode: p.discount_mode === 'per_pass' ? 'per_pass' : 'uniform',
    discount_type: typeof p.discount_type === 'string' ? p.discount_type : undefined,
    discount_value: typeof p.discount_value === 'number' ? p.discount_value : undefined,
    original_subtotal:
      typeof p.original_subtotal === 'number' ? p.original_subtotal : undefined,
    discounted_subtotal:
      typeof p.discounted_subtotal === 'number' ? p.discounted_subtotal : undefined,
    pass_breakdown,
  };
}

export function formatPresaleOrderDiscountLabel(
  snapshot: PresaleOrderSnapshot | null,
  language: 'en' | 'fr'
): string | null {
  if (!snapshot) return null;
  if (snapshot.discount_mode === 'per_pass') {
    return language === 'en' ? 'Per pass' : 'Par pass';
  }
  if (snapshot.discount_value == null) return null;
  if (snapshot.discount_type === 'percent') {
    return `${Number(snapshot.discount_value).toFixed(0)}%`;
  }
  return `${Number(snapshot.discount_value).toFixed(2)} TND`;
}

export function formatPresalePassBreakdownRule(
  row: PresalePassBreakdownRow,
  language: 'en' | 'fr'
): string {
  const label = row.pass_name || row.pass_id || (language === 'en' ? 'Pass' : 'Pass');
  if (row.discount_type === 'percent' && row.discount_value != null) {
    return `${label}: ${Number(row.discount_value).toFixed(0)}%`;
  }
  if (row.discount_value != null) {
    return `${label}: ${Number(row.discount_value).toFixed(2)} TND`;
  }
  return label;
}

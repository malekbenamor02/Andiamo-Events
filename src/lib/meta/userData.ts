import type { MetaCustomerData } from './types';

function normalizeEmail(email: string): string | undefined {
  const v = email.trim().toLowerCase();
  return v.length ? v : undefined;
}

function normalizePhone(phone: string): string | undefined {
  let digits = phone.replace(/\D/g, '');
  if (!digits.length) return undefined;
  if (digits.startsWith('00216')) digits = digits.slice(2);
  if (!digits.startsWith('216') && digits.length === 8) {
    digits = `216${digits}`;
  }
  return digits;
}

function normalizeNamePart(part: string): string | undefined {
  const v = part
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  return v.length ? v : undefined;
}

function splitFullName(fullName: string): { fn?: string; ln?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) {
    return { fn: normalizeNamePart(parts[0]) };
  }
  return {
    fn: normalizeNamePart(parts[0]),
    ln: normalizeNamePart(parts.slice(1).join(' ')),
  };
}

function normalizeCity(city: string): string | undefined {
  const v = city
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  return v.length ? v : undefined;
}

/** Plain-text advanced matching params for Meta Pixel (Meta hashes client-side). */
export function buildPixelAdvancedMatching(customer: MetaCustomerData): Record<string, string> {
  const { fn, ln } = splitFullName(customer.fullName);
  const em = normalizeEmail(customer.email);
  const ph = normalizePhone(customer.phone);
  const ct = customer.city ? normalizeCity(customer.city) : undefined;

  const out: Record<string, string> = { country: 'tn' };
  if (em) out.em = em;
  if (ph) out.ph = ph;
  if (fn) out.fn = fn;
  if (ln) out.ln = ln;
  if (ct) out.ct = ct;
  return out;
}

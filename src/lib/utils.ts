import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Remove whitespace from phone input (paste e.g. "25 123 456" → "25123456"). */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/\s/g, '')
}

/** Known misspellings of gmail.com / icloud.com → correct domain (local part unchanged). */
const EMAIL_DOMAIN_TYPOS: Record<string, 'gmail.com' | 'icloud.com'> = {
  // Gmail — letter swaps / missing / doubled
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaiil.com': 'gmail.com',
  'gmaail.com': 'gmail.com',
  'ggmail.com': 'gmail.com',
  'gma.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gemil.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gmsil.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gmael.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'g-mail.com': 'gmail.com',
  'gmailcom': 'gmail.com',
  'gmaillcom': 'gmail.com',
  // Gmail — wrong TLD / partial “.com”
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.ocm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.coon': 'gmail.com',
  'gmail.coom': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.cop': 'gmail.com',
  'gmail.xom': 'gmail.com',
  'gmail.vom': 'gmail.com',
  'gmail.cpm': 'gmail.com',
  'gmail.net': 'gmail.com',
  'gmail.org': 'gmail.com',
  'gmail.fr': 'gmail.com',
  'gmail.tn': 'gmail.com',
  'gmaol.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmajl.com': 'gmail.com',
  'gmai.com.com': 'gmail.com',
  'gmail.coim': 'gmail.com',
  'gmailcim.com': 'gmail.com',
  // iCloud — “iclou…” / missing letters / swaps
  'iclou.com': 'icloud.com',
  'iclou.co': 'icloud.com',
  'iclou.con': 'icloud.com',
  'iclou.cm': 'icloud.com',
  'icloucom': 'icloud.com',
  'iclould.com': 'icloud.com',
  'iclound.com': 'icloud.com',
  'icloude.com': 'icloud.com',
  'icloudd.com': 'icloud.com',
  'iclouud.com': 'icloud.com',
  'icloued.com': 'icloud.com',
  'icleoud.com': 'icloud.com',
  'icluod.com': 'icloud.com',
  'icluoud.com': 'icloud.com',
  'iclloud.com': 'icloud.com',
  'iclood.com': 'icloud.com',
  'iclod.com': 'icloud.com',
  'iclud.com': 'icloud.com',
  'iclouds.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'icould.com': 'icloud.com',
  'icoudl.com': 'icloud.com',
  'iclodud.com': 'icloud.com',
  'ickoud.com': 'icloud.com',
  'ikoud.com': 'icloud.com',
  'ikcloud.com': 'icloud.com',
  'icloudcom': 'icloud.com',
  'icloud.co': 'icloud.com',
  'icloud.cm': 'icloud.com',
  'icloud.con': 'icloud.com',
  'icloud.cmo': 'icloud.com',
  'icloud.ocm': 'icloud.com',
  'icloud.coon': 'icloud.com',
  'icloud.coom': 'icloud.com',
  'icloud.om': 'icloud.com',
  'icloud.xom': 'icloud.com',
  'icloud.net': 'icloud.com',
  'icloud.org': 'icloud.com',
  'icloud.coim': 'icloud.com',
  'icloudn.com': 'icloud.com',
  'icloudl.com': 'icloud.com',
  'icloudw.com': 'icloud.com',
  'iicloud.com': 'icloud.com',
}

/**
 * Fix frequent Gmail / iCloud domain typos (spaces stripped in domain only).
 */
export function normalizeCommonEmailTypos(value: string): string {
  const trimmed = value.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0 || at >= trimmed.length - 1) return trimmed

  const local = trimmed.slice(0, at)
  const domainRaw = trimmed.slice(at + 1)
  const domain = domainRaw.replace(/\s/g, '').toLowerCase()
  const fixed = EMAIL_DOMAIN_TYPOS[domain]
  if (!fixed) return `${local}@${domain}`
  return `${local}@${fixed}`
}

/**
 * Generate a URL-friendly slug from a string
 * Handles accented characters and special characters properly
 * Returns a non-empty slug, or falls back to event ID
 */
export function generateSlug(text: string): string {
  if (!text || typeof text !== 'string') {
    console.warn('generateSlug: Invalid input', text);
    return '';
  }
  
  // Step 1: Normalize and convert to lowercase
  let slug = text
    .toLowerCase()
    .trim();
  
  if (!slug) {
    console.warn('generateSlug: Empty after trim', text);
    return '';
  }
  
  // Step 2: Normalize accented characters (é -> e, à -> a, etc.)
  slug = slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Step 3: Replace spaces, underscores, and other separators with hyphens
  slug = slug.replace(/[\s_]+/g, '-');
  
  // Step 4: Remove all non-alphanumeric characters except hyphens
  // This is more permissive - keeps letters, numbers, and hyphens
  slug = slug.replace(/[^a-z0-9-]/g, '');
  
  // Step 5: Replace multiple consecutive hyphens with a single hyphen
  slug = slug.replace(/-+/g, '-');
  
  // Step 6: Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  
  // Debug: Log if slug is empty to help identify problematic event names
  if (!slug) {
    console.warn('generateSlug: Result is empty for input:', text);
  }
  
  // If slug is still empty, return empty string (caller should handle fallback)
  return slug || '';
}
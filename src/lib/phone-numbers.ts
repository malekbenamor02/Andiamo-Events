/**
 * Utility functions for phone number processing in bulk SMS feature
 */

import type { PhoneNumberWithMetadata, SourceSelection } from '@/types/bulk-sms';

/**
 * Normalize phone number to Tunisian format (8 digits, no prefix)
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove country code if present (216 or +216)
  if (cleaned.startsWith('216')) {
    cleaned = cleaned.substring(3);
  }
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Validate: must be 8 digits starting with 2, 5, 9, or 4
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

/**
 * Deduplicate phone numbers across sources
 */
export function deduplicatePhoneNumbers(
  phoneNumbers: PhoneNumberWithMetadata[]
): {
  unique: PhoneNumberWithMetadata[];
  duplicates: Array<{ phone: string; sources: string[] }>;
} {
  const seen = new Map<string, PhoneNumberWithMetadata>();
  const duplicates: Array<{ phone: string; sources: string[] }> = [];
  
  phoneNumbers.forEach(num => {
    const normalized = normalizePhoneNumber(num.phone);
    if (!normalized) return;
    
    if (seen.has(normalized)) {
      const existing = seen.get(normalized)!;
      duplicates.push({
        phone: normalized,
        sources: [existing.source, num.source]
      });
    } else {
      seen.set(normalized, num);
    }
  });
  
  return {
    unique: Array.from(seen.values()),
    duplicates
  };
}

/**
 * Format phone number for display (with +216 prefix)
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return normalized ? `+216 ${normalized}` : phone;
}

/**
 * Get source display name
 */
export function getSourceDisplayName(source: keyof SourceSelection, language: 'en' | 'fr' = 'en'): string {
  const names: Record<keyof SourceSelection, { en: string; fr: string }> = {
    ambassador_applications: { en: 'Ambassador Applications', fr: 'Candidatures Ambassadeurs' },
    orders: { en: 'Orders (Clients)', fr: 'Commandes (Clients)' },
    aio_events_submissions: { en: 'AIO Events Submissions', fr: 'Soumissions AIO Events' },
    approved_ambassadors: { en: 'Approved Ambassadors', fr: 'Ambassadeurs Approuvés' },
    phone_subscribers: { en: 'Phone Subscribers', fr: 'Abonnés Téléphone' }
  };
  
  return names[source]?.[language] || source;
}

/**
 * Check if at least one source is selected
 */
export function hasSelectedSource(selection: SourceSelection): boolean {
  return Object.values(selection).some(Boolean);
}

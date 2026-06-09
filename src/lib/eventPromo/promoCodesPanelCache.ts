import type { EventPass } from '@/pages/admin/types';
import type { EventPromoCodeAdminRow, PromoDiscountEditDraft } from '@/lib/eventPromo/discountDraft';

export type EventPromoCodesPanelCache = {
  codes: EventPromoCodeAdminRow[];
  passes: EventPass[];
  maxUseDrafts: Record<string, string>;
  codeDiscountEditDrafts: Record<string, PromoDiscountEditDraft>;
};

const cacheByEventId = new Map<string, EventPromoCodesPanelCache>();

export function getEventPromoCodesPanelCache(eventId: string): EventPromoCodesPanelCache | undefined {
  return cacheByEventId.get(eventId);
}

export function setEventPromoCodesPanelCache(eventId: string, data: EventPromoCodesPanelCache): void {
  cacheByEventId.set(eventId, data);
}

export function clearEventPromoCodesPanelCache(eventId?: string): void {
  if (eventId) cacheByEventId.delete(eventId);
  else cacheByEventId.clear();
}

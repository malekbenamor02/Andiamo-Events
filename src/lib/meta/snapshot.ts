import type { MetaPurchaseSnapshot } from './types';

const STORAGE_PREFIX = 'andiamo_meta_purchase:';

export function savePurchaseSnapshot(orderId: string, snapshot: MetaPurchaseSnapshot): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${orderId}`, JSON.stringify(snapshot));
  } catch {
    // ignore quota / private mode
  }
}

export function consumePurchaseSnapshot(orderId: string): MetaPurchaseSnapshot | null {
  if (typeof sessionStorage === 'undefined') return null;
  const key = `${STORAGE_PREFIX}${orderId}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw) as MetaPurchaseSnapshot;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

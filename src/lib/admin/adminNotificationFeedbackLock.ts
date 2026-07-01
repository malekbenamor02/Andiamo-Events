/**
 * Cross-tab lock so only one dashboard tab plays sound / desktop notifications per batch.
 * BroadcastChannel when available; localStorage TTL lock as fallback.
 */

import { BROADCAST_CHANNEL_NAME } from '@/lib/admin/adminNotificationTypes';

const LOCK_STORAGE_KEY = 'adminNotificationFeedbackLock';
const LOCK_TTL_MS = 5000;

type FeedbackClaimMessage = {
  type: 'feedback-claimed';
  batchKey: string;
  tabId: string;
  ts: number;
};

let tabId: string | null = null;
let channel: BroadcastChannel | null = null;
const remoteClaims = new Set<string>();

function getTabId(): string {
  if (tabId) return tabId;
  tabId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return tabId;
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

function canUseBroadcastChannel(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}

function readStorageLock(): { key: string; ts: number } | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return null;
    const sep = raw.indexOf('::');
    if (sep <= 0) return null;
    const key = raw.slice(0, sep);
    const ts = Number(raw.slice(sep + 2));
    if (!key || Number.isNaN(ts)) return null;
    return { key, ts };
  } catch {
    return null;
  }
}

function writeStorageLock(batchKey: string, ts: number): boolean {
  if (!canUseLocalStorage()) return true;
  try {
    const value = `${batchKey}::${ts}`;
    localStorage.setItem(LOCK_STORAGE_KEY, value);
    return localStorage.getItem(LOCK_STORAGE_KEY) === value;
  } catch {
    return true;
  }
}

function rememberRemoteClaim(batchKey: string): void {
  remoteClaims.add(batchKey);
  setTimeout(() => remoteClaims.delete(batchKey), LOCK_TTL_MS);
}

function ensureChannel(): BroadcastChannel | null {
  if (!canUseBroadcastChannel()) {
    return null;
  }
  if (channel) return channel;
  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<FeedbackClaimMessage>) => {
      const data = event.data;
      if (data?.type !== 'feedback-claimed' || !data.batchKey) return;
      if (data.tabId === getTabId()) return;
      rememberRemoteClaim(data.batchKey);
    };
    return channel;
  } catch {
    channel = null;
    return null;
  }
}

export function initAdminNotificationFeedbackLock(): void {
  ensureChannel();
}

export function isFeedbackClaimedRemotely(batchKey: string): boolean {
  return remoteClaims.has(batchKey);
}

/**
 * Attempt to claim sound/desktop feedback for a batch. Returns true if this tab should play.
 */
export function tryClaimFeedbackLock(batchKey: string): boolean {
  initAdminNotificationFeedbackLock();

  if (remoteClaims.has(batchKey)) return false;

  const now = Date.now();
  const existing = readStorageLock();
  if (existing && existing.key === batchKey && now - existing.ts < LOCK_TTL_MS) {
    return false;
  }

  if (!writeStorageLock(batchKey, now)) {
    return false;
  }

  const bc = ensureChannel();
  if (bc) {
    const msg: FeedbackClaimMessage = {
      type: 'feedback-claimed',
      batchKey,
      tabId: getTabId(),
      ts: now,
    };
    try {
      bc.postMessage(msg);
    } catch {
      // non-blocking
    }
  }

  return true;
}

export function resetAdminNotificationFeedbackLockForTests(): void {
  remoteClaims.clear();
  tabId = null;
  if (channel) {
    try {
      channel.close();
    } catch {
      // ignore
    }
    channel = null;
  }
}

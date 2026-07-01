import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  resetAdminNotificationFeedbackLockForTests,
  tryClaimFeedbackLock,
} from '@/lib/admin/adminNotificationFeedbackLock';

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('adminNotificationFeedbackLock', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    vi.stubGlobal('window', globalThis);
    resetAdminNotificationFeedbackLockForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAdminNotificationFeedbackLockForTests();
  });

  it('allows different batches after first claim expires logically', () => {
    expect(tryClaimFeedbackLock('batch-a')).toBe(true);
    expect(tryClaimFeedbackLock('batch-b')).toBe(true);
  });

  it('blocks duplicate claim for same batch via localStorage', () => {
    expect(tryClaimFeedbackLock('same-batch')).toBe(true);
    expect(tryClaimFeedbackLock('same-batch')).toBe(false);
  });
});

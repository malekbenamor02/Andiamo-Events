/**
 * Admin activity logging for the Admins > Activity Logs UI.
 * Persists to `admin_logs`; no PII in details.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface LogAdminActionParams {
  adminId: string;
  adminName: string;
  adminEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
}

export async function logAdminAction(
  supabase: SupabaseClient,
  params: LogAdminActionParams
): Promise<void> {
  try {
    await (supabase as any).from('admin_logs').insert({
      admin_id: params.adminId,
      admin_name: params.adminName,
      admin_email: params.adminEmail ?? null,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      details: params.details ?? null,
    });
  } catch (e) {
    console.error('[adminLogs] Failed to insert:', e);
  }
}

/**
 * Admin activity logging for the Admins > Activity Logs UI.
 * Persists via POST /api/admin/audit-log (service role); no browser Supabase writes.
 */

export interface LogAdminActionParams {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  try {
    const { adminOrdersApi } = await import('@/lib/adminOrdersApi');
    await adminOrdersApi.writeAuditLog({
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      details: params.details,
    });
  } catch (e) {
    console.error('[adminLogs] Failed to write audit log:', e);
  }
}

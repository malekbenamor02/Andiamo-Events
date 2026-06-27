/**
 * Best-effort audit trail for admin service-role mutations.
 */
export async function writeAdminMutationAudit(db, { admin, action, targetType, targetId, details }) {
  if (!db || !admin?.id || !action) return;
  try {
    await db.from('admin_logs').insert({
      admin_id: admin.id,
      admin_name: admin.name || 'Unknown',
      admin_email: admin.email || null,
      action,
      target_type: targetType || null,
      target_id: targetId != null ? String(targetId) : null,
      details: details && typeof details === 'object' ? details : {},
    });
  } catch (err) {
    console.error('admin mutation audit log failed:', err?.message || err);
  }
}

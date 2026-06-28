'use strict';

/**
 * Admin audit log writes (admin_logs table) — service role.
 * Viewing audit logs on the Admins tab uses GET /api/admin/audit-logs.
 */
function registerAdminAuditLogsRoutes(app, deps) {
  const { supabaseService, requireAdminAuth, requireAdminPermission } = deps;

  app.post('/api/admin/audit-log', requireAdminAuth, requireAdminPermission('admins:manage'), async (req, res) => {
    try {
      if (!supabaseService) {
        return res.status(503).json({
          error: 'Server configuration error',
          details: 'SUPABASE_SERVICE_ROLE_KEY is required',
        });
      }

      const { action, targetType, targetId, details } = req.body || {};
      if (!action || typeof action !== 'string') {
        return res.status(400).json({ error: 'action is required' });
      }

      const admin = req.admin;
      if (!admin?.id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { error } = await supabaseService.from('admin_logs').insert({
        admin_id: admin.id,
        admin_name: admin.name || 'Unknown',
        admin_email: admin.email || null,
        action: String(action).trim(),
        target_type: targetType ?? null,
        target_id: targetId ?? null,
        details: details ?? null,
      });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get(
    '/api/admin/audit-logs',
    requireAdminAuth,
    requireAdminPermission('admins:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(503).json({
            error: 'Server configuration error',
            details: 'SUPABASE_SERVICE_ROLE_KEY is required',
          });
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 150, 200);
        const { data, error } = await supabaseService
          .from('admin_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );
}

module.exports = { registerAdminAuditLogsRoutes };

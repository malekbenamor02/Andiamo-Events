'use strict';

/** Team members CRUD — super_admin, service role. */
function registerAdminTeamRoutes(app, deps) {
  const { supabaseService, requireAdminAuth, requireAdminPermission } = deps;

  app.get(
    '/api/admin/team-members',
    requireAdminAuth,
    requireAdminPermission('team:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        const { data, error } = await supabaseService
          .from('team_members')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    '/api/admin/team-members',
    requireAdminAuth,
    requireAdminPermission('team:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        const payload = req.body || {};
        if (!payload.name) {
          return res.status(400).json({ error: 'name is required' });
        }
        const { data, error } = await supabaseService
          .from('team_members')
          .insert(payload)
          .select()
          .single();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(201).json({ success: true, data });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  app.patch(
    '/api/admin/team-members/:id',
    requireAdminAuth,
    requireAdminPermission('team:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        const { data, error } = await supabaseService
          .from('team_members')
          .update(req.body || {})
          .eq('id', req.params.id)
          .select()
          .single();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    '/api/admin/team-members/:id',
    requireAdminAuth,
    requireAdminPermission('team:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        const { error } = await supabaseService.from('team_members').delete().eq('id', req.params.id);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );
}

module.exports = { registerAdminTeamRoutes };

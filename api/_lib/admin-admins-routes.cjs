'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function generatePassword() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Admin user CRUD — super_admin only, service role.
 */
function registerAdminAdminsRoutes(app, deps) {
  const { supabaseService, requireAdminAuth, requireAdminPermission } = deps;

  app.get(
    '/api/admin/admins',
    requireAdminAuth,
    requireAdminPermission('admins:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        const { data, error } = await supabaseService
          .from('admins')
          .select('id, name, email, phone, role, is_active, created_at')
          .order('created_at', { ascending: false });
        if (error) {
          return res.status(500).json({ error: error.message });
        }
        return res.json({ success: true, data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    '/api/admin/admins',
    requireAdminAuth,
    requireAdminPermission('admins:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        const { name, email, phone, role } = req.body || {};
        if (!name || !email) {
          return res.status(400).json({ error: 'name and email are required' });
        }
        const adminRole = role === 'super_admin' ? 'super_admin' : 'admin';
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertPayload = {
          name: String(name).trim(),
          email: String(email).trim().toLowerCase(),
          password: hashedPassword,
          role: adminRole,
          is_active: true,
        };
        if (phone && String(phone).trim()) {
          insertPayload.phone = String(phone).trim();
        }
        const { data, error } = await supabaseService
          .from('admins')
          .insert(insertPayload)
          .select('id, name, email, phone, role, is_active, created_at')
          .single();
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.status(201).json({ success: true, data, generatedPassword: password });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  app.patch(
    '/api/admin/admins/:id',
    requireAdminAuth,
    requireAdminPermission('admins:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        const { name, email, phone, role, is_active } = req.body || {};
        const updatePayload = {};
        if (name != null) updatePayload.name = String(name).trim();
        if (email != null) updatePayload.email = String(email).trim().toLowerCase();
        if (phone !== undefined) {
          updatePayload.phone = phone && String(phone).trim() ? String(phone).trim() : null;
        }
        if (role != null) updatePayload.role = role === 'super_admin' ? 'super_admin' : 'admin';
        if (is_active != null) updatePayload.is_active = !!is_active;
        if (!Object.keys(updatePayload).length) {
          return res.status(400).json({ error: 'No fields to update' });
        }
        const { data, error } = await supabaseService
          .from('admins')
          .update(updatePayload)
          .eq('id', req.params.id)
          .select('id, name, email, phone, role, is_active, created_at')
          .single();
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.json({ success: true, data });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    '/api/admin/admins/:id',
    requireAdminAuth,
    requireAdminPermission('admins:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        if (req.params.id === req.admin.id) {
          return res.status(400).json({ error: 'Cannot delete your own admin account' });
        }
        const { error } = await supabaseService.from('admins').delete().eq('id', req.params.id);
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );
}

module.exports = { registerAdminAdminsRoutes };

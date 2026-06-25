'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ADMIN_TAB_DEFINITIONS } = require('../../shared/admin/tabDefinitions.cjs');
const {
  validateAdminTabAccessPayload,
  tabAccessSummaryFromRows,
} = require('../../shared/admin/tabAccess.cjs');

function generatePassword() {
  return crypto.randomBytes(8).toString('hex');
}

function tabFieldsInBody(body) {
  return body && (body.allowed_tab_keys !== undefined || body.mobile_tab_keys !== undefined);
}

async function loadTabRowsByAdminIds(supabaseService, adminIds) {
  if (!adminIds.length) return new Map();
  const { data, error } = await supabaseService
    .from('admin_tab_access')
    .select('admin_id, tab_key, show_in_mobile, mobile_order')
    .in('admin_id', adminIds);
  if (error) throw new Error(error.message);

  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.admin_id)) map.set(row.admin_id, []);
    map.get(row.admin_id).push({
      tab_key: row.tab_key,
      show_in_mobile: row.show_in_mobile,
      mobile_order: row.mobile_order,
    });
  }
  return map;
}

async function replaceTabAccess(supabaseService, adminId, rows) {
  const { error } = await supabaseService.rpc('replace_admin_tab_access', {
    p_admin_id: adminId,
    p_rows: rows && rows.length ? rows : null,
  });
  if (error) throw new Error(error.message);
}

async function writeTabAccessAudit(supabaseService, actor, targetAdminId, before, after) {
  const { error } = await supabaseService.from('admin_logs').insert({
    admin_id: actor.id,
    admin_name: actor.name || 'Unknown',
    admin_email: actor.email || null,
    action: 'admin.tab_access.updated',
    target_type: 'admin',
    target_id: targetAdminId,
    details: { before, after },
  });
  if (error) {
    console.error('admin tab access audit log failed:', error);
  }
}

function assertSuperAdminCanConfigureTabs(req, res) {
  if (req.admin.role !== 'super_admin') {
    res.status(403).json({ error: 'Only super admins can configure tab access' });
    return false;
  }
  return true;
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

        const admins = data || [];
        const tabMap = await loadTabRowsByAdminIds(
          supabaseService,
          admins.map((a) => a.id)
        );

        const enriched = admins.map((admin) => ({
          ...admin,
          tab_access: tabAccessSummaryFromRows(tabMap.get(admin.id) || [], ADMIN_TAB_DEFINITIONS),
        }));

        return res.json({ success: true, data: enriched });
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
        const { name, email, phone, role, allowed_tab_keys, mobile_tab_keys } = req.body || {};
        if (!name || !email) {
          return res.status(400).json({ error: 'name and email are required' });
        }

        const adminRole = role === 'super_admin' ? 'super_admin' : 'admin';

        if (tabFieldsInBody(req.body)) {
          if (!assertSuperAdminCanConfigureTabs(req, res)) return;
          const validation = validateAdminTabAccessPayload(
            { role: adminRole, allowed_tab_keys, mobile_tab_keys },
            ADMIN_TAB_DEFINITIONS
          );
          if (!validation.ok) {
            return res.status(400).json({ error: validation.error });
          }
        }

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

        if (tabFieldsInBody(req.body) && adminRole === 'admin') {
          const validation = validateAdminTabAccessPayload(
            { role: adminRole, allowed_tab_keys, mobile_tab_keys },
            ADMIN_TAB_DEFINITIONS
          );
          if (validation.ok && !validation.unchanged) {
            if (validation.clearConfig) {
              await replaceTabAccess(supabaseService, data.id, []);
            } else if (validation.rows) {
              await replaceTabAccess(supabaseService, data.id, validation.rows);
              await writeTabAccessAudit(
                supabaseService,
                req.admin,
                data.id,
                tabAccessSummaryFromRows([], ADMIN_TAB_DEFINITIONS),
                tabAccessSummaryFromRows(validation.rows, ADMIN_TAB_DEFINITIONS)
              );
            }
          }
        }

        const tabRows = await loadTabRowsByAdminIds(supabaseService, [data.id]);
        const tab_access = tabAccessSummaryFromRows(tabRows.get(data.id) || [], ADMIN_TAB_DEFINITIONS);

        return res.status(201).json({
          success: true,
          data: { ...data, tab_access },
          generatedPassword: password,
        });
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
        const { name, email, phone, role, is_active, allowed_tab_keys, mobile_tab_keys } =
          req.body || {};
        const updatePayload = {};
        if (name != null) updatePayload.name = String(name).trim();
        if (email != null) updatePayload.email = String(email).trim().toLowerCase();
        if (phone !== undefined) {
          updatePayload.phone = phone && String(phone).trim() ? String(phone).trim() : null;
        }
        if (role != null) updatePayload.role = role === 'super_admin' ? 'super_admin' : 'admin';
        if (is_active != null) updatePayload.is_active = !!is_active;

        const hasTabFields = tabFieldsInBody(req.body);
        const hasAdminFields = Object.keys(updatePayload).length > 0;

        if (!hasAdminFields && !hasTabFields) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        const { data: existing, error: existingError } = await supabaseService
          .from('admins')
          .select('id, name, email, phone, role, is_active, created_at')
          .eq('id', req.params.id)
          .single();
        if (existingError || !existing) {
          return res.status(404).json({ error: 'Admin not found' });
        }

        const targetRole = updatePayload.role ?? existing.role;

        if (hasTabFields) {
          if (!assertSuperAdminCanConfigureTabs(req, res)) return;
          const validation = validateAdminTabAccessPayload(
            { role: targetRole, allowed_tab_keys, mobile_tab_keys },
            ADMIN_TAB_DEFINITIONS
          );
          if (!validation.ok) {
            return res.status(400).json({ error: validation.error });
          }
        }

        const beforeTabRows = await loadTabRowsByAdminIds(supabaseService, [existing.id]);
        const beforeSummary = tabAccessSummaryFromRows(
          beforeTabRows.get(existing.id) || [],
          ADMIN_TAB_DEFINITIONS
        );

        if (hasAdminFields) {
          const { error } = await supabaseService
            .from('admins')
            .update(updatePayload)
            .eq('id', req.params.id);
          if (error) {
            return res.status(400).json({ error: error.message });
          }
        }

        if (targetRole === 'super_admin') {
          await replaceTabAccess(supabaseService, req.params.id, []);
        } else if (hasTabFields) {
          const validation = validateAdminTabAccessPayload(
            { role: targetRole, allowed_tab_keys, mobile_tab_keys },
            ADMIN_TAB_DEFINITIONS
          );
          if (validation.ok && !validation.unchanged) {
            if (validation.clearConfig) {
              await replaceTabAccess(supabaseService, req.params.id, []);
            } else if (validation.rows) {
              await replaceTabAccess(supabaseService, req.params.id, validation.rows);
            }
            const afterTabRows = await loadTabRowsByAdminIds(supabaseService, [req.params.id]);
            const afterSummary = tabAccessSummaryFromRows(
              afterTabRows.get(req.params.id) || [],
              ADMIN_TAB_DEFINITIONS
            );
            await writeTabAccessAudit(
              supabaseService,
              req.admin,
              req.params.id,
              beforeSummary,
              afterSummary
            );
          }
        }

        const { data, error } = await supabaseService
          .from('admins')
          .select('id, name, email, phone, role, is_active, created_at')
          .eq('id', req.params.id)
          .single();
        if (error) {
          return res.status(400).json({ error: error.message });
        }

        const tabRows = await loadTabRowsByAdminIds(supabaseService, [data.id]);
        const tab_access = tabAccessSummaryFromRows(tabRows.get(data.id) || [], ADMIN_TAB_DEFINITIONS);

        return res.json({ success: true, data: { ...data, tab_access } });
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

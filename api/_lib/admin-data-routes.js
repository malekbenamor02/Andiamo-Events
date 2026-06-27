/**
 * Admin data API routes — service-role backed; replaces client Supabase on private tables.
 * All routes enforce tab/permission access and use explicit field allowlists on writes.
 */
import { hasEffectivePermission } from './admin-authorization.mjs';
import {
  ADMIN_DATA_ROUTE_PERMISSIONS as PERM,
  pickAllowedFields,
  rejectUnexpectedFields,
  requireAdmin,
  buildAmbassadorWritePayload,
  jsonBadRequest,
} from './admin-data-route-helpers.js';

function matchId(path, prefix) {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  const id = rest.split('/')[0];
  return id && id.length > 0 ? id : null;
}

export async function handleAdminDataRoutes(req, res, path, method, { verifyAdminAuth, parseBody }) {
  // GET /api/admin/dashboard/bootstrap
  if (path === '/api/admin/dashboard/bootstrap' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.DASHBOARD_BOOTSTRAP);
    if (!ctx) return true;
    const { db, permissions } = ctx;

    const payload = {};

    if (hasEffectivePermission(permissions, PERM.APPLICATIONS)) {
      const appsCols =
        'id, full_name, age, city, ville, social_link, phone_number, email, motivation, status, created_at, updated_at, reapply_delay_date, manually_added, reviewed_by_admin_id, reviewed_at, reviewed_by_name, meta_attribution, meta_lead_sent_at';
      const appsRes = await db
        .from('ambassador_applications')
        .select(appsCols)
        .order('created_at', { ascending: false });
      if (appsRes.error) {
        return res.status(500).json({ error: 'Failed to load applications', details: appsRes.error.message });
      }
      payload.applications = appsRes.data || [];
    } else {
      payload.applications = [];
    }

    if (hasEffectivePermission(permissions, 'events:manage')) {
      const eventsCols =
        'id, name, description, date, venue, city, poster_url, event_type, gallery_images, gallery_videos, event_status, is_test, slug, gallery_credit, is_private_presale, private_access_mode, allow_public_conversion, presale_enabled, presale_active_from, presale_active_until, presale_hide_from_public_list, presale_pass_video_url, presale_pass_mux_playback_id, seating_chart_url, created_at, updated_at';
      const eventsRes = await db.from('events').select(eventsCols).order('date', { ascending: false });
      if (eventsRes.error) {
        return res.status(500).json({ error: 'Failed to load events', details: eventsRes.error.message });
      }
      const eventRows = eventsRes.data || [];
      const eventIds = eventRows.map((e) => e.id).filter(Boolean);
      const passesByEventId = {};
      if (eventIds.length > 0) {
        const passesRes = await db
          .from('event_passes')
          .select(
            'id, event_id, name, price, description, is_primary, sold_quantity, max_quantity, is_active, allowed_payment_methods, release_version, created_at, updated_at',
          )
          .in('event_id', eventIds)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true });
        if (!passesRes.error) {
          for (const p of passesRes.data || []) {
            if (!passesByEventId[p.event_id]) passesByEventId[p.event_id] = [];
            passesByEventId[p.event_id].push(p);
          }
        }
      }
      payload.events = eventRows.map((e) => ({ ...e, passes: passesByEventId[e.id] || [] }));
    } else {
      payload.events = [];
    }

    if (hasEffectivePermission(permissions, PERM.AMBASSADORS)) {
      const ambCols =
        'id, full_name, phone, email, city, ville, extra_villes, status, approved_by, approved_at, created_at, updated_at, requires_password_change';
      const ambRes = await db.from('ambassadors').select(ambCols).order('created_at', { ascending: false });
      if (ambRes.error) {
        return res.status(500).json({ error: 'Failed to load ambassadors', details: ambRes.error.message });
      }
      payload.ambassadors = ambRes.data || [];
    } else {
      payload.ambassadors = [];
    }

    return res.status(200).json(payload);
  }

  if (path === '/api/admin/ambassadors' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.AMBASSADORS);
    if (!ctx) return true;
    const { data, error } = await ctx.db
      .from('ambassadors')
      .select(
        'id, full_name, phone, email, city, ville, extra_villes, status, approved_by, approved_at, created_at, updated_at, requires_password_change',
      )
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  if (path === '/api/admin/ambassadors' && method === 'POST') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.AMBASSADORS);
    if (!ctx) return true;
    const body = await parseBody(req);
    const allowed = [
      'full_name',
      'phone',
      'email',
      'city',
      'ville',
      'extra_villes',
      'status',
      'requires_password_change',
      'password',
      'generatePassword',
    ];
    if (rejectUnexpectedFields(res, body, allowed)) return true;

    try {
      const { row, temporaryPassword } = await buildAmbassadorWritePayload(body, {
        allowStatus: true,
        adminId: ctx.auth.admin?.id,
      });
      row.created_at = new Date().toISOString();
      if (!row.status) row.status = 'approved';

      const { data, error } = await ctx.db.from('ambassadors').insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({
        data,
        ...(temporaryPassword ? { temporaryPassword } : {}),
      });
    } catch (err) {
      return jsonBadRequest(res, err.message || 'Invalid ambassador payload');
    }
  }

  const ambassadorId = matchId(path, '/api/admin/ambassadors/');
  if (ambassadorId && (method === 'PATCH' || method === 'DELETE')) {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.AMBASSADORS);
    if (!ctx) return true;
    if (method === 'DELETE') {
      const { error } = await ctx.db.from('ambassadors').delete().eq('id', ambassadorId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    const body = await parseBody(req);
    const allowed = [
      'full_name',
      'phone',
      'email',
      'city',
      'ville',
      'extra_villes',
      'status',
      'requires_password_change',
      'password',
      'generatePassword',
    ];
    if (rejectUnexpectedFields(res, body, allowed)) return true;

    try {
      const { row, temporaryPassword } = await buildAmbassadorWritePayload(body, {
        allowStatus: true,
        adminId: ctx.auth.admin?.id,
      });
      row.updated_at = new Date().toISOString();

      const { data, error } = await ctx.db
        .from('ambassadors')
        .update(row)
        .eq('id', ambassadorId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({
        data,
        ...(temporaryPassword ? { temporaryPassword } : {}),
      });
    } catch (err) {
      return jsonBadRequest(res, err.message || 'Invalid ambassador payload');
    }
  }

  if (path === '/api/admin/ambassador-applications' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.APPLICATIONS);
    if (!ctx) return true;
    const { data, error } = await ctx.db
      .from('ambassador_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  if (path === '/api/admin/contact-messages' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.CONTACT_MESSAGES);
    if (!ctx) return true;
    const { data, error } = await ctx.db
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  const contactId = matchId(path, '/api/admin/contact-messages/');
  if (contactId && (method === 'PATCH' || method === 'DELETE')) {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.CONTACT_MESSAGES);
    if (!ctx) return true;
    if (method === 'DELETE') {
      const { error } = await ctx.db.from('contact_messages').delete().eq('id', contactId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    const body = await parseBody(req);
    const allowed = ['status', 'notes'];
    if (rejectUnexpectedFields(res, body, allowed)) return true;
    const patch = pickAllowedFields(body, allowed);
    patch.updated_at = new Date().toISOString();
    const { data, error } = await ctx.db
      .from('contact_messages')
      .update(patch)
      .eq('id', contactId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (path === '/api/admin/subscribers/phones' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.SUBSCRIBERS);
    if (!ctx) return true;
    const { data, error } = await ctx.db
      .from('phone_subscribers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  const phoneId = matchId(path, '/api/admin/subscribers/phones/');
  if (phoneId && (method === 'PATCH' || method === 'DELETE')) {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.SUBSCRIBERS);
    if (!ctx) return true;
    if (method === 'DELETE') {
      const { error } = await ctx.db.from('phone_subscribers').delete().eq('id', phoneId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    const body = await parseBody(req);
    const allowed = ['import_label'];
    if (rejectUnexpectedFields(res, body, allowed)) return true;
    const patch = pickAllowedFields(body, allowed);
    const { data, error } = await ctx.db
      .from('phone_subscribers')
      .update(patch)
      .eq('id', phoneId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (path === '/api/admin/subscribers/newsletters' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.SUBSCRIBERS);
    if (!ctx) return true;
    const { data, error } = await ctx.db
      .from('newsletter_subscribers')
      .select('*')
      .order('subscribed_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  const newsletterId = matchId(path, '/api/admin/subscribers/newsletters/');
  if (newsletterId && (method === 'PATCH' || method === 'DELETE')) {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.SUBSCRIBERS);
    if (!ctx) return true;
    if (method === 'DELETE') {
      const { error } = await ctx.db.from('newsletter_subscribers').delete().eq('id', newsletterId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    const body = await parseBody(req);
    const allowed = ['import_label'];
    if (rejectUnexpectedFields(res, body, allowed)) return true;
    const patch = pickAllowedFields(body, allowed);
    const { data, error } = await ctx.db
      .from('newsletter_subscribers')
      .update(patch)
      .eq('id', newsletterId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (path === '/api/admin/audience-suggestions' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.AUDIENCE_SUGGESTIONS);
    if (!ctx) return true;
    const { data, error } = await ctx.db
      .from('audience_suggestions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  const suggestionId = matchId(path, '/api/admin/audience-suggestions/');
  if (suggestionId && (method === 'PATCH' || method === 'DELETE')) {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.AUDIENCE_SUGGESTIONS);
    if (!ctx) return true;
    if (method === 'DELETE') {
      const { error } = await ctx.db.from('audience_suggestions').delete().eq('id', suggestionId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    const body = await parseBody(req);
    const allowed = ['read_at'];
    if (rejectUnexpectedFields(res, body, allowed)) return true;
    const patch = pickAllowedFields(body, allowed);
    const { data, error } = await ctx.db
      .from('audience_suggestions')
      .update(patch)
      .eq('id', suggestionId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (path === '/api/admin/sms-logs' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.LOGS);
    if (!ctx) return true;
    const limit = Math.min(parseInt(new URL(req.url, 'http://local').searchParams.get('limit') || '200', 10) || 200, 1000);
    const { data, error } = await ctx.db
      .from('sms_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  if (path === '/api/admin/site-logs' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.LOGS);
    if (!ctx) return true;
    const limit = Math.min(parseInt(new URL(req.url, 'http://local').searchParams.get('limit') || '200', 10) || 200, 1000);
    const { data, error } = await ctx.db
      .from('site_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  if (path === '/api/admin/order-passes' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.ORDER_PASSES);
    if (!ctx) return true;
    const passIdsParam = new URL(req.url, 'http://local').searchParams.get('pass_ids') || '';
    const passIds = passIdsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (passIds.length === 0) {
      return res.status(400).json({ error: 'pass_ids query parameter is required' });
    }
    const { data, error } = await ctx.db
      .from('order_passes')
      .select('order_id, pass_id, quantity, pass_type, price')
      .in('pass_id', passIds);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  return false;
}

export async function provisionAmbassadorForApplication(db, application, passwordHash) {
  const phone = application.phone_number;
  const ville =
    application.city === 'Sousse' || application.city === 'Tunis'
      ? (application.ville?.trim() || null)
      : null;

  const { data: existing } = await db
    .from('ambassadors')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await db
      .from('ambassadors')
      .update({
        full_name: application.full_name,
        email: application.email,
        city: application.city,
        ville,
        password: passwordHash,
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data: created, error: createError } = await db
    .from('ambassadors')
    .insert({
      full_name: application.full_name,
      phone,
      email: application.email,
      city: application.city,
      ville,
      password: passwordHash,
      status: 'approved',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id;
}

export { ADMIN_DATA_ROUTE_PERMISSIONS } from './admin-data-route-helpers.js';

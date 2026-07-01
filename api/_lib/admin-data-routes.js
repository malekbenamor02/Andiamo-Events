/**
 * Admin data API routes — service-role backed; replaces client Supabase on private tables.
 * All routes enforce tab/permission access and use explicit field allowlists on writes.
 */
import { createRequire } from 'module';
import { hasEffectivePermission } from './admin-authorization.mjs';
import { writeAdminMutationAudit } from './admin-mutation-audit.js';

const requireCjs = createRequire(import.meta.url);
const { revokeAllAmbassadorSessions } = requireCjs('./ambassador-auth.cjs');
const { buildDashboardActivity } = requireCjs('./admin-dashboard-activity.cjs');
import {
  ADMIN_DATA_ROUTE_PERMISSIONS as PERM,
  pickAllowedFields,
  rejectUnexpectedFields,
  requireAdmin,
  buildAmbassadorWritePayload,
  buildApplicationSyncPatchFromAmbassadorRow,
  findLatestApprovedApplicationByPhone,
  validateApplicationSyncConflicts,
  isPostgresUniqueViolation,
  jsonBadRequest,
  APPLICATION_SELECTION_WRITABLE_FIELDS,
  APPLICATION_SELECTION_ITEM_BULK_FIELDS,
  APPLICATION_SELECTION_ITEM_REMOVE_BULK_FIELDS,
  SITE_LOG_CLIENT_FIELDS,
} from './admin-data-route-helpers.js';

function matchId(path, prefix) {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  const id = rest.split('/')[0];
  return id && id.length > 0 ? id : null;
}

const APPLICATION_STATS_STATUSES = ['pending', 'approved', 'suspended', 'rejected', 'removed'];

/** Exact ambassador_applications counts by status (not limited by PostgREST row cap). */
async function countAmbassadorApplicationStats(db) {
  const counts = {};
  for (const status of APPLICATION_STATS_STATUSES) {
    const { count, error } = await db
      .from('ambassador_applications')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);
    if (error) throw error;
    counts[status] = count ?? 0;
  }
  const pending = counts.pending;
  const approved = counts.approved;
  const suspended = counts.suspended;
  const rejected = counts.rejected;
  const removed = counts.removed;
  return {
    pending,
    approved,
    suspended,
    rejected,
    removed,
    total: pending + approved + suspended + rejected + removed,
  };
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
      try {
        payload.applicationStats = await countAmbassadorApplicationStats(db);
      } catch (statsErr) {
        return res.status(500).json({
          error: 'Failed to load application stats',
          details: statsErr?.message || String(statsErr),
        });
      }
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

  // GET /api/admin/dashboard/activity — Overview Activity chart (server-side UTC daily aggregates)
  if (path === '/api/admin/dashboard/activity' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.DASHBOARD_BOOTSTRAP);
    if (!ctx) return true;

    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    const searchParams = new URLSearchParams(queryString);
    const eventId = searchParams.get('event_id');
    const daysRaw = parseInt(searchParams.get('days') || '7', 10);
    const days = Number.isFinite(daysRaw) ? daysRaw : 7;

    if (!eventId) {
      return jsonBadRequest(res, 'event_id is required');
    }

    try {
      const data = await buildDashboardActivity(ctx.db, { eventId, days });
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to load dashboard activity',
        details: err?.message || String(err),
      });
    }
  }

  // GET /api/admin/notifications/feed — sanitized live notification events (read-only)
  if (path === '/api/admin/notifications/feed' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.DASHBOARD_BOOTSTRAP);
    if (!ctx) return true;

    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    const searchParams = new URLSearchParams(queryString);
    const since = searchParams.get('since');
    const eventId = searchParams.get('event_id');

    if (!since) {
      return jsonBadRequest(res, 'since is required (ISO timestamp)');
    }

    const { buildAdminNotificationsFeed } = requireCjs('./admin-notifications-feed.cjs');

    try {
      const { serverTime, events, nextCursor, hasMore } = await buildAdminNotificationsFeed(ctx.db, {
        since,
        eventId: eventId || null,
        permissions: ctx.permissions,
      });
      return res.status(200).json({ success: true, serverTime, nextCursor, hasMore, events });
    } catch (err) {
      if (err.code === 'INVALID_SINCE') {
        return jsonBadRequest(res, err.message);
      }
      return res.status(500).json({
        error: 'Failed to load notification feed',
        details: err?.message || String(err),
      });
    }
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
      await writeAdminMutationAudit(ctx.db, {
        admin: ctx.auth.admin,
        action: 'ambassador.created',
        targetType: 'ambassador',
        targetId: data?.id,
        details: { status: row.status },
      });
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
      await writeAdminMutationAudit(ctx.db, {
        admin: ctx.auth.admin,
        action: 'ambassador.deleted',
        targetType: 'ambassador',
        targetId: ambassadorId,
        details: {},
      });
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

      const { data: currentAmbassador, error: loadAmbError } = await ctx.db
        .from('ambassadors')
        .select('id, phone, email, full_name, city, ville')
        .eq('id', ambassadorId)
        .single();
      if (loadAmbError || !currentAmbassador) {
        return res.status(404).json({ error: 'Ambassador not found' });
      }

      const applicationSyncPatch = buildApplicationSyncPatchFromAmbassadorRow(row);
      const syncFieldKeys = Object.keys(applicationSyncPatch);
      let linkedApplication = null;
      let applicationSyncSkipped = false;

      if (syncFieldKeys.length > 0) {
        try {
          linkedApplication = await findLatestApprovedApplicationByPhone(ctx.db, currentAmbassador.phone);
        } catch (lookupErr) {
          console.warn(
            'ambassador PATCH: linked application lookup failed:',
            lookupErr?.message || lookupErr,
          );
        }

        if (linkedApplication) {
          const conflictCheck = await validateApplicationSyncConflicts(ctx.db, {
            syncPatch: applicationSyncPatch,
            linkedApplicationId: linkedApplication.id,
          });
          if (!conflictCheck.ok) {
            return jsonBadRequest(res, conflictCheck.message);
          }
        } else {
          applicationSyncSkipped = true;
        }
      }

      const passwordChanged = !!row.password;
      const { data, error } = await ctx.db
        .from('ambassadors')
        .update(row)
        .eq('id', ambassadorId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      if (passwordChanged) {
        await revokeAllAmbassadorSessions(ctx.db, ambassadorId, 'admin_password_reset').catch(() => {});
      }

      let syncedApplicationId = null;
      let syncedApplicationFields = [];
      if (linkedApplication && syncFieldKeys.length > 0) {
        syncedApplicationFields = syncFieldKeys;
        const appUpdatePayload = {
          ...applicationSyncPatch,
          updated_at: new Date().toISOString(),
        };
        const appResult = await ctx.db
          .from('ambassador_applications')
          .update(appUpdatePayload)
          .eq('id', linkedApplication.id)
          .select('id')
          .single();

        if (appResult.error) {
          console.error(
            'ambassador PATCH: application sync failed after ambassador update:',
            appResult.error.message,
          );
          if (isPostgresUniqueViolation(appResult.error)) {
            return res.status(400).json({
              error:
                'Ambassador was updated but the linked application could not be synced due to a duplicate email or phone number',
            });
          }
          return res.status(500).json({
            error: 'Ambassador was updated but failed to sync linked application',
            details: 'Please verify the application record or retry the update',
          });
        }
        syncedApplicationId = linkedApplication.id;
      }

      const auditDetails = {
        fields: Object.keys(row),
        passwordChanged,
      };
      if (syncedApplicationId) {
        auditDetails.syncedApplicationId = syncedApplicationId;
        auditDetails.syncedApplicationFields = syncedApplicationFields;
      } else if (applicationSyncSkipped && syncFieldKeys.length > 0) {
        auditDetails.applicationSyncSkipped = true;
      }

      await writeAdminMutationAudit(ctx.db, {
        admin: ctx.auth.admin,
        action: 'ambassador.updated',
        targetType: 'ambassador',
        targetId: ambassadorId,
        details: auditDetails,
      });
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

  const SELECTION_COLS =
    'id, name, status, created_at, updated_at, created_by_admin_id, created_by_name';
  const ITEM_COLS = 'id, selection_id, application_id, added_at, added_by_admin_id, added_by_name';

  if (path === '/api/admin/application-selections' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.APPLICATIONS);
    if (!ctx) return true;
    const includeArchived =
      new URL(req.url, 'http://local').searchParams.get('include_archived') === '1';
    let query = ctx.db
      .from('ambassador_application_selections')
      .select(`${SELECTION_COLS}, ambassador_application_selection_items(count)`)
      .order('created_at', { ascending: false });
    if (!includeArchived) {
      query = query.eq('status', 'draft');
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const mapped = (data || []).map((row) => {
      const rawItems = row.ambassador_application_selection_items;
      let item_count = 0;
      if (Array.isArray(rawItems) && rawItems[0] && typeof rawItems[0] === 'object') {
        item_count = rawItems[0].count ?? 0;
      } else if (rawItems && typeof rawItems === 'object' && 'count' in rawItems) {
        item_count = rawItems.count ?? 0;
      }
      const { ambassador_application_selection_items: _items, ...rest } = row;
      return { ...rest, item_count };
    });
    return res.status(200).json({ data: mapped });
  }

  if (path === '/api/admin/application-selections' && method === 'POST') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.APPLICATIONS);
    if (!ctx) return true;
    const body = await parseBody(req);
    if (rejectUnexpectedFields(res, body, ['name'])) return true;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return jsonBadRequest(res, 'name is required');
    const { data, error } = await ctx.db
      .from('ambassador_application_selections')
      .insert({
        name,
        status: 'draft',
        created_by_admin_id: ctx.auth.admin?.id ?? null,
        created_by_name: ctx.auth.admin?.name ?? null,
      })
      .select(SELECTION_COLS)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data: { ...data, item_count: 0 } });
  }

  const selectionId = matchId(path, '/api/admin/application-selections/');
  if (selectionId && method === 'PATCH') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.APPLICATIONS);
    if (!ctx) return true;
    const body = await parseBody(req);
    if (rejectUnexpectedFields(res, body, APPLICATION_SELECTION_WRITABLE_FIELDS)) return true;
    const patch = pickAllowedFields(body, APPLICATION_SELECTION_WRITABLE_FIELDS);
    if (patch.name != null) patch.name = String(patch.name).trim();
    if (patch.status != null && !['draft', 'archived'].includes(patch.status)) {
      return jsonBadRequest(res, 'status must be draft or archived');
    }
    if (Object.keys(patch).length === 0) {
      return jsonBadRequest(res, 'No valid fields to update');
    }
    const { data, error } = await ctx.db
      .from('ambassador_application_selections')
      .update(patch)
      .eq('id', selectionId)
      .select(SELECTION_COLS)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (path === '/api/admin/application-selection-items' && method === 'GET') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.APPLICATIONS);
    if (!ctx) return true;
    const selectionIdParam = new URL(req.url, 'http://local').searchParams.get('selection_id');
    if (!selectionIdParam) {
      return res.status(400).json({ error: 'selection_id query parameter is required' });
    }
    const { data, error } = await ctx.db
      .from('ambassador_application_selection_items')
      .select(ITEM_COLS)
      .eq('selection_id', selectionIdParam)
      .order('added_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  if (path === '/api/admin/application-selection-items' && method === 'POST') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.APPLICATIONS);
    if (!ctx) return true;
    const body = await parseBody(req);
    if (rejectUnexpectedFields(res, body, APPLICATION_SELECTION_ITEM_BULK_FIELDS)) return true;
    const selection_id = body.selection_id;
    const application_ids = Array.isArray(body.application_ids) ? body.application_ids : [];
    if (!selection_id || application_ids.length === 0) {
      return jsonBadRequest(res, 'selection_id and application_ids are required');
    }

    const { data: existingRows, error: existingError } = await ctx.db
      .from('ambassador_application_selection_items')
      .select('application_id')
      .eq('selection_id', selection_id)
      .in('application_id', application_ids);
    if (existingError) return res.status(500).json({ error: existingError.message });

    const existingIds = new Set((existingRows || []).map((r) => r.application_id));
    const newIds = application_ids.filter((id) => !existingIds.has(id));
    const skipped = application_ids.length - newIds.length;

    if (newIds.length === 0) {
      return res.status(200).json({ data: [], added: 0, skipped });
    }

    const rows = newIds.map((application_id) => ({
      selection_id,
      application_id,
      added_by_admin_id: ctx.auth.admin?.id ?? null,
      added_by_name: ctx.auth.admin?.name ?? null,
    }));

    const { data, error } = await ctx.db
      .from('ambassador_application_selection_items')
      .insert(rows)
      .select(ITEM_COLS);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data: data || [], added: (data || []).length, skipped });
  }

  if (path === '/api/admin/application-selection-items/remove' && method === 'POST') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.APPLICATIONS);
    if (!ctx) return true;
    const body = await parseBody(req);
    if (rejectUnexpectedFields(res, body, APPLICATION_SELECTION_ITEM_REMOVE_BULK_FIELDS)) return true;
    const selection_id = body.selection_id;
    const application_ids = Array.isArray(body.application_ids) ? body.application_ids : [];
    if (!selection_id || application_ids.length === 0) {
      return jsonBadRequest(res, 'selection_id and application_ids are required');
    }
    const { error } = await ctx.db
      .from('ambassador_application_selection_items')
      .delete()
      .eq('selection_id', selection_id)
      .in('application_id', application_ids);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, removed: application_ids.length });
  }

  const selectionItemAppId = (() => {
    const m = path.match(/^\/api\/admin\/application-selection-items\/([^/]+)$/);
    return m ? m[1] : null;
  })();
  if (selectionItemAppId && method === 'DELETE') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, PERM.APPLICATIONS);
    if (!ctx) return true;
    const selection_id = new URL(req.url, 'http://local').searchParams.get('selection_id');
    if (!selection_id) {
      return res.status(400).json({ error: 'selection_id query parameter is required' });
    }
    const { error } = await ctx.db
      .from('ambassador_application_selection_items')
      .delete()
      .eq('selection_id', selection_id)
      .eq('application_id', selectionItemAppId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (path === '/api/admin/change-password' && method === 'POST') {
    const ctx = await requireAdmin(req, res, verifyAdminAuth, null, { skipPasswordChangeGate: true });
    if (!ctx) return true;
    const body = await parseBody(req);
    if (rejectUnexpectedFields(res, body, ['currentPassword', 'newPassword'])) return true;
    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword;
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      return jsonBadRequest(res, 'currentPassword and newPassword (min 8 chars) are required');
    }
    const { data: adminRow, error: loadError } = await ctx.db
      .from('admins')
      .select('id, password, session_version')
      .eq('id', ctx.auth.admin.id)
      .single();
    if (loadError || !adminRow) {
      return res.status(401).json({ error: 'Admin not found' });
    }
    const bcrypt = (await import('bcryptjs')).default;
    const ok = await bcrypt.compare(String(currentPassword), adminRow.password);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hashed = await bcrypt.hash(String(newPassword), 10);
    const nextVersion = (adminRow.session_version ?? 1) + 1;
    const { error: updateError } = await ctx.db
      .from('admins')
      .update({
        password: hashed,
        requires_password_change: false,
        session_version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.auth.admin.id);
    if (updateError) return res.status(500).json({ error: updateError.message });

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    const token = jwt.default.sign(
      {
        id: ctx.auth.admin.id,
        email: ctx.auth.admin.email,
        role: ctx.auth.admin.role,
        session_version: nextVersion,
      },
      jwtSecret,
      { expiresIn: '5h' },
    );
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL === '1' ||
      !!process.env.VERCEL_URL;
    const cookieParts = [
      `adminToken=${token}`,
      'HttpOnly',
      'Path=/',
      'Max-Age=18000',
      isProduction ? 'Secure' : '',
      'SameSite=Lax',
    ].filter(Boolean);
    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieParts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
    }
    res.setHeader('Set-Cookie', cookieParts.join('; '));
    return res.status(200).json({ success: true, requiresPasswordChange: false });
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

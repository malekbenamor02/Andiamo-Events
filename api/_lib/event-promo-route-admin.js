/**
 * Admin event promo codes API (paths under /api/admin/event-promo/codes)
 */
import '../../lib/sentry-server.js';
import { verifyAdminAuth, effectivePermissionDenied } from './admin-verify.js';
import { normalizeEventPromoCode, EVENT_PROMO_CODE_MAX_LEN } from './event-promo-code.js';
import { validateEventPromoPassDiscounts } from './event-promo-discount.js';
import { pickRandomPromoBadgeColor } from './event-promo-badge-color.js';
import {
  eventPromoDisplayCode,
  hashEventPromoCode,
  requireEventPromoPepperOr503,
} from './event-promo-hash.js';
import { createAdminDbClient } from './service-role-client.js';
import { writeAdminMutationAudit } from './admin-mutation-audit.js';

function getPathname(req) {
  const raw = String(req.url || req.path || '');
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).pathname || '/';
    } catch {
      return '/';
    }
  }
  return raw.split('?')[0] || '';
}

async function makeDb(res) {
  return createAdminDbClient(res);
}

function requireEventsManage(auth, res) {
  const denied = effectivePermissionDenied(auth, 'events:manage');
  if (denied) {
    res.status(denied.statusCode).json(denied);
    return false;
  }
  return true;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk.toString();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getQueryParam(req, name) {
  const raw = String(req.url || '');
  try {
    const base = /^https?:\/\//i.test(raw) ? raw : `http://localhost${raw.startsWith('/') ? raw : `/${raw}`}`;
    return new URL(base).searchParams.get(name);
  } catch {
    return null;
  }
}

async function attachPassDiscountsToCodes(db, codes) {
  const list = codes || [];
  if (!list.length) return list;
  const ids = list.map((c) => c.id);
  const { data: rows, error } = await db
    .from('event_promo_code_pass_discounts')
    .select('promo_code_id, event_pass_id, discount_type, discount_value, event_passes(name)')
    .in('promo_code_id', ids);
  if (error) {
    console.error('event_promo_code_pass_discounts list', error);
    return list.map((c) => ({ ...c, pass_discounts: [] }));
  }
  const byCode = Object.create(null);
  for (const row of rows || []) {
    const cid = String(row.promo_code_id);
    if (!byCode[cid]) byCode[cid] = [];
    const passName =
      row.event_passes && typeof row.event_passes === 'object' && row.event_passes.name != null
        ? String(row.event_passes.name)
        : null;
    byCode[cid].push({
      event_pass_id: row.event_pass_id,
      pass_name: passName,
      discount_type: row.discount_type,
      discount_value: row.discount_value != null ? Number(row.discount_value) : 0,
    });
  }
  return list.map((c) => ({
    ...mapAdminPromoRow(c),
    pass_discounts: byCode[String(c.id)] || [],
  }));
}

function mapAdminPromoRow(c) {
  if (!c) return c;
  return {
    ...c,
    code: eventPromoDisplayCode(c),
  };
}

async function replacePassDiscounts(db, promoCodeId, rows) {
  const { error: delErr } = await db
    .from('event_promo_code_pass_discounts')
    .delete()
    .eq('promo_code_id', promoCodeId);
  if (delErr) return delErr.message;
  if (!rows.length) return null;
  const now = new Date().toISOString();
  const insertRows = rows.map((r) => ({
    promo_code_id: promoCodeId,
    event_pass_id: r.event_pass_id,
    discount_type: r.discount_type,
    discount_value: r.discount_value,
    updated_at: now,
  }));
  const { error: insErr } = await db.from('event_promo_code_pass_discounts').insert(insertRows);
  return insErr ? insErr.message : null;
}

async function pickBadgeColorForEvent(db, eventId) {
  const { data } = await db
    .from('event_promo_codes')
    .select('badge_color')
    .eq('event_id', eventId)
    .is('revoked_at', null);
  return pickRandomPromoBadgeColor((data || []).map((r) => r.badge_color));
}

export async function handleEventPromoAdminCodes(req, res) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.valid) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'Unauthorized' });
    }
    if (!requireEventsManage(auth, res)) return;

    const path = getPathname(req);
    const method = req.method;
    const db = await makeDb(res);
    if (!db) return;

    if (method === 'GET' && path === '/api/admin/event-promo/codes') {
      const eventId = getQueryParam(req, 'eventId');
      if (!eventId) return res.status(400).json({ error: 'eventId required' });
      const { data, error } = await db
        .from('event_promo_codes')
        .select(
          'id, label, badge_color, discount_mode, discount_type, discount_value, applies_to_all, max_uses, used_count, is_active, revoked_at, created_at, updated_at'
        )
        .eq('event_id', eventId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      const enriched = await attachPassDiscountsToCodes(db, data || []);
      return res.status(200).json({ success: true, codes: enriched });
    }

    if (method === 'POST' && path === '/api/admin/event-promo/codes') {
      if (!requireEventPromoPepperOr503(res)) return;
      const body = await readJsonBody(req);
      const {
        eventId,
        code,
        discount_mode: discountModeRaw,
        discount_type,
        discount_value,
        pass_discounts,
        max_uses,
      } = body;

      if (!eventId) return res.status(400).json({ error: 'eventId required' });
      const normalized = normalizeEventPromoCode(code);
      if (!normalized) return res.status(400).json({ error: 'Invalid promo code (A-Z, 0-9 only)' });

      const maxUses = parseInt(max_uses, 10);
      if (!Number.isFinite(maxUses) || maxUses < 1) {
        return res.status(400).json({ error: 'max_uses must be at least 1' });
      }

      const discount_mode = discountModeRaw === 'per_pass' ? 'per_pass' : 'uniform';
      let rowDiscountType = 'percent';
      let rowDiscountValue = 0;
      let passDiscountRows = [];

      if (discount_mode === 'per_pass') {
        const validated = await validateEventPromoPassDiscounts(pass_discounts, eventId, db);
        if (!validated.ok) return res.status(400).json({ error: validated.error });
        passDiscountRows = validated.rows;
        if (!passDiscountRows.length) {
          return res.status(400).json({ error: 'At least one pass discount is required for per_pass mode' });
        }
      } else {
        const dv = Number(discount_value);
        if (!Number.isFinite(dv) || dv <= 0) {
          return res.status(400).json({ error: 'discount_value must be greater than 0' });
        }
        rowDiscountType = discount_type === 'fixed' ? 'fixed' : 'percent';
        rowDiscountValue = dv;
        if (rowDiscountType === 'percent' && rowDiscountValue > 100) {
          return res.status(400).json({ error: 'Percent discount cannot exceed 100' });
        }
      }

      const label = normalized.slice(0, EVENT_PROMO_CODE_MAX_LEN);
      const code_hash = hashEventPromoCode(eventId, label);

      const { data: dup } = await db
        .from('event_promo_codes')
        .select('id')
        .eq('event_id', eventId)
        .eq('code_hash', code_hash)
        .is('revoked_at', null)
        .maybeSingle();
      if (dup) {
        return res.status(400).json({ error: 'A promo code with this value already exists for this event' });
      }

      const row = {
        event_id: eventId,
        label,
        code_hash,
        badge_color: await pickBadgeColorForEvent(db, eventId),
        discount_mode,
        discount_type: rowDiscountType,
        discount_value: rowDiscountValue,
        applies_to_all: true,
        max_uses: maxUses,
        created_by: auth.admin.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await db
        .from('event_promo_codes')
        .insert(row)
        .select('id, label, badge_color')
        .single();
      if (error) return res.status(400).json({ error: error.message });

      if (data?.id && discount_mode === 'per_pass') {
        const scopeErr = await replacePassDiscounts(db, data.id, passDiscountRows);
        if (scopeErr) return res.status(500).json({ error: scopeErr });
      }

      await writeAdminMutationAudit(db, {
        admin: auth.admin,
        action: 'event_promo.code.created',
        targetType: 'event_promo_code',
        targetId: data.id,
        details: { eventId, label },
      });

      return res.status(201).json({ success: true, promoCode: mapAdminPromoRow(data) });
    }

    const idRouteM = path.match(/^\/api\/admin\/event-promo\/codes\/([^/]+)$/);
    const discountsM = path.match(/^\/api\/admin\/event-promo\/codes\/([^/]+)\/discounts$/);

    if (method === 'POST' && discountsM) {
      const codeId = discountsM[1];
      const body = await readJsonBody(req);
      const discount_mode = body.discount_mode === 'per_pass' ? 'per_pass' : 'uniform';
      const { data: existing, error: exErr } = await db
        .from('event_promo_codes')
        .select('id, event_id, used_count, revoked_at')
        .eq('id', codeId)
        .is('revoked_at', null)
        .maybeSingle();
      if (exErr || !existing) return res.status(404).json({ error: 'Not found' });
      if (Number(existing.used_count) > 0) {
        return res.status(400).json({ error: 'Cannot change discounts after redemptions' });
      }

      let updatePayload = {
        discount_mode,
        applies_to_all: true,
        updated_at: new Date().toISOString(),
      };
      let passDiscountRows = [];

      if (discount_mode === 'per_pass') {
        const validated = await validateEventPromoPassDiscounts(
          body.pass_discounts,
          existing.event_id,
          db
        );
        if (!validated.ok) return res.status(400).json({ error: validated.error });
        passDiscountRows = validated.rows;
        if (!passDiscountRows.length) {
          return res.status(400).json({ error: 'At least one pass discount is required' });
        }
        updatePayload.discount_type = 'percent';
        updatePayload.discount_value = 0;
      } else {
        const dv = Number(body.discount_value);
        if (!Number.isFinite(dv) || dv <= 0) {
          return res.status(400).json({ error: 'discount_value must be greater than 0' });
        }
        updatePayload.discount_type = body.discount_type === 'fixed' ? 'fixed' : 'percent';
        updatePayload.discount_value = dv;
        if (updatePayload.discount_type === 'percent' && dv > 100) {
          return res.status(400).json({ error: 'Percent discount cannot exceed 100' });
        }
      }

      const { error: upErr } = await db.from('event_promo_codes').update(updatePayload).eq('id', codeId);
      if (upErr) return res.status(400).json({ error: upErr.message });

      await db.from('event_promo_code_passes').delete().eq('promo_code_id', codeId);
      if (discount_mode === 'per_pass') {
        const passErr = await replacePassDiscounts(db, codeId, passDiscountRows);
        if (passErr) return res.status(400).json({ error: passErr });
      } else {
        await db.from('event_promo_code_pass_discounts').delete().eq('promo_code_id', codeId);
      }

      await writeAdminMutationAudit(db, {
        admin: auth.admin,
        action: 'event_promo.code.discounts_updated',
        targetType: 'event_promo_code',
        targetId: codeId,
        details: { discount_mode },
      });

      return res.status(200).json({ success: true });
    }

    if (method === 'PATCH' && idRouteM) {
      const codeId = idRouteM[1];
      const body = await readJsonBody(req);
      const { data: existing, error: exErr } = await db
        .from('event_promo_codes')
        .select('*')
        .eq('id', codeId)
        .is('revoked_at', null)
        .maybeSingle();
      if (exErr || !existing) return res.status(404).json({ error: 'Not found' });

      const update = { updated_at: new Date().toISOString() };

      if (body.is_active !== undefined) {
        update.is_active = !!body.is_active;
      }

      if (body.max_uses != null) {
        const maxUses = parseInt(body.max_uses, 10);
        if (!Number.isFinite(maxUses) || maxUses < 1) {
          return res.status(400).json({ error: 'max_uses must be at least 1' });
        }
        if (maxUses < Number(existing.used_count)) {
          return res.status(400).json({ error: 'max_uses cannot be less than used_count' });
        }
        update.max_uses = maxUses;
      }

      const { data, error } = await db
        .from('event_promo_codes')
        .update(update)
        .eq('id', codeId)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      const enriched = await attachPassDiscountsToCodes(db, [data]);
      await writeAdminMutationAudit(db, {
        admin: auth.admin,
        action: 'event_promo.code.updated',
        targetType: 'event_promo_code',
        targetId: codeId,
        details: { fields: Object.keys(update) },
      });
      return res.status(200).json({ success: true, promoCode: mapAdminPromoRow(enriched[0]) });
    }

    if (method === 'DELETE' && idRouteM) {
      const codeId = idRouteM[1];
      const { error } = await db
        .from('event_promo_codes')
        .update({
          revoked_at: new Date().toISOString(),
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', codeId)
        .is('revoked_at', null);
      if (error) return res.status(400).json({ error: error.message });
      await writeAdminMutationAudit(db, {
        admin: auth.admin,
        action: 'event_promo.code.revoked',
        targetType: 'event_promo_code',
        targetId: codeId,
        details: {},
      });
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    console.error('handleEventPromoAdminCodes', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

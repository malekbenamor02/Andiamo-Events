/**
 * Admin presale codes API (paths under /api/admin/presale/codes)
 */
import '../../lib/sentry-server.js';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth, hasPermission } from './admin-verify.js';
import { hashPresaleCode, requirePresalePepperOr503 } from './presale-server.js';
import { validateAdminPassDiscounts } from './presale-discount.js';

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

function makeDb() {
  const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : s;
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

/** When unlock cap is set, order cap must not exceed it (orders require a prior unlock). */
function presaleCapsOrderError(maxOrders, maxUnlocks) {
  if (maxUnlocks != null && maxOrders > maxUnlocks) {
    return 'max_total_redemptions cannot exceed max_total_unlocks';
  }
  return null;
}

async function attachPassDiscountsToCodes(db, codes) {
  const list = codes || [];
  if (!list.length) return list;
  const ids = list.map((c) => c.id);
  const { data: passRows, error } = await db
    .from('presale_code_pass_discounts')
    .select('presale_code_id, event_pass_id, discount_type, discount_value, event_passes(name)')
    .in('presale_code_id', ids);
  if (error) {
    console.error('presale_code_pass_discounts list', error);
    return list.map((c) => ({ ...c, pass_discounts: [] }));
  }
  const byCode = Object.create(null);
  for (const row of passRows || []) {
    const cid = String(row.presale_code_id);
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
    ...c,
    pass_discounts: byCode[String(c.id)] || [],
  }));
}

async function replacePassDiscounts(db, codeId, rows) {
  const { error: delErr } = await db
    .from('presale_code_pass_discounts')
    .delete()
    .eq('presale_code_id', codeId);
  if (delErr) return delErr.message;
  if (!rows.length) return null;
  const now = new Date().toISOString();
  const insertRows = rows.map((r) => ({
    presale_code_id: codeId,
    event_pass_id: r.event_pass_id,
    discount_type: r.discount_type,
    discount_value: r.discount_value,
    updated_at: now,
  }));
  const { error: insErr } = await db.from('presale_code_pass_discounts').insert(insertRows);
  return insErr ? insErr.message : null;
}

export async function handlePresaleAdminCodes(req, res) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.valid) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'Unauthorized' });
    }
    if (!hasPermission(auth.admin?.role, 'presale:manage')) {
      return res.status(403).json({ error: 'Forbidden', details: 'Permission required: presale:manage' });
    }

    const path = getPathname(req);
    const method = req.method;
    const db = makeDb();

    if (method === 'GET' && path === '/api/admin/presale/codes') {
      const q = /^https?:\/\//i.test(String(req.url || ''))
        ? new URL(String(req.url)).searchParams.get('eventId')
        : new URL(String(req.url || ''), 'http://localhost').searchParams.get('eventId');
      if (!q) return res.status(400).json({ error: 'eventId required' });
      const { data, error } = await db
        .from('presale_codes')
        .select(
          'id, label, usage_mode, discount_mode, discount_type, discount_value, max_total_redemptions, max_total_unlocks, redemption_count, successful_order_count, active_from, active_until, paused_at, revoked_at, created_at'
        )
        .eq('event_id', q)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      const enriched = await attachPassDiscountsToCodes(db, data || []);
      return res.status(200).json({ success: true, codes: enriched });
    }

    if (method === 'POST' && path === '/api/admin/presale/codes') {
      const body = await readJsonBody(req);
      const {
        eventId,
        code,
        discount_mode: discountModeRaw,
        discount_type,
        discount_value,
        pass_discounts,
        max_total_redemptions,
        max_total_unlocks,
        active_from,
        active_until,
      } = body;
      if (!eventId || !code || typeof code !== 'string' || !String(code).trim()) {
        return res.status(400).json({ error: 'eventId and code required' });
      }
      const discount_mode = discountModeRaw === 'per_pass' ? 'per_pass' : 'uniform';
      const maxR = parseInt(max_total_redemptions, 10);
      if (!Number.isFinite(maxR) || maxR < 1) {
        return res.status(400).json({ error: 'max_total_redemptions is required and must be at least 1' });
      }
      let maxUnlocks = null;
      if (max_total_unlocks != null && String(max_total_unlocks).trim() !== '') {
        const parsedUnlocks = parseInt(max_total_unlocks, 10);
        if (!Number.isFinite(parsedUnlocks) || parsedUnlocks < 1) {
          return res.status(400).json({ error: 'max_total_unlocks must be an integer at least 1 when provided' });
        }
        maxUnlocks = parsedUnlocks;
      }
      const capsErr = presaleCapsOrderError(maxR, maxUnlocks);
      if (capsErr) return res.status(400).json({ error: capsErr });

      let rowDiscountType = 'percent';
      let rowDiscountValue = 0;
      let passDiscountRows = [];

      if (discount_mode === 'per_pass') {
        const validated = await validateAdminPassDiscounts(pass_discounts, eventId, db);
        if (!validated.ok) return res.status(400).json({ error: validated.error });
        passDiscountRows = validated.rows;
      } else {
        const dv = Number(discount_value);
        if (!Number.isFinite(dv) || dv < 0) {
          return res.status(400).json({ error: 'discount_value must be a number >= 0 (0 = no discount)' });
        }
        rowDiscountType = discount_type === 'fixed' ? 'fixed' : 'percent';
        rowDiscountValue = dv;
      }

      if (!requirePresalePepperOr503(res)) return;
      const code_hash = hashPresaleCode(eventId, code);
      const row = {
        event_id: eventId,
        code_hash,
        label: String(code).trim().slice(0, 128),
        usage_mode: 'multi_use',
        discount_mode,
        discount_type: rowDiscountType,
        discount_value: rowDiscountValue,
        max_total_redemptions: maxR,
        max_total_unlocks: maxUnlocks,
        created_by: auth.admin.id,
        updated_at: new Date().toISOString(),
      };
      if (active_from) row.active_from = active_from;
      if (active_until) row.active_until = active_until;
      const { data, error } = await db.from('presale_codes').insert(row).select('id, label').single();
      if (error) return res.status(400).json({ error: error.message });
      const id = data && data.id != null ? data.id : null;
      if (id && discount_mode === 'per_pass' && passDiscountRows.length) {
        const passErr = await replacePassDiscounts(db, id, passDiscountRows);
        if (passErr) return res.status(400).json({ error: passErr });
      }
      const returnedLabel = data && data.label != null ? String(data.label).trim() : '';
      if (id && !returnedLabel && row.label) {
        const { error: repairErr } = await db
          .from('presale_codes')
          .update({ label: row.label, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (repairErr) {
          console.error('presale_codes insert label repair failed', repairErr);
        }
      }
      return res.status(200).json({
        success: true,
        id,
        label: row.label,
      });
    }

    const discountsM = path.match(/^\/api\/admin\/presale\/codes\/([^/]+)\/discounts$/);
    if (method === 'POST' && discountsM) {
      const codeId = discountsM[1];
      const body = await readJsonBody(req);
      const discount_mode = body.discount_mode === 'per_pass' ? 'per_pass' : 'uniform';
      const { data: codeRow, error: codeErr } = await db
        .from('presale_codes')
        .select('id, event_id, revoked_at')
        .eq('id', codeId)
        .maybeSingle();
      if (codeErr || !codeRow || codeRow.revoked_at) {
        return res.status(404).json({ error: 'Code not found' });
      }

      let updatePayload = {
        discount_mode,
        updated_at: new Date().toISOString(),
      };
      let passDiscountRows = [];

      if (discount_mode === 'per_pass') {
        const validated = await validateAdminPassDiscounts(
          body.pass_discounts,
          codeRow.event_id,
          db
        );
        if (!validated.ok) return res.status(400).json({ error: validated.error });
        passDiscountRows = validated.rows;
        updatePayload.discount_type = 'percent';
        updatePayload.discount_value = 0;
      } else {
        const dv = Number(body.discount_value);
        if (!Number.isFinite(dv) || dv < 0) {
          return res.status(400).json({ error: 'discount_value must be a number >= 0 (0 = no discount)' });
        }
        updatePayload.discount_type = body.discount_type === 'fixed' ? 'fixed' : 'percent';
        updatePayload.discount_value = dv;
      }

      const { error: upErr } = await db.from('presale_codes').update(updatePayload).eq('id', codeId);
      if (upErr) return res.status(400).json({ error: upErr.message });

      if (discount_mode === 'per_pass') {
        const passErr = await replacePassDiscounts(db, codeId, passDiscountRows);
        if (passErr) return res.status(400).json({ error: passErr });
      } else {
        await db.from('presale_code_pass_discounts').delete().eq('presale_code_id', codeId);
      }

      return res.status(200).json({ success: true });
    }

    const maxRedM = path.match(/^\/api\/admin\/presale\/codes\/([^/]+)\/max-redemptions$/);
    if (method === 'POST' && maxRedM) {
      const codeId = maxRedM[1];
      const body = await readJsonBody(req);
      const maxR = parseInt(body.max_total_redemptions, 10);
      if (!Number.isFinite(maxR) || maxR < 1) {
        return res.status(400).json({ error: 'max_total_redemptions must be an integer at least 1' });
      }
      const { data: row, error: rowErr } = await db
        .from('presale_codes')
        .select('id, successful_order_count, max_total_unlocks, revoked_at')
        .eq('id', codeId)
        .maybeSingle();
      if (rowErr || !row || row.revoked_at) return res.status(404).json({ error: 'Code not found' });
      const used = row.successful_order_count || 0;
      if (maxR < used) {
        return res.status(400).json({
          error: `max_total_redemptions must be at least current successful orders (${used})`,
        });
      }
      const capsErr = presaleCapsOrderError(maxR, row.max_total_unlocks);
      if (capsErr) return res.status(400).json({ error: capsErr });
      const { error: upErr } = await db
        .from('presale_codes')
        .update({ max_total_redemptions: maxR, updated_at: new Date().toISOString() })
        .eq('id', codeId);
      if (upErr) return res.status(400).json({ error: upErr.message });
      return res.status(200).json({ success: true });
    }

    const maxUnlockM = path.match(/^\/api\/admin\/presale\/codes\/([^/]+)\/max-unlocks$/);
    if (method === 'POST' && maxUnlockM) {
      const codeId = maxUnlockM[1];
      const body = await readJsonBody(req);
      const rawUnlocks = body.max_total_unlocks;
      let maxUnlocks = null;
      if (rawUnlocks != null && String(rawUnlocks).trim() !== '') {
        const parsedUnlocks = parseInt(rawUnlocks, 10);
        if (!Number.isFinite(parsedUnlocks) || parsedUnlocks < 1) {
          return res.status(400).json({ error: 'max_total_unlocks must be an integer at least 1 when provided' });
        }
        maxUnlocks = parsedUnlocks;
      }
      const { data: row, error: rowErr } = await db
        .from('presale_codes')
        .select('id, redemption_count, max_total_redemptions, revoked_at')
        .eq('id', codeId)
        .maybeSingle();
      if (rowErr || !row || row.revoked_at) return res.status(404).json({ error: 'Code not found' });
      const usedUnlocks = row.redemption_count || 0;
      if (maxUnlocks != null && maxUnlocks < usedUnlocks) {
        return res.status(400).json({
          error: `max_total_unlocks must be at least current unlocks (${usedUnlocks})`,
        });
      }
      const capsErr = presaleCapsOrderError(row.max_total_redemptions, maxUnlocks);
      if (capsErr) return res.status(400).json({ error: capsErr });
      const { error: upErr } = await db
        .from('presale_codes')
        .update({ max_total_unlocks: maxUnlocks, updated_at: new Date().toISOString() })
        .eq('id', codeId);
      if (upErr) return res.status(400).json({ error: upErr.message });
      return res.status(200).json({ success: true });
    }

    const pauseM = path.match(/^\/api\/admin\/presale\/codes\/([^/]+)\/pause$/);
    if (method === 'POST' && pauseM) {
      const id = pauseM[1];
      const { error } = await db
        .from('presale_codes')
        .update({ paused_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .is('revoked_at', null);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    const unpauseM = path.match(/^\/api\/admin\/presale\/codes\/([^/]+)\/unpause$/);
    if (method === 'POST' && unpauseM) {
      const id = unpauseM[1];
      const { error } = await db
        .from('presale_codes')
        .update({ paused_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .is('revoked_at', null);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    console.error('presale-admin-codes', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

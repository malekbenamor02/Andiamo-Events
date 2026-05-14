/**
 * Admin presale codes API (paths under /api/admin/presale/codes)
 */
import '../../lib/sentry-server.js';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from './admin-verify.js';
import { hashPresaleCode, requirePresalePepperOr503 } from './presale-server.js';

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

export async function handlePresaleAdminCodes(req, res) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.valid) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'Unauthorized' });
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
          'id, label, usage_mode, discount_type, discount_value, max_total_redemptions, redemption_count, successful_order_count, active_from, active_until, paused_at, revoked_at, created_at'
        )
        .eq('event_id', q)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      const codes = data || [];
      /** Successful presale redeem (code accepted, session created) per code id */
      const unlockCountByCodeId = Object.create(null);
      const PAGE = 1000;
      let from = 0;
      for (;;) {
        const { data: attemptRows, error: attErr } = await db
          .from('presale_code_attempts')
          .select('presale_code_id')
          .eq('event_id', q)
          .eq('success', true)
          .not('presale_code_id', 'is', null)
          .range(from, from + PAGE - 1);
        if (attErr) {
          console.error('presale_code_attempts admin aggregate', attErr);
          return res.status(500).json({ error: attErr.message });
        }
        const batch = attemptRows || [];
        for (const row of batch) {
          const cid = row.presale_code_id != null ? String(row.presale_code_id) : '';
          if (cid) unlockCountByCodeId[cid] = (unlockCountByCodeId[cid] || 0) + 1;
        }
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      const enriched = codes.map((c) => ({
        ...c,
        successful_unlock_count: unlockCountByCodeId[String(c.id)] || 0,
      }));
      return res.status(200).json({ success: true, codes: enriched });
    }

    if (method === 'POST' && path === '/api/admin/presale/codes') {
      const body = await readJsonBody(req);
      const {
        eventId,
        code,
        discount_type,
        discount_value,
        max_total_redemptions,
        active_from,
        active_until,
      } = body;
      if (!eventId || !code || typeof code !== 'string' || !String(code).trim()) {
        return res.status(400).json({ error: 'eventId and code required' });
      }
      const dv = Number(discount_value);
      if (!Number.isFinite(dv) || dv < 0) {
        return res.status(400).json({ error: 'discount_value must be a number >= 0 (0 = no discount)' });
      }
      const maxR = parseInt(max_total_redemptions, 10);
      if (!Number.isFinite(maxR) || maxR < 1) {
        return res.status(400).json({ error: 'max_total_redemptions is required and must be at least 1' });
      }
      if (!requirePresalePepperOr503(res)) return;
      const code_hash = hashPresaleCode(eventId, code);
      const row = {
        event_id: eventId,
        code_hash,
        label: String(code).trim().slice(0, 128),
        usage_mode: 'multi_use',
        discount_type: discount_type === 'fixed' ? 'fixed' : 'percent',
        discount_value: dv,
        max_total_redemptions: maxR,
        created_by: auth.admin.id,
        updated_at: new Date().toISOString(),
      };
      if (active_from) row.active_from = active_from;
      if (active_until) row.active_until = active_until;
      const { data, error } = await db.from('presale_codes').insert(row).select('id, label').single();
      if (error) return res.status(400).json({ error: error.message });
      const id = data && data.id != null ? data.id : null;
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
        .select('id, successful_order_count, revoked_at')
        .eq('id', codeId)
        .maybeSingle();
      if (rowErr || !row || row.revoked_at) return res.status(404).json({ error: 'Code not found' });
      const used = row.successful_order_count || 0;
      if (maxR < used) {
        return res.status(400).json({
          error: `max_total_redemptions must be at least current successful orders (${used})`,
        });
      }
      const { error: upErr } = await db
        .from('presale_codes')
        .update({ max_total_redemptions: maxR, updated_at: new Date().toISOString() })
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

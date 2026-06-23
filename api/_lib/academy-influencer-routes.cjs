'use strict';

const bcrypt = require('bcryptjs');
const { getServiceDb } = require('./academy-db.cjs');
const { sendTransactionalEmail } = require('./transactional-email.cjs');
const { getEmailTransporter } = require('./get-email-transporter.cjs');
const { generateTemporaryPassword, validateNewPassword } = require('./academy-influencer-password.cjs');
const { buildInfluencerInviteEmail } = require('./academy-influencer-email.cjs');
const {
  signInfluencerToken,
  setInfluencerTokenCookie,
  clearInfluencerTokenCookie,
  sanitizeInfluencerRow,
  requireAcademyInfluencerAuth,
} = require('./academy-influencer-auth.cjs');
const {
  getClientIp,
  isLoginRateLimited,
  recordFailedLogin,
  clearLoginRateLimit,
} = require('./academy-influencer-login-rate-limit.cjs');
const { writeAcademyInfluencerAudit, diffPromoAssignment } = require('./academy-influencer-audit.cjs');
const { buildInfluencerAttributionOrFilter } = require('./academy-influencer-attribution.cjs');

const ACADEMY_EMAIL_FROM = '"Andiamo Events" <contact@andiamoevents.com>';
const BCRYPT_ROUNDS = 10;
const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PENDING_STATUSES = ['pending_payment', 'pending_online', 'proof_received', 'paid_online'];
const FAILED_STATUSES = ['cancelled', 'rejected', 'failed'];

function normalizeEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function sendInfluencerInviteEmail({ fullName, email, temporaryPassword }) {
  const mail = buildInfluencerInviteEmail({ fullName, email, temporaryPassword });
  await sendTransactionalEmail(
    { getEmailTransporter },
    {
      from: ACADEMY_EMAIL_FROM,
      replyTo: ACADEMY_EMAIL_FROM,
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      transactional: true,
      messageRef: `academy-influencer-invite-${email}`,
    }
  );
}

async function loadInfluencerById(db, id) {
  const { data, error } = await db.from('academy_influencers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function loadInfluencerByEmail(db, email) {
  const { data, error } = await db
    .from('academy_influencers')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function validateInfluencerAssignment(db, influencerId, promoCodeIds, { allowExistingForInfluencerId } = {}) {
  if (!promoCodeIds?.length) return { ok: true };
  const { data: promos, error } = await db
    .from('academy_promo_codes')
    .select('id, influencer_id, code')
    .in('id', promoCodeIds);
  if (error) throw error;
  if ((promos || []).length !== promoCodeIds.length) {
    return { ok: false, error: 'One or more promo codes not found' };
  }
  for (const p of promos || []) {
    if (p.influencer_id && p.influencer_id !== allowExistingForInfluencerId) {
      return { ok: false, error: `Promo code ${p.code} is already assigned to another influencer` };
    }
  }
  if (influencerId) {
    const { data: inf } = await db
      .from('academy_influencers')
      .select('id, is_active')
      .eq('id', influencerId)
      .maybeSingle();
    if (!inf) return { ok: false, error: 'Influencer not found' };
    if (!inf.is_active) return { ok: false, error: 'Influencer is inactive' };
  }
  return { ok: true };
}

async function assignPromoCodesToInfluencer(db, influencerId, promoCodeIds) {
  if (!promoCodeIds?.length) return;
  const { error } = await db
    .from('academy_promo_codes')
    .update({ influencer_id: influencerId, updated_at: new Date().toISOString() })
    .in('id', promoCodeIds);
  if (error) throw error;
}

async function unassignAllPromoCodes(db, influencerId) {
  await db
    .from('academy_promo_codes')
    .update({ influencer_id: null, updated_at: new Date().toISOString() })
    .eq('influencer_id', influencerId);
}

async function fetchPromoCodesForInfluencers(db, influencerIds) {
  if (!influencerIds.length) return new Map();
  const { data, error } = await db
    .from('academy_promo_codes')
    .select('id, code, influencer_id, used_count, max_uses, active')
    .in('influencer_id', influencerIds);
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.influencer_id)) map.set(row.influencer_id, []);
    map.get(row.influencer_id).push(row);
  }
  return map;
}

function attachPromoCodes(influencer, promoMap) {
  const promos = promoMap.get(influencer.id) || [];
  return {
    ...sanitizeInfluencerRow(influencer),
    promo_code_count: promos.length,
    promo_codes: promos,
  };
}

const INFLUENCER_SALES_REGISTRATION_FIELDS =
  'id, registration_number, formule, status, base_amount_dt, discount_amount_dt, fee_amount_dt, total_amount_dt, promo_code_id, influencer_id_at_registration, created_at, reviewed_at';

const ADMIN_INFLUENCER_SALES_REGISTRATION_FIELDS =
  'id, registration_number, full_name, email, phone, formule, payment_method, status, base_amount_dt, discount_amount_dt, fee_amount_dt, total_amount_dt, promo_code_id, influencer_id_at_registration, created_at, reviewed_at, rejection_reason';

async function fetchPromoCodesByIds(db, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await db
    .from('academy_promo_codes')
    .select('id, code, used_count, max_uses, active, influencer_id')
    .in('id', unique);
  if (error) throw error;
  return new Map((data || []).map((p) => [p.id, p]));
}

async function buildInfluencerSalesReport(db, influencerId, { adminView = false } = {}) {
  const influencer = await loadInfluencerById(db, influencerId);
  if (!influencer) return null;

  const promoMap = await fetchPromoCodesForInfluencers(db, [influencerId]);
  const promos = promoMap.get(influencerId) || [];
  const promoIds = promos.map((p) => p.id);

  const promoStats = new Map(
    promos.map((p) => [
      p.id,
      {
        id: p.id,
        code: p.code,
        used_count: p.used_count,
        max_uses: p.max_uses,
        active: p.active,
        registrations_count: 0,
        approved_count: 0,
        approved_revenue_dt: 0,
      },
    ])
  );

  const byFormule = { essentielle: 0, pro: 0, premium: 0 };
  let approved_count = 0;
  let approved_revenue_dt = 0;
  let pending_count = 0;
  let failed_count = 0;
  let rejected_count = 0;
  let frozen_attribution_count = 0;
  let legacy_attribution_count = 0;

  const selectFields = adminView ? ADMIN_INFLUENCER_SALES_REGISTRATION_FIELDS : INFLUENCER_SALES_REGISTRATION_FIELDS;
  let regQuery = db
    .from('academy_registrations')
    .select(selectFields)
    .or(buildInfluencerAttributionOrFilter(influencerId, promoIds))
    .order('created_at', { ascending: false })
    .limit(adminView ? 1000 : 500);
  const { data: rows, error } = await regQuery;
  if (error) throw error;

  const rowPromoIds = [...new Set((rows || []).map((r) => r.promo_code_id).filter(Boolean))];
  const promoById = await fetchPromoCodesByIds(db, rowPromoIds);
  for (const p of promos) {
    if (!promoById.has(p.id)) promoById.set(p.id, p);
  }

  const registrations = (rows || []).map((r) => {
    const promo = r.promo_code_id ? promoById.get(r.promo_code_id) : null;
    const promoCode = promo?.code || null;
    const base = {
      id: r.id,
      registration_number: r.registration_number,
      formule: r.formule,
      promo_code: promoCode,
      promo_code_id: r.promo_code_id,
      influencer_id_at_registration: r.influencer_id_at_registration || null,
      attribution_source: r.influencer_id_at_registration ? 'frozen' : 'legacy_promo',
      status: r.status,
      base_amount_dt: r.base_amount_dt,
      discount_amount_dt: r.discount_amount_dt,
      fee_amount_dt: r.fee_amount_dt,
      total_amount_dt: r.total_amount_dt,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
    };
    if (adminView) {
      return {
        ...base,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
        payment_method: r.payment_method,
        rejection_reason: r.rejection_reason,
      };
    }
    return base;
  });

  for (const r of rows || []) {
    if (r.influencer_id_at_registration) frozen_attribution_count += 1;
    else legacy_attribution_count += 1;

    if (byFormule[r.formule] !== undefined) byFormule[r.formule] += 1;

    if (r.promo_code_id) {
      if (!promoStats.has(r.promo_code_id)) {
        const p = promoById.get(r.promo_code_id);
        promoStats.set(r.promo_code_id, {
          id: r.promo_code_id,
          code: p?.code || '—',
          used_count: p?.used_count ?? 0,
          max_uses: p?.max_uses ?? 0,
          active: p?.active ?? false,
          registrations_count: 0,
          approved_count: 0,
          approved_revenue_dt: 0,
        });
      }
      const ps = promoStats.get(r.promo_code_id);
      ps.registrations_count += 1;
      if (r.status === 'approved') {
        ps.approved_count += 1;
        ps.approved_revenue_dt += Number(r.total_amount_dt) || 0;
      }
    }

    if (r.status === 'approved') {
      approved_count += 1;
      approved_revenue_dt += Number(r.total_amount_dt) || 0;
    } else if (r.status === 'rejected') {
      rejected_count += 1;
      failed_count += 1;
    } else if (PENDING_STATUSES.includes(r.status)) {
      pending_count += 1;
    } else if (FAILED_STATUSES.includes(r.status)) {
      failed_count += 1;
    }
  }

  for (const ps of promoStats.values()) {
    ps.approved_revenue_dt = Number(ps.approved_revenue_dt.toFixed(3));
  }

  return {
    influencer: attachPromoCodes(influencer, promoMap),
    summary: {
      approved_count,
      approved_revenue_dt: Number(approved_revenue_dt.toFixed(3)),
      pending_count,
      failed_count,
      rejected_count,
      total_registrations: rows?.length || 0,
      frozen_attribution_count,
      legacy_attribution_count,
      by_formule: byFormule,
      promo_codes: Array.from(promoStats.values()),
    },
    registrations,
  };
}

async function issueTemporaryPasswordAndEmail(db, influencer, { updateInviteTimestamps = true } = {}) {
  const temporaryPassword = generateTemporaryPassword();
  const password_hash = await hashPassword(temporaryPassword);
  const now = new Date().toISOString();
  const patch = {
    password_hash,
    must_change_password: true,
    temp_password_expires_at: new Date(Date.now() + TEMP_PASSWORD_TTL_MS).toISOString(),
    updated_at: now,
    last_invite_sent_at: now,
  };
  if (updateInviteTimestamps && !influencer.invited_at) {
    patch.invited_at = now;
  }
  const { data, error } = await db
    .from('academy_influencers')
    .update(patch)
    .eq('id', influencer.id)
    .select('*')
    .single();
  if (error) throw error;
  await sendInfluencerInviteEmail({
    fullName: data.full_name,
    email: data.email,
    temporaryPassword,
  });
  return data;
}

function registerAcademyInfluencerRoutes(app, deps) {
  const { requireAdminAuth, requireSuperAdmin } = deps;

  // —— Admin: influencers ———————————————————————————————————————————————————

  app.get('/api/admin/academy/influencers', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const { data, error } = await db
        .from('academy_influencers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (data || []).map((r) => r.id);
      const promoMap = await fetchPromoCodesForInfluencers(db, ids);
      res.json({
        influencers: (data || []).map((row) => attachPromoCodes(row, promoMap)),
      });
    } catch (e) {
      console.error('GET /api/admin/academy/influencers', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/academy/influencers/:id/sales', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const report = await buildInfluencerSalesReport(db, req.params.id, { adminView: true });
      if (!report) return res.status(404).json({ error: 'Influencer not found' });
      res.json(report);
    } catch (e) {
      console.error('GET /api/admin/academy/influencers/:id/sales', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/academy/influencers', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    let createdId = null;
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });

      const full_name = String(req.body?.full_name || '').trim();
      const email = normalizeEmail(req.body?.email);
      const instagram_handle = req.body?.instagram_handle
        ? String(req.body.instagram_handle).trim().slice(0, 120)
        : null;
      const is_active = req.body?.is_active !== false;
      const promo_code_ids = Array.isArray(req.body?.promo_code_ids)
        ? req.body.promo_code_ids.filter(Boolean)
        : req.body?.promo_code_id
          ? [req.body.promo_code_id]
          : [];

      if (!full_name || full_name.length < 2) {
        return res.status(400).json({ error: 'full_name is required' });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email' });
      }

      const existing = await loadInfluencerByEmail(db, email);
      if (existing) return res.status(409).json({ error: 'Email already in use' });

      const assignCheck = await validateInfluencerAssignment(db, null, promo_code_ids);
      if (!assignCheck.ok) return res.status(400).json({ error: assignCheck.error });

      const temporaryPassword = generateTemporaryPassword();
      const password_hash = await hashPassword(temporaryPassword);
      const now = new Date().toISOString();

      const { data: inserted, error: insertErr } = await db
        .from('academy_influencers')
        .insert({
          full_name,
          email,
          instagram_handle,
          password_hash,
          must_change_password: true,
          is_active,
          created_by: req.admin.id,
          invited_at: now,
          last_invite_sent_at: now,
          temp_password_expires_at: new Date(Date.now() + TEMP_PASSWORD_TTL_MS).toISOString(),
        })
        .select('*')
        .single();
      if (insertErr) throw insertErr;
      createdId = inserted.id;

      if (promo_code_ids.length) {
        await assignPromoCodesToInfluencer(db, inserted.id, promo_code_ids);
      }

      let emailSendStatus = 'sent';
      try {
        await sendInfluencerInviteEmail({
          fullName: full_name,
          email,
          temporaryPassword,
        });
      } catch (mailErr) {
        console.error('Influencer invite email failed:', mailErr.message || mailErr);
        emailSendStatus = 'failed';
        await unassignAllPromoCodes(db, inserted.id);
        await db.from('academy_influencers').delete().eq('id', inserted.id);
        createdId = null;
        return res.status(502).json({
          error: 'Invitation email could not be sent. Influencer account was not created.',
          emailSendStatus: 'failed',
        });
      }

      const promoMap = await fetchPromoCodesForInfluencers(db, [inserted.id]);
      await writeAcademyInfluencerAudit(db, {
        admin: req.admin,
        action: 'academy_influencer_created',
        influencerId: inserted.id,
        influencerEmail: email,
        details: {
          is_active,
          promo_code_ids,
        },
      });
      if (promo_code_ids.length) {
        await writeAcademyInfluencerAudit(db, {
          admin: req.admin,
          action: 'academy_influencer_promo_assigned',
          influencerId: inserted.id,
          influencerEmail: email,
          details: { promo_code_ids },
        });
      }
      res.status(201).json({
        influencer: attachPromoCodes(inserted, promoMap),
        emailSendStatus,
      });
    } catch (e) {
      console.error('POST /api/admin/academy/influencers', e);
      if (createdId) {
        try {
          const db = getServiceDb();
          await unassignAllPromoCodes(db, createdId);
          await db.from('academy_influencers').delete().eq('id', createdId);
        } catch {
          /* best effort rollback */
        }
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/academy/influencers/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const influencer = await loadInfluencerById(db, req.params.id);
      if (!influencer) return res.status(404).json({ error: 'Not found' });

      const prevPromoMap = await fetchPromoCodesForInfluencers(db, [influencer.id]);
      const prevPromoIds = (prevPromoMap.get(influencer.id) || []).map((p) => p.id);
      const wasActive = influencer.is_active;

      const patch = { updated_at: new Date().toISOString() };
      if (req.body?.full_name != null) {
        const name = String(req.body.full_name).trim();
        if (name.length < 2) return res.status(400).json({ error: 'Invalid full_name' });
        patch.full_name = name;
      }
      if (req.body?.email != null) {
        const email = normalizeEmail(req.body.email);
        if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
        if (email !== influencer.email) {
          const dup = await loadInfluencerByEmail(db, email);
          if (dup && dup.id !== influencer.id) {
            return res.status(409).json({ error: 'Email already in use' });
          }
        }
        patch.email = email;
      }
      if (req.body?.instagram_handle !== undefined) {
        patch.instagram_handle = req.body.instagram_handle
          ? String(req.body.instagram_handle).trim().slice(0, 120)
          : null;
      }
      if (req.body?.is_active != null) patch.is_active = !!req.body.is_active;

      const promo_code_ids = Array.isArray(req.body?.promo_code_ids)
        ? req.body.promo_code_ids
        : undefined;
      if (promo_code_ids) {
        const assignCheck = await validateInfluencerAssignment(db, influencer.id, promo_code_ids, {
          allowExistingForInfluencerId: influencer.id,
        });
        if (!assignCheck.ok) return res.status(400).json({ error: assignCheck.error });
        await unassignAllPromoCodes(db, influencer.id);
        if (promo_code_ids.length) {
          await assignPromoCodesToInfluencer(db, influencer.id, promo_code_ids);
        }
      }

      const { data, error } = await db
        .from('academy_influencers')
        .update(patch)
        .eq('id', req.params.id)
        .select('*')
        .single();
      if (error) throw error;

      const promoMap = await fetchPromoCodesForInfluencers(db, [data.id]);

      if (req.body?.is_active != null && !!patch.is_active !== wasActive) {
        await writeAcademyInfluencerAudit(db, {
          admin: req.admin,
          action: patch.is_active ? 'academy_influencer_reactivated' : 'academy_influencer_deactivated',
          influencerId: data.id,
          influencerEmail: data.email,
          details: { is_active: patch.is_active },
        });
      }

      if (promo_code_ids !== undefined) {
        const { assigned, unassigned } = diffPromoAssignment(prevPromoIds, promo_code_ids);
        if (unassigned.length) {
          await writeAcademyInfluencerAudit(db, {
            admin: req.admin,
            action: 'academy_influencer_promo_unassigned',
            influencerId: data.id,
            influencerEmail: data.email,
            details: { promo_code_ids: unassigned },
          });
        }
        if (assigned.length) {
          await writeAcademyInfluencerAudit(db, {
            admin: req.admin,
            action: 'academy_influencer_promo_assigned',
            influencerId: data.id,
            influencerEmail: data.email,
            details: { promo_code_ids: assigned },
          });
        }
      }

      const changedFields = Object.keys(patch).filter((k) => k !== 'updated_at' && k !== 'is_active');
      if (changedFields.length) {
        await writeAcademyInfluencerAudit(db, {
          admin: req.admin,
          action: 'academy_influencer_updated',
          influencerId: data.id,
          influencerEmail: data.email,
          details: { changed_fields: changedFields },
        });
      }

      res.json({ influencer: attachPromoCodes(data, promoMap) });
    } catch (e) {
      console.error('PATCH /api/admin/academy/influencers/:id', e);
      res.status(500).json({ error: e.message });
    }
  });

  async function handlePasswordReset(req, res, { resendOnly }) {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const influencer = await loadInfluencerById(db, req.params.id);
      if (!influencer) return res.status(404).json({ error: 'Not found' });

      try {
        const updated = await issueTemporaryPasswordAndEmail(db, influencer, {
          updateInviteTimestamps: !resendOnly,
        });
        const promoMap = await fetchPromoCodesForInfluencers(db, [updated.id]);
        await writeAcademyInfluencerAudit(db, {
          admin: req.admin,
          action: resendOnly ? 'academy_influencer_invite_resent' : 'academy_influencer_password_reset',
          influencerId: updated.id,
          influencerEmail: updated.email,
          details: { resend_only: !!resendOnly },
        });
        res.json({
          success: true,
          emailSendStatus: 'sent',
          influencer: attachPromoCodes(updated, promoMap),
        });
      } catch (mailErr) {
        console.error('Influencer password reset email failed:', mailErr.message || mailErr);
        res.status(502).json({
          error: 'Could not send invitation email',
          emailSendStatus: 'failed',
        });
      }
    } catch (e) {
      console.error('influencer password reset', e);
      res.status(500).json({ error: e.message });
    }
  }

  app.post(
    '/api/admin/academy/influencers/:id/reset-password',
    requireAdminAuth,
    requireSuperAdmin,
    (req, res) => handlePasswordReset(req, res, { resendOnly: false })
  );

  app.post(
    '/api/admin/academy/influencers/:id/resend-invite',
    requireAdminAuth,
    requireSuperAdmin,
    (req, res) => handlePasswordReset(req, res, { resendOnly: true })
  );

  // —— Influencer auth ————————————————————————————————————————————————————————

  app.post('/api/academy-influencer/login', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });

      const email = normalizeEmail(req.body?.email);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const clientIp = getClientIp(req);

      if (!isValidEmail(email) || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (isLoginRateLimited(clientIp, email)) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      }

      const influencer = await loadInfluencerByEmail(db, email);
      if (!influencer || !influencer.password_hash || !influencer.is_active) {
        recordFailedLogin(clientIp, email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const ok = await bcrypt.compare(password, influencer.password_hash);
      if (!ok) {
        recordFailedLogin(clientIp, email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (
        influencer.must_change_password &&
        influencer.temp_password_expires_at &&
        new Date(influencer.temp_password_expires_at).getTime() < Date.now()
      ) {
        return res.status(403).json({
          error:
            'Your temporary password has expired. Please contact your administrator for a new invitation.',
        });
      }

      clearLoginRateLimit(clientIp, email);

      const token = signInfluencerToken({ influencerId: influencer.id, email: influencer.email });
      setInfluencerTokenCookie(req, res, token);

      await db
        .from('academy_influencers')
        .update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', influencer.id);

      res.json({
        success: true,
        profile: sanitizeInfluencerRow(influencer),
        must_change_password: !!influencer.must_change_password,
      });
    } catch (e) {
      console.error('POST /api/academy-influencer/login', e);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/academy-influencer/session', requireAcademyInfluencerAuth, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const promoMap = await fetchPromoCodesForInfluencers(db, [req.influencer.id]);
      res.json({
        profile: attachPromoCodes(req.influencer.row, promoMap),
        must_change_password: !!req.influencer.row.must_change_password,
      });
    } catch (e) {
      console.error('GET /api/academy-influencer/session', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/academy-influencer/logout', (req, res) => {
    clearInfluencerTokenCookie(req, res);
    res.json({ success: true });
  });

  app.post('/api/academy-influencer/change-password', requireAcademyInfluencerAuth, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });

      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (!newPassword) {
        return res.status(400).json({ error: 'newPassword is required' });
      }

      const strength = validateNewPassword(newPassword);
      if (!strength.ok) return res.status(400).json({ error: strength.error });

      const influencer = req.influencer.row;

      if (!influencer.must_change_password) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'currentPassword is required' });
        }
        const ok = await bcrypt.compare(currentPassword, influencer.password_hash);
        if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const password_hash = await hashPassword(newPassword);
      const now = new Date().toISOString();
      const { data, error } = await db
        .from('academy_influencers')
        .update({
          password_hash,
          must_change_password: false,
          temp_password_expires_at: null,
          password_changed_at: now,
          updated_at: now,
        })
        .eq('id', influencer.id)
        .select('*')
        .single();
      if (error) throw error;

      const token = signInfluencerToken({ influencerId: data.id, email: data.email });
      setInfluencerTokenCookie(req, res, token);

      res.json({
        success: true,
        profile: sanitizeInfluencerRow(data),
        must_change_password: false,
      });
    } catch (e) {
      console.error('POST /api/academy-influencer/change-password', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/academy-influencer/sales', requireAcademyInfluencerAuth, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const report = await buildInfluencerSalesReport(db, req.influencer.id, { adminView: false });
      if (!report) {
        return res.status(404).json({ error: 'Account not found' });
      }
      const { summary, registrations } = report;
      res.json({
        summary: {
          approved_count: summary.approved_count,
          approved_revenue_dt: summary.approved_revenue_dt,
          pending_count: summary.pending_count,
          failed_count: summary.failed_count,
          promo_codes: summary.promo_codes.map((p) => ({ id: p.id, code: p.code })),
        },
        registrations: registrations.map((r) => ({
          registration_number: r.registration_number,
          formule: r.formule,
          promo_code: r.promo_code,
          status: r.status,
          base_amount_dt: r.base_amount_dt,
          discount_amount_dt: r.discount_amount_dt,
          fee_amount_dt: r.fee_amount_dt,
          total_amount_dt: r.total_amount_dt,
          created_at: r.created_at,
          reviewed_at: r.reviewed_at,
        })),
      });
    } catch (e) {
      console.error('GET /api/academy-influencer/sales', e);
      res.status(500).json({ error: e.message });
    }
  });
}

/** Validate optional influencer_id for promo code admin routes. */
async function resolvePromoInfluencerId(db, influencerId, { existingPromoInfluencerId } = {}) {
  if (influencerId === undefined) return { ok: true, value: undefined };
  if (influencerId === null || influencerId === '') return { ok: true, value: null };
  const id = String(influencerId).trim();
  if (!id) return { ok: true, value: null };
  const { data, error } = await db
    .from('academy_influencers')
    .select('id, is_active')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: 'Influencer not found' };
  if (!data.is_active && data.id !== existingPromoInfluencerId) {
    return { ok: false, error: 'Influencer is inactive' };
  }
  return { ok: true, value: data.id };
}

module.exports = {
  registerAcademyInfluencerRoutes,
  resolvePromoInfluencerId,
  buildInfluencerSalesReport,
};

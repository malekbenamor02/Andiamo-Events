'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { computeRegistrationAmounts } = require('./api/lib/academy-pricing.cjs');
const {
  validateRegistrationPayload,
  requiresPaymentProof,
  isAllowedProofMime,
  PROOF_MAX_BYTES,
} = require('./api/lib/academy-registration-validation.cjs');
const {
  getServiceDb,
  getAcademySettings,
  countApprovedRegistrations,
  canApproveMore,
  generateRegistrationNumber,
  logAcademyEvent,
  resolvePromoCode,
  computePromoDiscount,
  incrementPromoUsed,
} = require('./api/lib/academy-db.cjs');
const {
  registerClicToPayPayment,
  fetchClicToPayOrderStatus,
  resolvePublicBaseUrl,
} = require('./api/lib/clictopay-client.cjs');
const {
  buildAcademyOnlineConfirmedEmailHtml,
  buildAcademyManualPaymentReceivedEmailHtml,
  buildAcademyApprovedEmailHtml,
} = require('./api/lib/academy-email-html.cjs');
const { getFormulaBasePrice, FORMULA_IDS } = require('./api/lib/academy-pricing.cjs');
const { normalizeAcademyPromoCode } = require('./api/lib/academy-registration-validation.cjs');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PROOF_MAX_BYTES },
});

function multerSingle(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large (max 5 MB)' });
        }
        return res.status(400).json({ error: err.message || 'Upload error' });
      }
      next();
    });
  };
}

const rateByIp = new Map();
const IP_WINDOW = 60 * 60 * 1000;
const IP_MAX = 5;

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function checkIpRate(ip) {
  const now = Date.now();
  let rec = rateByIp.get(ip);
  if (!rec || now > rec.resetAt) {
    rateByIp.set(ip, { count: 1, resetAt: now + IP_WINDOW });
    return true;
  }
  rec.count += 1;
  return rec.count <= IP_MAX;
}

async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token || token === 'localhost-bypass-token') return true;
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${secret}&response=${encodeURIComponent(token)}`,
  });
  const data = await res.json();
  return !!data.success;
}

function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

function getEmailTransporterBundle() {
  try {
    const { sendTransactionalEmail } = require('./api/lib/transactional-email.cjs');
    return { sendTransactionalEmail };
  } catch {
    return null;
  }
}

async function sendAcademyEmail(reg, template) {
  const bundle = getEmailTransporterBundle();
  if (!bundle) return;
  let mail;
  if (template === 'online_confirmed') mail = buildAcademyOnlineConfirmedEmailHtml(reg);
  else if (template === 'manual_received') mail = buildAcademyManualPaymentReceivedEmailHtml(reg);
  else if (template === 'approved') mail = buildAcademyApprovedEmailHtml(reg);
  else return;
  await bundle.sendTransactionalEmail(
    {},
    { to: reg.email, subject: mail.subject, html: mail.html }
  );
}

async function tryAutoApprove(db, reg, adminId = null, ip = null) {
  const can = await canApproveMore(db);
  if (!can) return { approved: false, reason: 'cap_reached' };
  const { data, error } = await db
    .from('academy_registrations')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reg.id)
    .in('status', ['paid_online', 'proof_received'])
    .select('*')
    .maybeSingle();
  if (error || !data) return { approved: false, reason: 'update_failed' };
  await logAcademyEvent(db, {
    registrationId: reg.id,
    eventType: adminId ? 'admin_approved' : 'auto_approved',
    oldStatus: reg.status,
    newStatus: 'approved',
    adminId,
    ip,
  });
  await sendAcademyEmail(data, 'approved');
  await db
    .from('academy_registrations')
    .update({ last_email_type: 'approved', email_sent_at: new Date().toISOString() })
    .eq('id', reg.id);
  return { approved: true, registration: data };
}

function registerAcademyRoutes(app, { requireAdminAuth }) {
  const registerLimiter = multerSingle('paymentProof');

  app.get('/api/academy/status', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const settings = await getAcademySettings(db);
      res.json({
        enabled: settings.page_enabled !== false,
        messageEn:
          settings.disabled_message_en ||
          'Academy registrations are temporarily closed. Please check back soon.',
        messageFr:
          settings.disabled_message_fr ||
          'Les inscriptions à l\'Academy sont temporairement fermées. Veuillez réessayer bientôt.',
      });
    } catch (e) {
      console.error('GET /api/academy/status', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/academy/validate-promo', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });

      const code = normalizeAcademyPromoCode(req.body?.promoCode ?? req.body?.code);
      const formule = typeof req.body?.formule === 'string' ? req.body.formule.trim() : '';

      if (code === null) {
        return res.json({ valid: false, error: 'invalid_format' });
      }
      if (!code) {
        return res.json({ valid: false, error: 'empty' });
      }
      if (!FORMULA_IDS.includes(formule)) {
        return res.status(400).json({ error: 'Invalid formula' });
      }

      const base = getFormulaBasePrice(formule);
      if (base == null) return res.status(400).json({ error: 'Invalid formula' });

      const promoResult = await resolvePromoCode(db, code);
      if (!promoResult.promo) {
        return res.json({
          valid: false,
          error: promoResult.error || 'invalid',
        });
      }

      const discountAmountDt = computePromoDiscount(promoResult.promo, base);
      const discountLabel =
        promoResult.promo.discount_type === 'percent'
          ? `${Number(promoResult.promo.discount_value)}%`
          : `${Number(promoResult.promo.discount_value)} DT`;

      res.json({
        valid: true,
        code: promoResult.promo.code,
        discountAmountDt,
        discountLabel,
        discountType: promoResult.promo.discount_type,
        subtotalDt: Math.max(0, base - discountAmountDt),
      });
    } catch (e) {
      console.error('POST /api/academy/validate-promo', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/academy/register', registerLimiter, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });

      const ip = getClientIp(req);
      if (!checkIpRate(ip)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const body = { ...req.body };
      if (typeof body.acceptTerms === 'string') {
        body.acceptTerms = body.acceptTerms === 'true';
      }

      const validation = validateRegistrationPayload(body);
      if (!validation.ok) {
        return res.status(400).json({ error: 'Validation failed', details: validation.errors });
      }

      const recaptchaOk = await verifyRecaptcha(body.recaptchaToken);
      if (!recaptchaOk) return res.status(400).json({ error: 'reCAPTCHA verification failed' });

      const settings = await getAcademySettings(db);
      if (!settings.page_enabled) {
        const lang = body.language === 'en' ? 'en' : 'fr';
        const message =
          lang === 'en'
            ? settings.disabled_message_en ||
              'Academy registrations are temporarily closed.'
            : settings.disabled_message_fr ||
              'Les inscriptions à l\'Academy sont temporairement fermées.';
        return res.status(503).json({ error: 'academy_closed', message });
      }

      const { data: vData } = validation;

      let promoId = null;
      let discountAmount = 0;
      if (vData.promoCode) {
        const promoResult = await resolvePromoCode(db, vData.promoCode);
        if (!promoResult.promo) {
          return res.status(400).json({ error: 'Invalid or expired promo code' });
        }
        const base = getFormulaBasePrice(vData.formule);
        discountAmount = computePromoDiscount(promoResult.promo, base);
        promoId = promoResult.promo.id;
      }

      const amounts = computeRegistrationAmounts({
        formule: vData.formule,
        paymentMethod: vData.paymentMethod,
        discountAmountDt: discountAmount,
      });
      if (!amounts) return res.status(400).json({ error: 'Invalid formula pricing' });

      if (requiresPaymentProof(vData.paymentMethod)) {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Payment proof is required' });
        if (!isAllowedProofMime(file.mimetype, file.originalname)) {
          return res.status(400).json({ error: 'Invalid file type for payment proof' });
        }
      }

      const regNum = await generateRegistrationNumber(db);
      let initialStatus = vData.paymentMethod === 'card' ? 'pending_payment' : 'pending_payment';
      if (requiresPaymentProof(vData.paymentMethod) && req.file) {
        initialStatus = 'proof_received';
      }

      const insertRow = {
        registration_number: regNum,
        full_name: vData.fullName,
        email: vData.email,
        phone: vData.phone,
        formule: vData.formule,
        payment_method: vData.paymentMethod,
        promo_code_id: promoId,
        base_amount_dt: amounts.base_amount_dt,
        discount_amount_dt: amounts.discount_amount_dt,
        fee_amount_dt: amounts.fee_amount_dt,
        total_amount_dt: amounts.total_amount_dt,
        status: initialStatus,
        ip_address: ip,
        user_agent: (req.get('user-agent') || '').slice(0, 512),
        client_elapsed_ms: vData.clientElapsedMs,
      };

      const { data: inserted, error: insertErr } = await db
        .from('academy_registrations')
        .insert(insertRow)
        .select('*')
        .single();
      if (insertErr) {
        if (insertErr.code === '23505') {
          return res.status(409).json({ error: 'A registration with this email and formula already exists' });
        }
        throw insertErr;
      }

      if (promoId) await incrementPromoUsed(db, promoId);

      if (req.file) {
        const ext = path.extname(req.file.originalname || '') || '.bin';
        const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 8) || '.bin';
        const storagePath = `${inserted.id}/${crypto.randomUUID()}${safeExt}`;
        const { error: upErr } = await db.storage
          .from('academy-payment-proofs')
          .upload(storagePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
          });
        if (upErr) {
          console.error('proof upload', upErr);
          await db.from('academy_registrations').delete().eq('id', inserted.id);
          return res.status(500).json({ error: 'Failed to store payment proof' });
        }
        await db
          .from('academy_registrations')
          .update({ payment_proof_path: storagePath, status: 'proof_received' })
          .eq('id', inserted.id);
        inserted.payment_proof_path = storagePath;
        inserted.status = 'proof_received';
      }

      await logAcademyEvent(db, {
        registrationId: inserted.id,
        eventType: 'created',
        newStatus: inserted.status,
        ip,
      });

      if (requiresPaymentProof(vData.paymentMethod)) {
        await sendAcademyEmail(inserted, 'manual_received');
        await db
          .from('academy_registrations')
          .update({ last_email_type: 'manual_received', email_sent_at: new Date().toISOString() })
          .eq('id', inserted.id);
      }

      res.status(201).json({
        success: true,
        registrationId: inserted.id,
        registrationNumber: inserted.registration_number,
        status: inserted.status,
        paymentMethod: inserted.payment_method,
        totalAmountDt: inserted.total_amount_dt,
        redirectToPayment: inserted.payment_method === 'card',
      });
    } catch (e) {
      console.error('POST /api/academy/register', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.get('/api/academy/registration/:id/status', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const { id } = req.params;
      const { data, error } = await db
        .from('academy_registrations')
        .select('id, registration_number, status, payment_method, total_amount_dt, formule')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Not found' });
      res.json({
        registrationId: data.id,
        registrationNumber: data.registration_number,
        status: data.status,
        paymentMethod: data.payment_method,
        totalAmountDt: data.total_amount_dt,
        formule: data.formule,
      });
    } catch (e) {
      console.error('GET registration status', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/academy/clictopay-generate-payment', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const registrationId = req.body?.registrationId || req.body?.registration_id;
      if (!registrationId) return res.status(400).json({ error: 'registrationId is required' });

      const { data: reg, error } = await db
        .from('academy_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();
      if (error || !reg) return res.status(404).json({ error: 'Registration not found' });
      if (reg.payment_method !== 'card') {
        return res.status(400).json({ error: 'Not a card payment registration' });
      }
      if (reg.status === 'approved' || reg.status === 'paid_online') {
        return res.status(400).json({ error: 'Already paid', alreadyPaid: true });
      }
      if (!['pending_payment', 'pending_online'].includes(reg.status)) {
        return res.status(400).json({ error: 'Registration is not ready for payment', status: reg.status });
      }

      const base = resolvePublicBaseUrl(req);
      const returnUrl = `${base}/academy/payment-processing?registrationId=${registrationId}&return=1`;
      const failUrl = `${base}/academy/payment-processing?registrationId=${registrationId}&return=1&status=failed`;
      const orderRef = reg.registration_number.replace(/-/g, '').substring(0, 32);

      const result = await registerClicToPayPayment({
        amount: Number(reg.total_amount_dt),
        orderNumber: orderRef,
        returnUrl,
        failUrl,
        description: `Academy ${reg.registration_number}`,
      });

      if (!result.ok) {
        return res.status(500).json({ error: result.error, details: result.data });
      }

      if (result.gatewayOrderId) {
        await db
          .from('academy_registrations')
          .update({
            payment_gateway_reference: result.gatewayOrderId,
            status: 'pending_online',
            updated_at: new Date().toISOString(),
          })
          .eq('id', registrationId);
      }

      res.json({ success: true, formUrl: result.formUrl, registrationId });
    } catch (e) {
      console.error('academy clictopay generate', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.post('/api/academy/clictopay-confirm-payment', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const registrationId = req.body?.registrationId || req.body?.registration_id;
      if (!registrationId) return res.status(400).json({ error: 'registrationId is required' });

      const { data: reg, error } = await db
        .from('academy_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();
      if (error || !reg) return res.status(404).json({ error: 'Registration not found' });

      if (reg.status === 'approved') {
        return res.json({ success: true, alreadyPaid: true, status: 'approved' });
      }
      if (reg.status === 'paid_online') {
        const approveResult = await tryAutoApprove(db, reg);
        return res.json({
          success: true,
          status: approveResult.approved ? 'approved' : 'paid_online',
          approved: approveResult.approved,
        });
      }
      if (reg.status !== 'pending_online' && reg.status !== 'pending_payment') {
        return res.status(400).json({ error: 'Not pending payment', status: reg.status });
      }

      const ctpId = reg.payment_gateway_reference;
      if (!ctpId) return res.status(400).json({ error: 'No gateway reference' });

      const gateway = await fetchClicToPayOrderStatus(ctpId);
      if (!gateway.ok) {
        await db
          .from('academy_registrations')
          .update({
            status: 'failed',
            payment_confirm_response: gateway.statusData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', registrationId);
        return res.status(400).json({ success: false, error: 'Payment not confirmed by gateway' });
      }

      const { data: paidReg, error: upErr } = await db
        .from('academy_registrations')
        .update({
          status: 'paid_online',
          payment_confirm_response: gateway.statusData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId)
        .select('*')
        .single();
      if (upErr) throw upErr;

      await logAcademyEvent(db, {
        registrationId,
        eventType: 'payment_confirmed',
        oldStatus: reg.status,
        newStatus: 'paid_online',
      });

      await sendAcademyEmail(paidReg, 'online_confirmed');
      await db
        .from('academy_registrations')
        .update({ last_email_type: 'online_confirmed', email_sent_at: new Date().toISOString() })
        .eq('id', registrationId);

      const approveResult = await tryAutoApprove(db, paidReg);

      res.json({
        success: true,
        status: approveResult.approved ? 'approved' : 'paid_online',
        approved: approveResult.approved,
        capReached: approveResult.reason === 'cap_reached',
        registrationNumber: paidReg.registration_number,
      });
    } catch (e) {
      console.error('academy clictopay confirm', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin (super_admin only) ———————————————————————————————————————————————

  app.get('/api/admin/academy/settings', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const settings = await getAcademySettings(db);
      const approvedCount = await countApprovedRegistrations(db);
      res.json({
        ...settings,
        approved_count: approvedCount,
        remaining_approved: Math.max(0, settings.max_approved_total - approvedCount),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/academy/settings', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      const settings = await getAcademySettings(db);
      const patch = { updated_at: new Date().toISOString(), updated_by: req.admin.id };
      if (req.body.max_approved_total != null) {
        const n = parseInt(req.body.max_approved_total, 10);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Invalid max_approved_total' });
        patch.max_approved_total = n;
      }
      if (req.body.page_enabled != null) patch.page_enabled = !!req.body.page_enabled;
      if (req.body.disabled_message_en != null) {
        patch.disabled_message_en = String(req.body.disabled_message_en).slice(0, 2000);
      }
      if (req.body.disabled_message_fr != null) {
        patch.disabled_message_fr = String(req.body.disabled_message_fr).slice(0, 2000);
      }
      const { data, error } = await db
        .from('academy_settings')
        .update(patch)
        .eq('id', settings.id)
        .select('*')
        .single();
      if (error) throw error;
      res.json({ success: true, settings: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/academy/registrations', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      let q = db
        .from('academy_registrations')
        .select('*, academy_promo_codes(code)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (req.query.status) q = q.eq('status', req.query.status);
      if (req.query.formule) q = q.eq('formule', req.query.formule);
      const { data, error } = await q;
      if (error) throw error;
      res.json({ registrations: data || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/academy/registrations/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const { data, error } = await db
        .from('academy_registrations')
        .select('*, academy_promo_codes(code, discount_type, discount_value)')
        .eq('id', req.params.id)
        .maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Not found' });
      let proofSignedUrl = null;
      if (data.payment_proof_path) {
        const { data: signed } = await db.storage
          .from('academy-payment-proofs')
          .createSignedUrl(data.payment_proof_path, 3600);
        proofSignedUrl = signed?.signedUrl || null;
      }
      res.json({ registration: { ...data, proof_signed_url: proofSignedUrl } });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/academy/registrations/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const email = req.body?.email?.trim()?.toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email' });
      }
      const { data, error } = await db
        .from('academy_registrations')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select('*')
        .single();
      if (error) throw error;
      res.json({ success: true, registration: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/academy/registrations/:id/approve', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const can = await canApproveMore(db);
      if (!can) return res.status(409).json({ error: 'Maximum approved registrations reached' });

      const { data: reg } = await db
        .from('academy_registrations')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!reg) return res.status(404).json({ error: 'Not found' });
      if (!['proof_received', 'paid_online', 'pending_payment'].includes(reg.status)) {
        return res.status(400).json({ error: 'Cannot approve from status ' + reg.status });
      }

      const { data, error } = await db
        .from('academy_registrations')
        .update({
          status: 'approved',
          reviewed_by: req.admin.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select('*')
        .single();
      if (error) throw error;

      await logAcademyEvent(db, {
        registrationId: req.params.id,
        eventType: 'admin_approved',
        oldStatus: reg.status,
        newStatus: 'approved',
        adminId: req.admin.id,
        ip: getClientIp(req),
      });
      await sendAcademyEmail(data, 'approved');
      res.json({ success: true, registration: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/academy/registrations/:id/reject', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const { data: reg } = await db
        .from('academy_registrations')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!reg) return res.status(404).json({ error: 'Not found' });

      const { data, error } = await db
        .from('academy_registrations')
        .update({
          status: 'rejected',
          rejection_reason: (req.body?.reason || '').slice(0, 500) || null,
          reviewed_by: req.admin.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select('*')
        .single();
      if (error) throw error;

      await logAcademyEvent(db, {
        registrationId: req.params.id,
        eventType: 'admin_rejected',
        oldStatus: reg.status,
        newStatus: 'rejected',
        adminId: req.admin.id,
        ip: getClientIp(req),
        notes: req.body?.reason,
      });
      res.json({ success: true, registration: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/academy/registrations/:id/resend-email', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const { data: reg } = await db.from('academy_registrations').select('*').eq('id', req.params.id).single();
      if (!reg) return res.status(404).json({ error: 'Not found' });
      if (reg.status !== 'approved') {
        return res.status(400).json({ error: 'Resend is only available for approved registrations' });
      }
      await sendAcademyEmail(reg, 'approved');
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/academy/reports', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const { data: rows } = await db.from('academy_registrations').select('status, total_amount_dt');
      const stats = {
        total: rows?.length || 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        revenue_dt: 0,
      };
      const pendingStatuses = new Set([
        'pending_payment',
        'proof_received',
        'pending_online',
        'paid_online',
      ]);
      for (const r of rows || []) {
        if (r.status === 'approved') {
          stats.approved += 1;
          stats.revenue_dt += Number(r.total_amount_dt) || 0;
        } else if (r.status === 'rejected') stats.rejected += 1;
        else if (pendingStatuses.has(r.status)) stats.pending += 1;
      }
      stats.revenue_dt = Number(stats.revenue_dt.toFixed(3));
      res.json(stats);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/academy/promo-codes', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const { data, error } = await db
        .from('academy_promo_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json({
        promoCodes: (data || []).map((p) => ({
          ...p,
          remaining: p.max_uses - p.used_count,
        })),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/academy/promo-codes', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const code = normalizeAcademyPromoCode(req.body.code);
      const discount_type = req.body.discount_type;
      const discount_value = Number(req.body.discount_value);
      const max_uses = parseInt(req.body.max_uses, 10);
      if (code === null || !code || code.length < 2) {
        return res.status(400).json({ error: 'Invalid code (uppercase letters and numbers only)' });
      }
      if (!['percent', 'fixed'].includes(discount_type)) return res.status(400).json({ error: 'Invalid discount type' });
      if (!Number.isFinite(discount_value) || discount_value < 0) return res.status(400).json({ error: 'Invalid discount value' });
      if (!Number.isFinite(max_uses) || max_uses < 1) return res.status(400).json({ error: 'Invalid max uses' });

      const { data, error } = await db
        .from('academy_promo_codes')
        .insert({
          code,
          discount_type,
          discount_value,
          max_uses,
          created_by: req.admin.id,
        })
        .select('*')
        .single();
      if (error) throw error;
      res.status(201).json({ promoCode: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/academy/promo-codes/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const patch = { updated_at: new Date().toISOString() };
      if (req.body.max_uses != null) {
        const max_uses = parseInt(req.body.max_uses, 10);
        const { data: existing } = await db.from('academy_promo_codes').select('used_count').eq('id', req.params.id).single();
        if (!existing || max_uses < existing.used_count) {
          return res.status(400).json({ error: 'max_uses must be >= used_count' });
        }
        patch.max_uses = max_uses;
      }
      if (req.body.active != null) patch.active = !!req.body.active;
      if (req.body.discount_value != null) patch.discount_value = Number(req.body.discount_value);
      const { data, error } = await db
        .from('academy_promo_codes')
        .update(patch)
        .eq('id', req.params.id)
        .select('*')
        .single();
      if (error) throw error;
      res.json({ promoCode: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/admin/academy/promo-codes/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      const { data: row } = await db.from('academy_promo_codes').select('used_count').eq('id', req.params.id).single();
      if (!row) return res.status(404).json({ error: 'Not found' });
      if (row.used_count > 0) {
        await db
          .from('academy_promo_codes')
          .update({ revoked_at: new Date().toISOString(), active: false })
          .eq('id', req.params.id);
        return res.json({ success: true, revoked: true });
      }
      await db.from('academy_promo_codes').delete().eq('id', req.params.id);
      res.json({ success: true, deleted: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

}

module.exports = { registerAcademyRoutes };

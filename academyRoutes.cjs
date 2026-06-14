'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { computeRegistrationAmounts } = require('./api/_lib/academy-pricing.cjs');
const {
  validateRegistrationPayload,
  requiresPaymentProof,
  isAllowedProofMime,
  PROOF_MAX_BYTES,
} = require('./api/_lib/academy-registration-validation.cjs');
const {
  getServiceDb,
  getAcademySettings,
  countApprovedRegistrations,
  canApproveMore,
  isAcademySoldOut,
  buildAcademyPublicStatus,
  parseAcademyOnlineFeeRate,
  generateRegistrationNumber,
  logAcademyEvent,
  resolvePromoCode,
  computePromoDiscount,
  incrementPromoUsed,
  findActiveAcademyRegistration,
} = require('./api/_lib/academy-db.cjs');
const {
  registerClicToPayPayment,
  fetchClicToPayOrderStatus,
  resolvePublicBaseUrl,
} = require('./api/_lib/clictopay-client.cjs');
const {
  buildAcademyOnlineConfirmedEmailHtml,
  buildAcademyManualPaymentReceivedEmailHtml,
  buildAcademyApprovedEmailHtml,
} = require('./api/_lib/academy-email-html.cjs');
const { getFormulaBasePrice, FORMULA_IDS, registrationAmountsAreValid } = require('./api/_lib/academy-pricing.cjs');
const { normalizeAcademyPromoCode } = require('./api/_lib/academy-registration-validation.cjs');
const { cancelExpiredAcademyPendingRegistrations } = require('./api/_lib/academy-expire-pending.cjs');
const { requireCronSecret } = require('./api/_lib/cron-auth.cjs');
const { sendTransactionalEmail } = require('./api/_lib/transactional-email.cjs');
const { getEmailTransporter } = require('./api/_lib/get-email-transporter.cjs');
const { processConfirmedAcademyPurchaseTracking } = require('./api/_lib/meta/academy-purchase-tracking.cjs');
const {
  insertAcademyRegistration,
  updateAcademyRegistration,
} = require('./api/_lib/academy-meta-db.cjs');

const ACADEMY_EMAIL_FROM = '"Andiamo Events" <contact@andiamoevents.com>';

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

function buildAcademyMetaAttribution(req, body) {
  const metaEventId = body?.metaEventId || body?.meta_event_id;
  const metaFbp = body?.metaFbp || body?.meta_fbp;
  const metaFbc = body?.metaFbc || body?.meta_fbc;
  const metaEventSourceUrl = body?.metaEventSourceUrl || body?.meta_event_source_url;
  const clientIp = getClientIp(req);
  const clientUserAgent = (req.get('user-agent') || '').slice(0, 512);
  if (
    !metaEventId &&
    !metaFbp &&
    !metaFbc &&
    !metaEventSourceUrl &&
    !clientUserAgent &&
    !clientIp
  ) {
    return null;
  }
  return {
    ...(metaEventId ? { eventId: String(metaEventId).slice(0, 128) } : {}),
    ...(metaFbp ? { fbp: String(metaFbp).slice(0, 256) } : {}),
    ...(metaFbc ? { fbc: String(metaFbc).slice(0, 256) } : {}),
    ...(metaEventSourceUrl ? { eventSourceUrl: String(metaEventSourceUrl).slice(0, 2048) } : {}),
    ...(clientUserAgent ? { clientUserAgent } : {}),
    ...(clientIp ? { clientIp } : {}),
  };
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

async function sendAcademyEmail(reg, template) {
  if (!reg?.email) return false;
  let mail;
  if (template === 'online_confirmed') mail = buildAcademyOnlineConfirmedEmailHtml(reg);
  else if (template === 'manual_received') mail = buildAcademyManualPaymentReceivedEmailHtml(reg);
  else if (template === 'approved') mail = buildAcademyApprovedEmailHtml(reg);
  else return false;
  try {
    await sendTransactionalEmail(
      { getEmailTransporter },
      {
        from: ACADEMY_EMAIL_FROM,
        replyTo: ACADEMY_EMAIL_FROM,
        to: reg.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        transactional: true,
        messageRef: reg.registration_number || reg.id,
      }
    );
    return true;
  } catch (e) {
    console.error(`[academy] ${template} email failed:`, e.message || e);
    return false;
  }
}

async function tryAutoApprove(db, reg, adminId = null, ip = null, options = {}) {
  const { skipApprovedEmail = false } = options;
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
  if (!skipApprovedEmail) {
    const sent = await sendAcademyEmail(data, 'approved');
    if (sent) {
      await db
        .from('academy_registrations')
        .update({ last_email_type: 'approved', email_sent_at: new Date().toISOString() })
        .eq('id', reg.id);
    }
  }
  return { approved: true, registration: data };
}

function runAcademyExpirePendingInBackground(db) {
  cancelExpiredAcademyPendingRegistrations(db).catch((e) => {
    console.warn('academy auto-cancel pending:', e.message || e);
  });
}

function academyRegistrationResponse(reg, extra = {}) {
  return {
    success: true,
    registrationId: reg.id,
    registrationNumber: reg.registration_number,
    status: reg.status,
    paymentMethod: reg.payment_method,
    totalAmountDt: reg.total_amount_dt,
    redirectToPayment: reg.payment_method === 'card',
    ...extra,
  };
}

async function runAcademyPurchaseTracking(db, registrationId, req) {
  try {
    return await processConfirmedAcademyPurchaseTracking(db, registrationId, { req });
  } catch (err) {
    console.warn(
      '[Academy Meta Tracking] processing failed:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function respondToExistingAcademyRegistration(res, db, existing, vData, lang, req) {
  if (['pending_payment', 'pending_online'].includes(existing.status)) {
    if (existing.payment_method === 'card' && vData.paymentMethod === 'card') {
      const metaAttribution = buildAcademyMetaAttribution(req, req.body);
      await updateAcademyRegistration(db, existing.id, {
        full_name: vData.fullName,
        phone: vData.phone,
        ...(metaAttribution ? { meta_attribution: metaAttribution } : {}),
        updated_at: new Date().toISOString(),
      });
      return res.status(200).json(
        academyRegistrationResponse(existing, {
          resumed: true,
          message:
            lang === 'en'
              ? 'You already have a registration in progress. Continuing to payment.'
              : 'Vous avez déjà une inscription en cours. Poursuite vers le paiement.',
        })
      );
    }
    return res.status(409).json({
      error: 'registration_in_progress',
      message:
        lang === 'en'
          ? 'You already have a registration in progress for this formula. Please contact us if you need to change payment method.'
          : 'Vous avez déjà une inscription en cours pour cette formule. Contactez-nous pour changer de mode de paiement.',
      registrationNumber: existing.registration_number,
      status: existing.status,
    });
  }

  if (existing.status === 'proof_received') {
    return res.status(409).json({
      error: 'registration_pending_review',
      message:
        lang === 'en'
          ? 'We already have your registration and payment proof for this formula. Our team will review it shortly.'
          : 'Nous avons déjà votre inscription et votre preuve de paiement pour cette formule. Notre équipe va les examiner sous peu.',
      registrationNumber: existing.registration_number,
      status: existing.status,
    });
  }

  if (existing.status === 'paid_online') {
    return res.status(409).json({
      error: 'payment_received',
      message:
        lang === 'en'
          ? 'Your online payment was received. Your place will be confirmed by email once processing is complete.'
          : 'Votre paiement en ligne a été reçu. Votre place sera confirmée par e-mail une fois le traitement terminé.',
      registrationNumber: existing.registration_number,
      status: existing.status,
    });
  }

  if (existing.status === 'approved') {
    return res.status(409).json({
      error: 'already_approved',
      message:
        lang === 'en'
          ? 'You are already registered and approved for this formula.'
          : 'Vous êtes déjà inscrit et approuvé pour cette formule.',
      registrationNumber: existing.registration_number,
      status: existing.status,
    });
  }

  return res.status(409).json({
    error: 'registration_exists',
    message:
      lang === 'en'
        ? 'A registration with this email and formula already exists.'
        : 'Une inscription avec cet e-mail et cette formule existe déjà.',
    registrationNumber: existing.registration_number,
    status: existing.status,
  });
}

function academySoldOutResponse(res, settings, lang = 'en') {
  const message =
    lang === 'en'
      ? settings.sold_out_message_en || 'Academy registrations are sold out.'
      : settings.sold_out_message_fr || "Les inscriptions à l'Academy sont complètes.";
  return res.status(409).json({ error: 'academy_sold_out', message });
}

let publicApiErrorModPromise = null;
function getPublicApiErrorMod() {
  if (!publicApiErrorModPromise) {
    publicApiErrorModPromise = import('./api/_lib/public-api-error.js');
  }
  return publicApiErrorModPromise;
}

async function academyServiceError(res, status, logDetails) {
  const { publicApiError, PUBLIC_ERROR_CODES } = await getPublicApiErrorMod();
  return publicApiError(res, status, PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE, undefined, { logDetails });
}

async function academyPublicError(res, status, code, message, logDetails) {
  const { publicApiError } = await getPublicApiErrorMod();
  return publicApiError(res, status, code, message, { logDetails });
}

function registerAcademyRoutes(app, { requireAdminAuth }) {
  const registerLimiter = multerSingle('paymentProof');

  async function handleAutoCancelExpiredAcademyRegistrations(req, res) {
    try {
      const db = getServiceDb();
      if (!db) return academyServiceError(res, 503, 'Database not configured');

      const result = await cancelExpiredAcademyPendingRegistrations(db);
      res.json({
        success: true,
        ...result,
        expire_minutes: result.expireMinutes,
        message:
          result.cancelled_count > 0
            ? `Auto-cancelled ${result.cancelled_count} expired academy registration(s).`
            : 'No expired academy pending registrations found.',
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error('auto-cancel-expired-academy-registrations', e);
      return academyServiceError(res, 500, e);
    }
  }

  app.get(
    '/api/auto-cancel-expired-academy-registrations',
    requireCronSecret,
    handleAutoCancelExpiredAcademyRegistrations
  );
  app.post(
    '/api/auto-cancel-expired-academy-registrations',
    requireCronSecret,
    handleAutoCancelExpiredAcademyRegistrations
  );

  app.get('/api/academy/status', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return academyServiceError(res, 503, 'Database not configured');
      const status = await buildAcademyPublicStatus(db);
      res.json(status);
    } catch (e) {
      console.error('GET /api/academy/status', e);
      return academyServiceError(res, 500, e);
    }
  });

  app.post('/api/academy/validate-promo', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return academyServiceError(res, 503, 'Database not configured');

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
      return academyServiceError(res, 500, e);
    }
  });

  app.post('/api/academy/register', registerLimiter, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return academyServiceError(res, 503, 'Database not configured');

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
      const lang = body.language === 'en' ? 'en' : 'fr';
      if (!settings.page_enabled) {
        const message =
          lang === 'en'
            ? settings.disabled_message_en ||
              'Academy registrations are temporarily closed.'
            : settings.disabled_message_fr ||
              'Les inscriptions à l\'Academy sont temporairement fermées.';
        return res.status(503).json({ error: 'academy_closed', message });
      }
      if (await isAcademySoldOut(db)) {
        return academySoldOutResponse(res, settings, lang);
      }

      const { data: vData } = validation;

      await cancelExpiredAcademyPendingRegistrations(db);

      const existingReg = await findActiveAcademyRegistration(db, vData.email, vData.formule);
      if (existingReg) {
        return await respondToExistingAcademyRegistration(res, db, existingReg, vData, lang, req);
      }

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
        feeRate: settings.online_payment_fee_rate,
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

      const metaAttribution = buildAcademyMetaAttribution(req, body);

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
        ...(metaAttribution ? { meta_attribution: metaAttribution } : {}),
      };

      const { data: inserted, error: insertErr } = await insertAcademyRegistration(db, insertRow);
      if (insertErr) {
        if (insertErr.code === '23505') {
          const duplicate = await findActiveAcademyRegistration(db, vData.email, vData.formule);
          if (duplicate) {
            return await respondToExistingAcademyRegistration(res, db, duplicate, vData, lang, req);
          }
          return res.status(409).json({
            error: 'registration_exists',
            message:
              lang === 'en'
                ? 'A registration with this email and formula already exists.'
                : 'Une inscription avec cet e-mail et cette formule existe déjà.',
          });
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
          return academyPublicError(res, 500, 'submission_failed', undefined, {
            logDetails: 'Failed to store payment proof',
          });
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

      let metaTracking = null;
      if (requiresPaymentProof(vData.paymentMethod)) {
        const sent = await sendAcademyEmail(inserted, 'manual_received');
        if (sent) {
          await db
            .from('academy_registrations')
            .update({ last_email_type: 'manual_received', email_sent_at: new Date().toISOString() })
            .eq('id', inserted.id);
        }
        metaTracking = await runAcademyPurchaseTracking(db, inserted.id, req);
      }

      res.status(201).json(academyRegistrationResponse(inserted, { metaTracking }));
    } catch (e) {
      console.error('POST /api/academy/register', e);
      return academyServiceError(res, 500, e);
    }
  });

  app.get('/api/academy/registration/:id/status', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return academyServiceError(res, 503, 'Database not configured');
      await cancelExpiredAcademyPendingRegistrations(db);
      const id = String(req.params.id || '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return res.status(400).json({ error: 'invalid_registration_id' });
      }
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
      return academyServiceError(res, 500, e);
    }
  });

  app.post('/api/academy/clictopay-generate-payment', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return academyServiceError(res, 503, 'Database not configured');
      const registrationId = req.body?.registrationId || req.body?.registration_id;
      if (!registrationId) return res.status(400).json({ error: 'registrationId is required' });

      const { data: reg, error } = await db
        .from('academy_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();
      if (error || !reg) {
        const { PUBLIC_ERROR_CODES } = await getPublicApiErrorMod();
        return academyPublicError(res, 404, PUBLIC_ERROR_CODES.REGISTRATION_NOT_FOUND, undefined, {
          logDetails: error,
        });
      }
      if (reg.payment_method !== 'card') {
        return res.status(400).json({ error: 'Not a card payment registration' });
      }
      await cancelExpiredAcademyPendingRegistrations(db);
      const { data: regFresh } = await db
        .from('academy_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();
      const activeReg = regFresh || reg;
      if (activeReg.status === 'cancelled') {
        return res.status(410).json({
          error: 'registration_expired',
          message: 'This registration has expired. Please register again.',
          status: 'cancelled',
        });
      }
      if (await isAcademySoldOut(db)) {
        const settings = await getAcademySettings(db);
        return academySoldOutResponse(res, settings);
      }
      if (activeReg.status === 'approved' || activeReg.status === 'paid_online') {
        return res.status(400).json({ error: 'Already paid', alreadyPaid: true });
      }
      if (!['pending_payment', 'pending_online'].includes(activeReg.status)) {
        return res.status(400).json({ error: 'Registration is not ready for payment', status: activeReg.status });
      }

      const settings = await getAcademySettings(db);
      if (!registrationAmountsAreValid(activeReg, settings.online_payment_fee_rate)) {
        console.error('academy clictopay: registration amount mismatch', {
          registrationId,
          formule: activeReg.formule,
          total_amount_dt: activeReg.total_amount_dt,
        });
        return res.status(400).json({ error: 'Invalid registration pricing' });
      }

      const base = resolvePublicBaseUrl(req);
      const returnUrl = `${base}/academy/payment-processing?registrationId=${registrationId}&return=1`;
      const failUrl = `${base}/academy/payment-processing?registrationId=${registrationId}&return=1&status=failed`;
      const orderRef = activeReg.registration_number.replace(/-/g, '').substring(0, 32);

      const result = await registerClicToPayPayment({
        amount: Number(activeReg.total_amount_dt),
        orderNumber: orderRef,
        returnUrl,
        failUrl,
        description: `Academy ${activeReg.registration_number}`,
      });

      if (!result.ok) {
        return academyPublicError(res, 500, 'payment_unavailable', undefined, {
          logDetails: { error: result.error, data: result.data },
        });
      }

      if (result.gatewayOrderId) {
        await db
          .from('academy_registrations')
          .update({
            payment_gateway_reference: result.gatewayOrderId,
            status: 'pending_online',
            updated_at: new Date().toISOString(),
          })
          .eq('id', registrationId)
          .in('status', ['pending_payment', 'pending_online']);
      }

      res.json({ success: true, formUrl: result.formUrl, registrationId });
    } catch (e) {
      console.error('academy clictopay generate', e);
      return academyServiceError(res, 500, e);
    }
  });

  app.post('/api/academy/clictopay-confirm-payment', async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return academyServiceError(res, 503, 'Database not configured');
      const registrationId = req.body?.registrationId || req.body?.registration_id;
      if (!registrationId) return res.status(400).json({ error: 'registrationId is required' });

      const { data: reg, error } = await db
        .from('academy_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();
      if (error || !reg) {
        const { PUBLIC_ERROR_CODES } = await getPublicApiErrorMod();
        return academyPublicError(res, 404, PUBLIC_ERROR_CODES.REGISTRATION_NOT_FOUND, undefined, {
          logDetails: error,
        });
      }

      await cancelExpiredAcademyPendingRegistrations(db);
      const { data: regFresh } = await db
        .from('academy_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();
      const activeReg = regFresh || reg;

      if (activeReg.status === 'cancelled') {
        return res.status(410).json({
          success: false,
          error: 'registration_expired',
          message: 'This registration has expired. Please register again.',
          status: 'cancelled',
        });
      }

      if (await isAcademySoldOut(db)) {
        const settings = await getAcademySettings(db);
        return academySoldOutResponse(res, settings);
      }

      if (activeReg.status === 'approved') {
        const metaTracking = await runAcademyPurchaseTracking(db, registrationId, req);
        return res.json({ success: true, alreadyPaid: true, status: 'approved', metaTracking });
      }
      if (activeReg.status === 'paid_online') {
        const metaTracking = await runAcademyPurchaseTracking(db, registrationId, req);
        const approveResult = await tryAutoApprove(db, activeReg, null, null, { skipApprovedEmail: true });
        return res.json({
          success: true,
          status: approveResult.approved ? 'approved' : 'paid_online',
          approved: approveResult.approved,
          metaTracking,
        });
      }
      if (activeReg.status !== 'pending_online' && activeReg.status !== 'pending_payment') {
        return res.status(400).json({ error: 'Not pending payment', status: activeReg.status });
      }

      const ctpId = activeReg.payment_gateway_reference;
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
        .in('status', ['pending_payment', 'pending_online'])
        .select('*')
        .single();
      if (upErr) throw upErr;
      if (!paidReg) {
        return res.status(410).json({
          success: false,
          error: 'registration_expired',
          message: 'This registration has expired. Please register again.',
          status: 'cancelled',
        });
      }

      await logAcademyEvent(db, {
        registrationId,
        eventType: 'payment_confirmed',
        oldStatus: activeReg.status,
        newStatus: 'paid_online',
      });

      const approveResult = await tryAutoApprove(db, paidReg, null, null, { skipApprovedEmail: true });

      const emailReg = approveResult.registration || paidReg;
      const onlineSent = await sendAcademyEmail(emailReg, 'online_confirmed');
      if (onlineSent) {
        await db
          .from('academy_registrations')
          .update({ last_email_type: 'online_confirmed', email_sent_at: new Date().toISOString() })
          .eq('id', registrationId);
      }

      const metaTracking = await runAcademyPurchaseTracking(db, registrationId, req);

      res.json({
        success: true,
        status: approveResult.approved ? 'approved' : 'paid_online',
        approved: approveResult.approved,
        capReached: approveResult.reason === 'cap_reached',
        registrationNumber: paidReg.registration_number,
        metaTracking,
      });
    } catch (e) {
      console.error('academy clictopay confirm', e);
      return academyServiceError(res, 500, e);
    }
  });

  // —— Admin (super_admin only) ———————————————————————————————————————————————

  app.get('/api/admin/academy/settings', requireAdminAuth, requireSuperAdmin, async (req, res) => {
    try {
      const db = getServiceDb();
      if (!db) return academyServiceError(res, 503, 'Database not configured');
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
      if (!db) return academyServiceError(res, 503, 'Database not configured');
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
      if (req.body.online_payment_fee_rate != null) {
        patch.online_payment_fee_rate = parseAcademyOnlineFeeRate(req.body.online_payment_fee_rate);
      }
      if (req.body.sold_out_message_en != null) {
        patch.sold_out_message_en = String(req.body.sold_out_message_en).slice(0, 2000);
      }
      if (req.body.sold_out_message_fr != null) {
        patch.sold_out_message_fr = String(req.body.sold_out_message_fr).slice(0, 2000);
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
      if (!db) return academyServiceError(res, 503, 'Database not configured');
      runAcademyExpirePendingInBackground(db);
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
      const sent = await sendAcademyEmail(data, 'approved');
      if (!sent) {
        return res.status(502).json({ error: 'Registration approved but confirmation email could not be sent' });
      }
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
      const sent = await sendAcademyEmail(reg, 'approved');
      if (!sent) {
        return res.status(502).json({ error: 'Could not send confirmation email' });
      }
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

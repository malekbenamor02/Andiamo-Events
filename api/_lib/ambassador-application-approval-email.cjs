'use strict';

const {
  buildAmbassadorApprovalEmailHtml,
  APPROVAL_EMAIL_SUBJECT,
  APPROVAL_EMAIL_FROM,
} = require('./ambassador-approval-email-html.cjs');
const {
  buildAmbassadorRejectionEmailHtml,
  REJECTION_EMAIL_SUBJECT,
  REJECTION_EMAIL_FROM,
} = require('./ambassador-rejection-email-html.cjs');
const { sendTransactionalEmail } = require('./transactional-email.cjs');

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function maskEmailForLog(email) {
  const e = String(email || '').trim();
  const at = e.indexOf('@');
  if (at <= 0) return '(none)';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const maskedLocal = local.length <= 2 ? '**' : `${local.slice(0, 1)}***${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

function resolvePublicOrigin(req) {
  const fromEnv = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.VITE_PUBLIC_SITE_URL;
  if (fromEnv && typeof fromEnv === 'string') {
    return fromEnv.replace(/\/$/, '');
  }
  const proto = req?.headers?.['x-forwarded-proto'] || 'https';
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  if (host && typeof host === 'string' && !host.includes('localhost')) {
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }
  return 'https://www.andiamoevents.com';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ phone_number?: string; email?: string | null }} application
 */
async function resolveAmbassadorForApplication(db, application) {
  const phone = application?.phone_number;
  if (!phone) return null;

  const normalized = normalizePhoneDigits(phone);
  const { data: byExact } = await db.from('ambassadors').select('id, phone, email, full_name, city, status').eq('phone', phone).maybeSingle();
  if (byExact) return byExact;

  if (normalized && normalized !== phone) {
    const { data: byNorm } = await db.from('ambassadors').select('id, phone, email, full_name, city, status').eq('phone', normalized).maybeSingle();
    if (byNorm) return byNorm;
  }

  const appEmail = application.email?.trim().toLowerCase();
  if (appEmail) {
    const { data: byEmail } = await db.from('ambassadors').select('id, phone, email, full_name, city, status').ilike('email', appEmail).maybeSingle();
    if (byEmail && normalizePhoneDigits(byEmail.phone) === normalized) return byEmail;
  }

  return null;
}

function getEmailTransporterFactory() {
  return async () => {
    const nodemailer = await import('nodemailer');
    return nodemailer.default.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  };
}

/**
 * Send ambassador application approval email using trusted DB fields only.
 * @param {{
 *   db: import('@supabase/supabase-js').SupabaseClient;
 *   application: Record<string, unknown>;
 *   plainPassword: string;
 *   req?: import('http').IncomingMessage;
 *   regeneratePassword?: boolean;
 * }} opts
 */
async function sendAmbassadorApplicationApprovalEmail(opts) {
  const { db, application, req } = opts;
  let plainPassword = opts.plainPassword;

  if (!application || typeof application !== 'object') {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  if (application.status !== 'approved') {
    const err = new Error('Application must be approved before sending approval email');
    err.statusCode = 409;
    throw err;
  }

  const ambassador = await resolveAmbassadorForApplication(db, application);
  if (!ambassador?.id) {
    const err = new Error('Linked ambassador record not found for this application');
    err.statusCode = 404;
    throw err;
  }

  const recipientEmail = (application.email || ambassador.email || '').trim().toLowerCase();
  if (!recipientEmail) {
    const err = new Error('No email address on file for this application');
    err.statusCode = 400;
    throw err;
  }

  if (opts.regeneratePassword || !plainPassword) {
    const { resolveAmbassadorPasswordFromBody } = await import('./admin-data-route-helpers.js');
    const resolved = await resolveAmbassadorPasswordFromBody({ generatePassword: true });
    plainPassword = resolved.temporaryPassword;
    const { error: pwErr } = await db
      .from('ambassadors')
      .update({ password: resolved.hash, updated_at: new Date().toISOString() })
      .eq('id', ambassador.id);
    if (pwErr) {
      const err = new Error('Failed to update ambassador password');
      err.statusCode = 500;
      err.details = pwErr.message;
      throw err;
    }
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    const err = new Error('Email service not configured');
    err.statusCode = 500;
    throw err;
  }

  const origin = resolvePublicOrigin(req);
  const loginUrl = `${origin}/ambassador/auth`;
  const html = buildAmbassadorApprovalEmailHtml({
    fullName: String(application.full_name || ambassador.full_name || 'Ambassador'),
    phone: String(application.phone_number || ambassador.phone || ''),
    password: plainPassword,
    loginUrl,
    ambassadorId: ambassador.id,
    trackingOrigin: origin,
  });

  const getEmailTransporter = getEmailTransporterFactory();
  await sendTransactionalEmail(
    { getEmailTransporter },
    {
      from: APPROVAL_EMAIL_FROM,
      replyTo: APPROVAL_EMAIL_FROM,
      to: recipientEmail,
      subject: APPROVAL_EMAIL_SUBJECT,
      html,
    }
  );

  console.log('[ambassador-application-approval-email] sent', {
    applicationId: application.id,
    ambassadorId: ambassador.id,
    recipient: maskEmailForLog(recipientEmail),
  });

  return { success: true, ambassadorId: ambassador.id };
}

/**
 * Send ambassador application rejection email using trusted DB fields only.
 * @param {{
 *   db: import('@supabase/supabase-js').SupabaseClient;
 *   application: Record<string, unknown>;
 *   rejectionNote?: string | null;
 * }} opts
 */
async function sendAmbassadorApplicationRejectionEmail(opts) {
  const { db, application, rejectionNote } = opts;

  if (!application || typeof application !== 'object') {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  if (application.status !== 'rejected') {
    const err = new Error('Application must be rejected before sending rejection email');
    err.statusCode = 409;
    throw err;
  }

  const recipientEmail = String(application.email || '').trim().toLowerCase();
  if (!recipientEmail) {
    const err = new Error('No email address on file for this application');
    err.statusCode = 400;
    throw err;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    const err = new Error('Email service not configured');
    err.statusCode = 500;
    throw err;
  }

  const html = buildAmbassadorRejectionEmailHtml({
    fullName: String(application.full_name || 'Applicant'),
    rejectionNote: rejectionNote || null,
  });

  const getEmailTransporter = getEmailTransporterFactory();
  await sendTransactionalEmail(
    { getEmailTransporter },
    {
      from: REJECTION_EMAIL_FROM,
      replyTo: REJECTION_EMAIL_FROM,
      to: recipientEmail,
      subject: REJECTION_EMAIL_SUBJECT,
      html,
    }
  );

  console.log('[ambassador-application-rejection-email] sent', {
    applicationId: application.id,
    recipient: maskEmailForLog(recipientEmail),
  });

  return { success: true };
}

module.exports = {
  sendAmbassadorApplicationApprovalEmail,
  sendAmbassadorApplicationRejectionEmail,
  resolveAmbassadorForApplication,
  maskEmailForLog,
  resolvePublicOrigin,
};

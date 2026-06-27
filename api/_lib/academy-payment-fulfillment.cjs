'use strict';

const { buildAcademyOnlineConfirmedEmailHtml, buildAcademyApprovedEmailHtml } = require('./academy-email-html.cjs');
const { sendTransactionalEmail } = require('./transactional-email.cjs');
const { getEmailTransporter } = require('./get-email-transporter.cjs');
const { logAcademyEvent, canApproveMore } = require('./academy-db.cjs');
const { resolveAdminResendEmailTemplate } = require('./academy-payment-helpers.cjs');

const ACADEMY_EMAIL_FROM = '"Andiamo Events" <contact@andiamoevents.com>';

async function sendAcademyRegistrationEmail(reg, template) {
  if (!reg?.email) return false;
  let mail;
  if (template === 'online_confirmed') mail = buildAcademyOnlineConfirmedEmailHtml(reg);
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
  } catch (error) {
    console.warn('[academy] registration email failed:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      registrationId: reg?.id,
      registrationNumber: reg?.registration_number,
      emailType: template,
    });
    return false;
  }
}

async function tryAutoApproveRegistration(db, reg, options = {}) {
  const { skipApprovedEmail = false, adminId = null, ip = null } = options;
  const can = await canApproveMore(db);
  if (!can) return { approved: false, reason: 'cap_reached', registration: reg };
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
  if (error || !data) return { approved: false, reason: 'update_failed', registration: reg };
  await logAcademyEvent(db, {
    registrationId: reg.id,
    eventType: adminId ? 'admin_approved' : 'auto_approved',
    oldStatus: reg.status,
    newStatus: 'approved',
    adminId,
    ip,
  });
  if (!skipApprovedEmail) {
    const sent = await sendAcademyRegistrationEmail(data, 'approved');
    if (sent) {
      await db
        .from('academy_registrations')
        .update({ last_email_type: 'approved', email_sent_at: new Date().toISOString() })
        .eq('id', reg.id);
    }
  }
  return { approved: true, registration: data };
}

/**
 * Idempotent recovery: resend emails and/or retry auto-approve. Never re-charges gateway.
 */
async function recoverAcademyRegistrationFulfillment(db, registrationId, options = {}) {
  const { forceEmail = true, retryApprove = true, dryRun = false } = options;
  const { data: reg, error } = await db
    .from('academy_registrations')
    .select('*')
    .eq('id', registrationId)
    .maybeSingle();
  if (error) throw error;
  if (!reg) return { ok: false, reason: 'not_found' };

  const result = {
    ok: true,
    registrationId: reg.id,
    registrationNumber: reg.registration_number,
    status: reg.status,
    emailSent: false,
    emailType: null,
    approved: reg.status === 'approved',
    dryRun,
  };

  if (dryRun) return result;

  if (retryApprove && reg.status === 'paid_online') {
    const approveResult = await tryAutoApproveRegistration(db, reg, { skipApprovedEmail: !forceEmail });
    result.approved = approveResult.approved || reg.status === 'approved';
    if (approveResult.registration) {
      result.status = approveResult.registration.status;
    }
  }

  const { data: fresh } = await db
    .from('academy_registrations')
    .select('*')
    .eq('id', registrationId)
    .maybeSingle();
  const active = fresh || reg;

  if (forceEmail) {
    const template = resolveAdminResendEmailTemplate(active) ||
      (active.status === 'approved' ? 'approved' : null);
    if (template) {
      result.emailType = template;
      const sent = await sendAcademyRegistrationEmail(active, template);
      result.emailSent = sent;
      if (sent) {
        await db
          .from('academy_registrations')
          .update({ last_email_type: template, email_sent_at: new Date().toISOString() })
          .eq('id', registrationId);
      }
    }
  }

  result.status = active.status;
  return result;
}

module.exports = {
  sendAcademyRegistrationEmail,
  tryAutoApproveRegistration,
  recoverAcademyRegistrationFulfillment,
};

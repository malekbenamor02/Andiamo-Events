'use strict';

const { buildClientOrderConfirmationSMS } = require('../../smsTemplates.cjs');
const { buildOrderConfirmationEmailHtml } = require('./order-confirmation-email-html.cjs');
const { sendTransactionalEmail } = require('./transactional-email.cjs');
const { fetchAmbassadorSocialLinkFromApplications } = require('./ambassador-social-link.cjs');
const {
  extractOrderPasses,
  formatPhoneNumber,
  sendSms,
} = require('./ambassador-new-order-notify.cjs');

const ORDER_NOTIFY_SELECT = `
  *,
  order_passes (*),
  events ( id, name, date, venue ),
  ambassadors ( id, full_name, phone, email )
`;

function applyAmbassadorOverride(order, ambassadorOverride) {
  if (!ambassadorOverride) return order;
  return {
    ...order,
    ambassador_id: ambassadorOverride.id || order.ambassador_id,
    ambassadors: {
      ...(order.ambassadors || {}),
      id: ambassadorOverride.id,
      full_name: ambassadorOverride.full_name,
      phone: ambassadorOverride.phone,
      email: ambassadorOverride.email,
      social_link: ambassadorOverride.social_link,
    },
  };
}

async function enrichAmbassadorSocialLink(dbClient, ambassador) {
  if (!ambassador?.phone) return ambassador;
  try {
    const link = await fetchAmbassadorSocialLinkFromApplications(dbClient, ambassador.phone);
    if (link) return { ...ambassador, social_link: link };
  } catch {
    /* non-fatal */
  }
  return ambassador;
}

async function loadOrderForClientNotify(dbClient, orderId, ambassadorOverride) {
  const { data: order, error } = await dbClient
    .from('orders')
    .select(ORDER_NOTIFY_SELECT)
    .eq('id', orderId)
    .single();

  if (error || !order) return { order: null, error: 'Order not found' };

  let ambassador = ambassadorOverride || order.ambassadors;
  if (ambassador) {
    ambassador = await enrichAmbassadorSocialLink(dbClient, ambassador);
  }

  return { order: applyAmbassadorOverride(order, ambassador), error: null };
}

/**
 * Send COD order confirmation SMS to the customer (best-effort).
 * Pass ambassadorOverride to guarantee new ambassador contact in the message.
 */
async function sendClientOrderConfirmationSmsNotification(dbClient, orderId, options = {}) {
  if (!dbClient) return { success: false, skipped: true, reason: 'no_db_client' };
  if (!process.env.WINSMS_API_KEY) {
    return { success: false, skipped: true, reason: 'not_configured' };
  }

  try {
    const { order, error } = await loadOrderForClientNotify(
      dbClient,
      orderId,
      options.ambassadorOverride
    );
    if (error || !order) return { success: false, error: error || 'Order not found' };

    if (!order.user_phone) {
      return { success: false, skipped: true, reason: 'no_phone' };
    }
    if (!order.ambassadors?.full_name || !order.ambassadors?.phone) {
      return { success: false, skipped: true, reason: 'no_ambassador_contact' };
    }

    const passes = extractOrderPasses(order);
    const message = buildClientOrderConfirmationSMS({
      order,
      passes,
      ambassador: order.ambassadors,
    });

    const formattedNumber = formatPhoneNumber(order.user_phone);
    if (!formattedNumber) {
      return { success: false, error: 'Invalid customer phone number' };
    }

    const responseData = await sendSms(formattedNumber, message);
    const isSuccess =
      responseData.status === 200 &&
      responseData.data &&
      (responseData.data.code === 'ok' ||
        responseData.data.code === '200' ||
        (responseData.data.message &&
          String(responseData.data.message).toLowerCase().includes('successfully')));

    try {
      await dbClient.from('sms_logs').insert({
        phone_number: order.user_phone,
        message: message.trim(),
        status: isSuccess ? 'sent' : 'failed',
        api_response: JSON.stringify(responseData.data || responseData.raw),
        sent_at: isSuccess ? new Date().toISOString() : null,
        error_message: isSuccess ? null : responseData.data?.message || 'SMS sending failed',
        source: 'orders',
        source_id: orderId,
      });
    } catch {
      /* non-fatal */
    }

    if (!isSuccess) {
      return { success: false, error: responseData.data?.message || 'Failed to send SMS' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to send SMS' };
  }
}

/**
 * Send COD order confirmation email to the customer (best-effort).
 */
async function sendClientOrderConfirmationEmailNotification(dbClient, orderId, deps = {}, options = {}) {
  const getEmailTransporter = deps.getEmailTransporter;
  if (!dbClient) return { success: false, skipped: true, reason: 'no_db_client' };
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST) {
    return { success: false, skipped: true, reason: 'not_configured' };
  }

  try {
    const { order, error } = await loadOrderForClientNotify(
      dbClient,
      orderId,
      options.ambassadorOverride
    );
    if (error || !order) return { success: false, error: error || 'Order not found' };

    if (!order.user_email) {
      return { success: false, skipped: true, reason: 'no_email' };
    }
    if (!order.ambassadors?.full_name) {
      return { success: false, skipped: true, reason: 'no_ambassador_contact' };
    }

    const orderPasses = order.order_passes || [];
    const recipientEmail = order.user_email;
    let emailLog = null;

    try {
      const { data: logData } = await dbClient
        .from('email_delivery_logs')
        .insert({
          order_id: order.id,
          email_type: 'order_confirmation',
          recipient_email: recipientEmail,
          recipient_name: order.user_name || 'Customer',
          subject: 'Payment Processing – Andiamo Events',
          status: 'pending',
        })
        .select()
        .single();
      emailLog = logData;
    } catch {
      /* non-fatal */
    }

    const emailHtml = buildOrderConfirmationEmailHtml(order, orderPasses, 'client');
    await sendTransactionalEmail(
      { getEmailTransporter },
      {
        from: '"Andiamo Events" <contact@andiamoevents.com>',
        replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
        to: recipientEmail,
        subject: 'Payment Processing – Andiamo Events',
        html: emailHtml,
      }
    );

    if (emailLog) {
      try {
        await dbClient
          .from('email_delivery_logs')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', emailLog.id);
      } catch {
        /* non-fatal */
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to send email' };
  }
}

function toChannelResult(result) {
  return {
    emailSent: result.email?.success === true,
    smsSent: result.sms?.success === true,
    emailError: result.email?.success ? null : result.email?.error || result.email?.reason || null,
    smsError: result.sms?.success ? null : result.sms?.error || result.sms?.reason || null,
    emailSkippedReason: result.email?.skipped ? result.email.reason || 'skipped' : null,
    smsSkippedReason: result.sms?.skipped ? result.sms.reason || 'skipped' : null,
    skippedReason:
      result.email?.skipped && result.sms?.skipped
        ? result.email.reason || result.sms.reason || 'skipped'
        : null,
  };
}

async function notifyClientOrderConfirmation(dbClient, orderId, deps = {}, options = {}) {
  const ambassadorOverride = options.ambassadorOverride || null;
  const [smsResult, emailResult] = await Promise.all([
    sendClientOrderConfirmationSmsNotification(dbClient, orderId, { ambassadorOverride }),
    sendClientOrderConfirmationEmailNotification(dbClient, orderId, deps, { ambassadorOverride }),
  ]);

  return toChannelResult({ sms: smsResult, email: emailResult });
}

module.exports = {
  sendClientOrderConfirmationSmsNotification,
  sendClientOrderConfirmationEmailNotification,
  notifyClientOrderConfirmation,
  applyAmbassadorOverride,
  toChannelResult,
};

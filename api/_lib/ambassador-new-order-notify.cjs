'use strict';

const https = require('https');
const querystring = require('querystring');
const { buildAmbassadorNewOrderSMS } = require('../../smsTemplates.cjs');
const { buildOrderConfirmationEmailHtml } = require('./order-confirmation-email-html.cjs');
const { sendTransactionalEmail } = require('./transactional-email.cjs');
const { fetchAmbassadorSocialLinkFromApplications } = require('./ambassador-social-link.cjs');

function formatPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('216')) cleaned = cleaned.substring(3);
  cleaned = cleaned.replace(/^0+/, '');
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) return '+216' + cleaned;
  return null;
}

async function sendSms(phoneNumbers, message, senderId = 'Andiamo') {
  const WINSMS_API_KEY = process.env.WINSMS_API_KEY;
  if (!WINSMS_API_KEY) throw new Error('SMS service not configured: WINSMS_API_KEY is required');
  const phoneArray = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
  const formattedNumbers = phoneArray.map((p) => formatPhoneNumber(p)).filter(Boolean);
  if (formattedNumbers.length === 0) throw new Error('No valid phone numbers provided');
  const queryParams = querystring.stringify({
    action: 'send-sms',
    api_key: WINSMS_API_KEY,
    to: formattedNumbers.join(','),
    sms: String(message).trim(),
    from: senderId,
    response: 'json',
  });
  const url = `https://www.winsmspro.com/sms/sms/api?${queryParams}`;
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
          } catch {
            resolve({ status: res.statusCode, data, raw: data });
          }
        });
      })
      .on('error', (e) => reject(new Error(`SMS API request failed: ${e.message}`)));
  });
}

function extractOrderPasses(order) {
  if (order.order_passes && order.order_passes.length > 0) {
    return order.order_passes.map((p) => ({
      pass_type: p.pass_type,
      quantity: p.quantity || 1,
    }));
  }
  if (order.notes) {
    try {
      const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
      if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
        return notesData.all_passes.map((p) => ({
          pass_type: p.passName || p.pass_type || 'Standard',
          quantity: p.quantity || 1,
        }));
      }
    } catch {
      /* ignore */
    }
  }
  return [{ pass_type: order.pass_type || 'Standard', quantity: order.quantity || 1 }];
}

const ORDER_NOTIFY_SELECT = `
  *,
  order_passes (*),
  events ( id, name, date, venue ),
  ambassadors ( id, full_name, phone, email )
`;

/**
 * Send new-order SMS to the order's current ambassador (best-effort).
 */
async function sendAmbassadorNewOrderSmsNotification(dbClient, orderId) {
  if (!dbClient) return { success: false, skipped: true, reason: 'no_db_client' };
  if (!process.env.WINSMS_API_KEY) {
    return { success: false, skipped: true, reason: 'not_configured' };
  }

  try {
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select(ORDER_NOTIFY_SELECT)
      .eq('id', orderId)
      .single();

    if (orderError || !order) return { success: false, error: 'Order not found' };
    if (!order.ambassador_id || !order.ambassadors) {
      return { success: false, skipped: true, reason: 'no_ambassador' };
    }
    if (!order.ambassadors.phone) {
      return { success: false, skipped: true, reason: 'no_ambassador_phone' };
    }

    const passes = extractOrderPasses(order);
    const message = buildAmbassadorNewOrderSMS({ order, passes });
    const formattedNumber = formatPhoneNumber(order.ambassadors.phone);
    if (!formattedNumber) {
      return { success: false, error: 'Invalid ambassador phone number' };
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
        phone_number: order.ambassadors.phone,
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
  } catch (error) {
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Send new-order email to the order's current ambassador (best-effort).
 */
async function sendAmbassadorNewOrderEmailNotification(dbClient, orderId, deps = {}) {
  const getEmailTransporter = deps.getEmailTransporter;
  if (!dbClient) return { success: false, skipped: true, reason: 'no_db_client' };
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST) {
    return { success: false, skipped: true, reason: 'not_configured' };
  }

  try {
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select(ORDER_NOTIFY_SELECT)
      .eq('id', orderId)
      .single();

    if (orderError || !order) return { success: false, error: 'Order not found' };
    if (!order.ambassadors?.email) {
      return { success: false, skipped: true, reason: 'no_ambassador_email' };
    }

    const orderPasses = order.order_passes || [];
    if (order.ambassadors.phone) {
      try {
        const link = await fetchAmbassadorSocialLinkFromApplications(dbClient, order.ambassadors.phone);
        if (link) order.ambassadors.social_link = link;
      } catch {
        /* non-fatal */
      }
    }

    const recipientEmail = order.ambassadors.email;
    let emailLog = null;
    try {
      const { data: logData } = await dbClient
        .from('email_delivery_logs')
        .insert({
          order_id: order.id,
          email_type: 'order_confirmation',
          recipient_email: recipientEmail,
          recipient_name: order.ambassadors.full_name || 'Ambassador',
          subject: 'New Order - Andiamo Events',
          status: 'pending',
        })
        .select()
        .single();
      emailLog = logData;
    } catch {
      /* non-fatal */
    }

    const emailHtml = buildOrderConfirmationEmailHtml(order, orderPasses, 'ambassador');
    await sendTransactionalEmail(
      { getEmailTransporter },
      {
        from: '"Andiamo Events" <contact@andiamoevents.com>',
        replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
        to: recipientEmail,
        subject: 'New Order - Andiamo Events',
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
  } catch (error) {
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Notify the order's current ambassador (post-reassignment).
 */
async function notifyAmbassadorNewOrder(dbClient, orderId, deps = {}) {
  const [smsResult, emailResult] = await Promise.all([
    sendAmbassadorNewOrderSmsNotification(dbClient, orderId),
    sendAmbassadorNewOrderEmailNotification(dbClient, orderId, deps),
  ]);

  return {
    emailSent: emailResult.success === true,
    smsSent: smsResult.success === true,
    emailError: emailResult.success ? null : emailResult.error || emailResult.reason || null,
    smsError: smsResult.success ? null : smsResult.error || smsResult.reason || null,
    skippedReason:
      emailResult.skipped && smsResult.skipped
        ? emailResult.reason || smsResult.reason || 'not_configured'
        : null,
  };
}

module.exports = {
  sendAmbassadorNewOrderSmsNotification,
  sendAmbassadorNewOrderEmailNotification,
  notifyAmbassadorNewOrder,
  extractOrderPasses,
  formatPhoneNumber,
  sendSms,
};

'use strict';

/**
 * Idempotent ticket + email + SMS fulfillment for PAID online orders.
 * Used by ClicToPay confirm and recovery scripts.
 */

const {
  expectedTicketCount,
  ticketsNeededPerPass,
  buildTicketInsertPlan,
} = require('./fulfillment-ticket-plan.cjs');

const { randomUuid } = require('./random-uuid.cjs');

const ORDER_PASSES_COLUMNS = 'id, order_id, quantity, pass_type, price, pass_id';

const ORDER_FULFILLMENT_SELECT =
  '*, events (id, name, date, venue, city, poster_url), ambassadors (id, full_name, phone), pos_outlets ( name )';

const TICKETS_LIST_COLUMNS =
  'id, order_id, order_pass_id, pass_sequence, secure_token, qr_code_url, status, email_delivery_status, generated_at';

/** Exported for tests and static scans. */
const FORBIDDEN_ORDER_PASSES_SELECT_COLUMNS = ['order_pass_id'];

function isProductionFulfillmentEnv() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function allowUnsafeFulfillmentFallback() {
  return process.env.ALLOW_UNSAFE_FULFILLMENT_FALLBACK === '1';
}

async function orderHasSuccessfulSms(dbClient, orderId) {
  try {
    const { data } = await dbClient
      .from('sms_logs')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'sent')
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function insertTicketsUnderLock(dbClient, orderId, insertRows, result) {
  if (!insertRows.length) return { inserted: 0, skipped: 0, usedRpc: false, failed: false };

  const payload = insertRows.map((row) => ({
    order_pass_id: row.pass.id,
    pass_sequence: row.pass_sequence,
    secure_token: row.secure_token,
    qr_code_url: row.qr_code_url,
    status: 'GENERATED',
    generated_at: row.generated_at,
  }));

  const { data: rpcData, error: rpcError } = await dbClient.rpc('insert_fulfillment_tickets_locked', {
    p_order_id: orderId,
    p_rows: payload,
  });

  if (!rpcError && rpcData && typeof rpcData === 'object') {
    if (rpcData.ok === false) {
      const msg = rpcData.error || 'insert_fulfillment_tickets_locked failed';
      result.warnings.push(msg);
      if (isProductionFulfillmentEnv() && !allowUnsafeFulfillmentFallback()) {
        result.error = msg;
        return { inserted: 0, skipped: insertRows.length, usedRpc: true, failed: true };
      }
    } else {
      return {
        inserted: Number(rpcData.inserted) || 0,
        skipped: Number(rpcData.skipped) || 0,
        usedRpc: true,
        failed: false,
      };
    }
  }

  const rpcMsg = rpcError?.message || String(rpcError || '');
  const rpcMissing = /insert_fulfillment_tickets_locked|function.*does not exist|Could not find the function/i.test(
    rpcMsg
  );

  if (rpcMissing) {
    result.warnings.push(
      'insert_fulfillment_tickets_locked unavailable — apply migration 20260627140000'
    );
  } else if (rpcMsg) {
    result.warnings.push(`Ticket RPC failed: ${rpcMsg}`);
  }

  if (isProductionFulfillmentEnv() && !allowUnsafeFulfillmentFallback()) {
    result.error =
      result.error ||
      (rpcMissing
        ? 'Ticket fulfillment RPC unavailable in production'
        : `Ticket fulfillment RPC failed: ${rpcMsg || 'unknown error'}`);
    return { inserted: 0, skipped: insertRows.length, usedRpc: false, failed: true };
  }

  let inserted = 0;
  let skipped = 0;
  for (const row of insertRows) {
    const { data: ticketData, error: ticketError } = await dbClient
      .from('tickets')
      .insert({
        order_id: orderId,
        order_pass_id: row.pass.id,
        pass_sequence: row.pass_sequence,
        secure_token: row.secure_token,
        qr_code_url: row.qr_code_url,
        status: 'GENERATED',
        generated_at: row.generated_at,
      })
      .select(TICKETS_LIST_COLUMNS)
      .single();
    if (ticketError || !ticketData) {
      if (/duplicate|unique|pass_sequence/i.test(ticketError?.message || '')) {
        skipped += 1;
      } else {
        result.warnings.push(ticketError?.message || 'ticket insert failed');
      }
      continue;
    }
    inserted += 1;
  }
  result.warnings.push('UNSAFE: direct ticket insert fallback used (dev/local only)');
  return { inserted, skipped, usedRpc: false, failed: false };
}

function computeOnlineOrderAmounts(fullOrder, orderPasses, computeOnlinePaymentFees, inferFeeFromInclusiveTotal) {
  let totalAmount = fullOrder.total_with_fees ?? fullOrder.total_price ?? 0;
  const isOnlineOrder =
    fullOrder.payment_method === 'online' || fullOrder.source === 'platform_online';
  if (isOnlineOrder && (fullOrder.total_with_fees == null || fullOrder.total_with_fees === '')) {
    try {
      const notes = typeof fullOrder.notes === 'string' ? JSON.parse(fullOrder.notes) : fullOrder.notes;
      if (notes?.payment_fees?.total_with_fees != null) {
        totalAmount = Number(notes.payment_fees.total_with_fees);
      } else if (orderPasses?.length) {
        const sub = orderPasses.reduce(
          (s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1),
          0
        );
        if (sub > 0) totalAmount = computeOnlinePaymentFees(sub).totalWithFees;
      }
    } catch {
      /* keep fallback */
    }
  }
  const feeAmount =
    typeof fullOrder.fee_amount === 'number'
      ? fullOrder.fee_amount
      : isOnlineOrder && totalAmount > 0
        ? inferFeeFromInclusiveTotal(totalAmount)
        : undefined;
  const subtotalAmount = feeAmount != null ? totalAmount - feeAmount : undefined;
  return { totalAmount, feeAmount, subtotalAmount, isOnlineOrder };
}

function normalizePhoneForSms(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('216')) cleaned = cleaned.substring(3);
  cleaned = cleaned.replace(/^0+/, '');
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) return '+216' + cleaned;
  return null;
}

async function insertQrRegistry(dbClient, fullOrder, pass, ticketData) {
  try {
    const ambassador = fullOrder.ambassadors || null;
    const event = fullOrder.events || null;
    await dbClient.from('qr_tickets').insert({
      secure_token: ticketData.secure_token,
      ticket_id: ticketData.id,
      order_id: fullOrder.id,
      source: fullOrder.source,
      payment_method: fullOrder.payment_method || 'online',
      ambassador_id: fullOrder.ambassador_id || null,
      ambassador_name: ambassador?.full_name || null,
      ambassador_phone: ambassador?.phone || null,
      buyer_name: fullOrder.user_name,
      buyer_phone: fullOrder.user_phone,
      buyer_email: fullOrder.user_email || null,
      buyer_city: fullOrder.city,
      buyer_ville: fullOrder.ville || null,
      event_id: fullOrder.event_id || null,
      event_name: event?.name || null,
      event_date: event?.date || null,
      event_venue: event?.venue || null,
      order_pass_id: pass?.id || ticketData.order_pass_id,
      pass_type: pass?.pass_type || 'Standard',
      pass_price: pass?.price || 0,
      ticket_status: 'VALID',
      qr_code_url: ticketData.qr_code_url,
      generated_at: ticketData.generated_at || new Date().toISOString(),
    });
  } catch {
    /* registry must not block fulfillment */
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} dbClient
 * @param {object} deps
 * @param {{ orderId: string, source?: string, forceEmail?: boolean, dryRun?: boolean }} options
 */
async function fulfillPaidOrderTicketsAndEmail(dbClient, deps, options) {
  const {
    orderId,
    source = 'clictopay_confirm',
    forceEmail = false,
    forceSms = false,
    dryRun = false,
  } = options || {};

  const {
    buildTicketQrApiUrl,
    prepareTicketsByPassTypeForEmail,
    mergeEmailAttachments,
    sendTransactionalEmail,
    canSendTransactionalEmail,
    computeOnlinePaymentFees,
    inferFeeFromInclusiveTotal,
    buildOnlineTicketEmailHtml,
    tryBuildPremiumTicketsPdfAttachment,
    safeInsertEmailDeliveryLog,
    getEmailTransporter,
  } = deps;

  const result = {
    success: false,
    orderId,
    ticketsGenerated: false,
    ticketsCreatedCount: 0,
    ticketsExistingCount: 0,
    ticketsTotalCount: 0,
    emailAttempted: false,
    emailSent: false,
    smsAttempted: false,
    smsSent: false,
    error: null,
    warnings: [],
    dryRunActions: [],
  };

  const { data: fullOrder, error: fullOrderError } = await dbClient
    .from('orders')
    .select(ORDER_FULFILLMENT_SELECT)
    .eq('id', orderId)
    .single();

  if (fullOrderError || !fullOrder) {
    result.error = fullOrderError?.message || 'Failed to fetch order';
    return result;
  }

  if (fullOrder.status !== 'PAID') {
    result.error = `Order is not PAID (status: ${fullOrder.status})`;
    return result;
  }

  const { data: orderPasses, error: passesError } = await dbClient
    .from('order_passes')
    .select(ORDER_PASSES_COLUMNS)
    .eq('order_id', orderId);

  if (passesError) {
    result.error = `Failed to fetch order passes: ${passesError.message}`;
    return result;
  }
  if (!orderPasses?.length) {
    result.error = 'No passes found for this order';
    return result;
  }

  const { data: existingTicketsRaw, error: ticketsListError } = await dbClient
    .from('tickets')
    .select(TICKETS_LIST_COLUMNS)
    .eq('order_id', orderId);

  if (ticketsListError) {
    result.error = `Failed to list tickets: ${ticketsListError.message}`;
    return result;
  }

  const existingTickets = existingTicketsRaw || [];
  result.ticketsExistingCount = existingTickets.length;
  const expected = expectedTicketCount(orderPasses);

  if (existingTickets.length > expected) {
    result.warnings.push(
      `Ticket count (${existingTickets.length}) exceeds expected (${expected}); not deleting extras`
    );
  }

  const insertPlan = buildTicketInsertPlan(orderPasses, existingTickets);
  const toCreate = insertPlan.length;
  let newTickets = [];
  const priorSmsSent = await orderHasSuccessfulSms(dbClient, orderId);

  if (toCreate > 0 && dryRun) {
    for (const slot of insertPlan) {
      result.dryRunActions.push(
        `create ticket order_pass=${slot.pass.id} pass_sequence=${slot.pass_sequence}`
      );
    }
    result.ticketsCreatedCount = toCreate;
    result.warnings.push('dry-run: no tickets created');
  } else if (toCreate > 0) {
    const nowIso = new Date().toISOString();
    const preparedRows = [];
    for (const slot of insertPlan) {
      const secureToken = randomUuid();
      let ticketQrUrl;
      try {
        ticketQrUrl = buildTicketQrApiUrl(secureToken);
      } catch (err) {
        result.warnings.push(`QR URL build failed: ${err?.message || err}`);
        continue;
      }
      preparedRows.push({
        pass: slot.pass,
        pass_sequence: slot.pass_sequence,
        secure_token: secureToken,
        qr_code_url: ticketQrUrl,
        generated_at: nowIso,
      });
    }

    const lockResult = await insertTicketsUnderLock(dbClient, orderId, preparedRows, result);
    if (lockResult.failed) {
      if (!result.error) {
        result.error = 'Ticket fulfillment failed (RPC unavailable or rejected in production)';
      }
      return result;
    }
    result.warnings.push(
      `ticket insert: ${lockResult.inserted} inserted, ${lockResult.skipped} skipped` +
        (lockResult.usedRpc ? ' (advisory lock RPC)' : '')
    );

    const { data: refreshedTickets, error: refreshError } = await dbClient
      .from('tickets')
      .select(TICKETS_LIST_COLUMNS)
      .eq('order_id', orderId);

    if (refreshError) {
      result.warnings.push(`Ticket refresh failed: ${refreshError.message}`);
    } else {
      const beforeIds = new Set(existingTickets.map((t) => t.id));
      newTickets = (refreshedTickets || []).filter((t) => !beforeIds.has(t.id));
      for (const ticketData of newTickets) {
        const pass = orderPasses.find((p) => p.id === ticketData.order_pass_id);
        if (pass) await insertQrRegistry(dbClient, fullOrder, pass, ticketData);
      }
    }

    result.ticketsCreatedCount = newTickets.length;
    if (newTickets.length === 0 && existingTickets.length === 0 && toCreate > 0) {
      result.error = 'Failed to generate any tickets';
      return result;
    }
  }

  const allTickets = [...existingTickets, ...newTickets];
  result.ticketsTotalCount = dryRun && toCreate > 0
    ? existingTickets.length + toCreate
    : allTickets.length;
  result.ticketsGenerated = result.ticketsTotalCount > 0;
  result.success = result.ticketsGenerated;

  const ticketsNeedEmail = allTickets.some(
    (t) => t.email_delivery_status !== 'sent' && t.status !== 'DELIVERED'
  );
  const effectiveNewCount = dryRun ? toCreate : newTickets.length;
  const needsEmail = forceEmail || effectiveNewCount > 0 || ticketsNeedEmail;

  if (dryRun && needsEmail && fullOrder.user_email && canSendTransactionalEmail()) {
    result.dryRunActions.push(`send email to ${fullOrder.user_email}`);
    result.warnings.push('dry-run: no email sent');
  } else if (needsEmail && fullOrder.user_email && canSendTransactionalEmail()) {
    result.emailAttempted = true;
    try {
        const ticketsByPassType = new Map();
        for (const ticket of allTickets) {
          const pass = orderPasses.find((p) => p.id === ticket.order_pass_id);
          if (!pass) continue;
          const key = pass.pass_type;
          if (!ticketsByPassType.has(key)) ticketsByPassType.set(key, []);
          ticketsByPassType.get(key).push({ ...ticket, passType: key });
        }
        const passesSummary = orderPasses.map((p) => ({
          passType: p.pass_type,
          quantity: p.quantity,
          price: p.price,
        }));
        const { totalAmount, feeAmount, subtotalAmount } = computeOnlineOrderAmounts(
          fullOrder,
          orderPasses,
          computeOnlinePaymentFees,
          inferFeeFromInclusiveTotal
        );
        const { ticketsByPassType: enrichedMap, qrAttachments } =
          await prepareTicketsByPassTypeForEmail(ticketsByPassType);
        const emailHtml = buildOnlineTicketEmailHtml({
          customerName: fullOrder.user_name,
          orderNumber: fullOrder.order_number,
          orderId,
          eventName: fullOrder.events?.name,
          eventTime: fullOrder.events?.date,
          venueName: fullOrder.events?.venue,
          passes: passesSummary,
          totalAmount,
          feeAmount,
          subtotalAmount,
          ticketsByPassType: enrichedMap,
        });
        let premiumPdf = null;
        if (tryBuildPremiumTicketsPdfAttachment) {
          try {
            premiumPdf = await tryBuildPremiumTicketsPdfAttachment({
              order: fullOrder,
              event: fullOrder.events,
              tickets: allTickets,
              orderPasses,
            });
          } catch (pdfErr) {
            result.warnings.push(`Premium PDF skipped: ${pdfErr?.message || pdfErr}`);
          }
        }
        const mailOpts = {
          from: '"Andiamo Events" <contact@andiamoevents.com>',
          replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
          to: fullOrder.user_email,
          subject: 'Your Digital Tickets Are Ready - Andiamo Events',
          html: emailHtml,
        };
        if (premiumPdf) mailOpts.attachments = mergeEmailAttachments(qrAttachments, premiumPdf);
        else if (qrAttachments.length) mailOpts.attachments = qrAttachments;

        await sendTransactionalEmail({ getEmailTransporter }, mailOpts);
        result.emailSent = true;

        await dbClient
          .from('tickets')
          .update({
            status: 'DELIVERED',
            email_delivery_status: 'sent',
            delivered_at: new Date().toISOString(),
          })
          .in(
            'id',
            allTickets.map((t) => t.id)
          );

        const logRes = await safeInsertEmailDeliveryLog(dbClient, {
          order_id: orderId,
          email_type: 'ticket_delivery',
          recipient_email: fullOrder.user_email,
          recipient_name: fullOrder.user_name,
          subject: mailOpts.subject,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
        if (logRes.warning) result.warnings.push(logRes.warning);
      } catch (emailErr) {
        result.warnings.push(`Email: ${emailErr?.message || emailErr}`);
      }
  } else if (needsEmail && !fullOrder.user_email) {
    result.warnings.push('No customer email on order');
  } else if (needsEmail && !canSendTransactionalEmail()) {
    result.warnings.push('Email service not configured');
  }

  const needsSms =
    forceSms ||
    (effectiveNewCount > 0 && !priorSmsSent) ||
    (ticketsNeedEmail && !priorSmsSent && forceEmail);

  if (dryRun && needsSms && fullOrder.user_phone && process.env.WINSMS_API_KEY) {
    result.dryRunActions.push(`send SMS to ${fullOrder.user_phone}`);
    result.warnings.push('dry-run: no SMS sent');
  } else if (needsSms && fullOrder.user_phone && process.env.WINSMS_API_KEY) {
    result.smsAttempted = true;
    try {
          const formattedPhone = normalizePhoneForSms(fullOrder.user_phone);
          if (formattedPhone) {
            const { totalAmount, isOnlineOrder } = computeOnlineOrderAmounts(
              fullOrder,
              orderPasses,
              computeOnlinePaymentFees,
              inferFeeFromInclusiveTotal
            );
            let totalForSms = totalAmount;
            if (isOnlineOrder && orderPasses?.length) {
              const subtotal = orderPasses.reduce(
                (s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1),
                0
              );
              if (subtotal > 0) totalForSms = computeOnlinePaymentFees(subtotal).totalWithFees;
            }
            const totalDisplay = parseFloat(Number(totalForSms).toString()).toFixed(2);
            const smsMsg = `Paiement confirmé #${fullOrder.order_number != null ? fullOrder.order_number : ''}
Total: ${totalDisplay} DT
Billets envoyés par email. We Create Memories`;

            const qs = require('querystring');
            const https = require('https');
            const url = `https://www.winsmspro.com/sms/sms/api?${qs.stringify({
              action: 'send-sms',
              api_key: process.env.WINSMS_API_KEY,
              to: formattedPhone,
              sms: smsMsg,
              from: 'Andiamo',
              response: 'json',
            })}`;

            const smsRes = await new Promise((resolve, reject) => {
              https
                .get(url, (r) => {
                  let d = '';
                  r.on('data', (c) => (d += c));
                  r.on('end', () => {
                    try {
                      resolve({ status: r.statusCode, data: JSON.parse(d) });
                    } catch {
                      resolve({ status: r.statusCode, data: d });
                    }
                  });
                })
                .on('error', reject);
            });

            const isSuccess =
              smsRes.status === 200 &&
              smsRes.data &&
              (smsRes.data.code === 'ok' ||
                smsRes.data.code === '200' ||
                (smsRes.data.message &&
                  typeof smsRes.data.message === 'string' &&
                  smsRes.data.message.toLowerCase().includes('success')));

            try {
              await dbClient.from('sms_logs').insert({
                order_id: fullOrder.id,
                phone_number: fullOrder.user_phone,
                message: smsMsg.trim(),
                status: isSuccess ? 'sent' : 'failed',
                api_response:
                  typeof smsRes.data === 'string' ? smsRes.data : JSON.stringify(smsRes.data || null),
                sent_at: isSuccess ? new Date().toISOString() : null,
                error_message: isSuccess
                  ? null
                  : (smsRes.data && smsRes.data.message) || 'SMS sending failed',
              });
            } catch (logErr) {
              result.warnings.push(`SMS log failed: ${logErr?.message || logErr}`);
            }

            if (isSuccess) result.smsSent = true;
          }
        } catch (smsErr) {
          result.warnings.push(`SMS: ${smsErr?.message || smsErr}`);
        }
  }

  if (dryRun) {
    result.emailAttempted = false;
    result.emailSent = false;
    result.smsAttempted = false;
    result.smsSent = false;
  }

  if (result.error == null && !result.success && result.ticketsTotalCount > 0) {
    result.success = true;
  }

  return result;
}

const FULFILLMENT_FEE_MODULE = 'online-payment-fee.cjs';

/**
 * Ensures callers pass `api/_lib`, not an API entrypoint directory (`api/`).
 * @param {string} fulfillmentLibDir Absolute or project-relative path to api/_lib
 */
function assertFulfillmentLibDir(fulfillmentLibDir, nodePath) {
  if (!fulfillmentLibDir || typeof fulfillmentLibDir !== 'string') {
    throw new Error(
      `Invalid fulfillment lib directory: expected api/_lib, received ${String(fulfillmentLibDir)}`
    );
  }
  const feePath = nodePath.join(fulfillmentLibDir, FULFILLMENT_FEE_MODULE);
  const normalized = feePath.replace(/\\/g, '/');
  if (
    !normalized.includes('/_lib/online-payment-fee.cjs') &&
    !normalized.endsWith('_lib/online-payment-fee.cjs')
  ) {
    throw new Error(
      `Invalid fulfillment lib directory: expected api/_lib, received ${fulfillmentLibDir} (resolved ${FULFILLMENT_FEE_MODULE} to ${normalized})`
    );
  }
}

function buildFulfillmentDepsFromMisc(requireFromRoot, nodePath, fulfillmentLibDir) {
  assertFulfillmentLibDir(fulfillmentLibDir, nodePath);
  const lib = (file) => nodePath.join(fulfillmentLibDir, file);
  const { computeOnlinePaymentFees, inferFeeFromInclusiveTotal } = requireFromRoot(
    lib(FULFILLMENT_FEE_MODULE)
  );
  const { buildTicketQrApiUrl } = requireFromRoot(lib('r2-media.cjs'));
  const {
    prepareTicketsByPassTypeForEmail,
    mergeEmailAttachments,
  } = requireFromRoot(lib('ticket-qr-email.cjs'));
  const { sendTransactionalEmail } = requireFromRoot(lib('transactional-email.cjs'));
  const { canSendTransactionalEmail } = requireFromRoot(lib('can-send-transactional-email.cjs'));
  const { buildOnlineTicketEmailHtml } = requireFromRoot(lib('online-ticket-email-html.cjs'));
  const { safeInsertEmailDeliveryLog } = requireFromRoot(lib('safe-email-delivery-log.cjs'));
  let tryBuildPremiumTicketsPdfAttachment = null;
  try {
    tryBuildPremiumTicketsPdfAttachment =
      requireFromRoot(lib('render-premium-ticket-pdf.cjs')).tryBuildPremiumTicketsPdfAttachment;
  } catch {
    /* optional */
  }

  const getEmailTransporter = () => {
    const nodemailer = require('nodemailer');
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  };

  return {
    buildTicketQrApiUrl,
    prepareTicketsByPassTypeForEmail,
    mergeEmailAttachments,
    sendTransactionalEmail,
    canSendTransactionalEmail,
    computeOnlinePaymentFees,
    inferFeeFromInclusiveTotal,
    buildOnlineTicketEmailHtml,
    tryBuildPremiumTicketsPdfAttachment,
    safeInsertEmailDeliveryLog,
    getEmailTransporter,
  };
}

function fulfillmentResultToLegacyResponse(fulfillment) {
  const ticketError =
    fulfillment.error ||
    (fulfillment.warnings.length ? fulfillment.warnings.join('; ') : null);
  return {
    success: fulfillment.success,
    message: fulfillment.success ? 'Tickets generated' : fulfillment.error,
    ticketsCount: fulfillment.ticketsTotalCount,
    ticketsCreatedCount: fulfillment.ticketsCreatedCount,
    ticketsExistingCount: fulfillment.ticketsExistingCount,
    emailSent: fulfillment.emailSent,
    smsSent: fulfillment.smsSent,
    error: ticketError,
    warnings: fulfillment.warnings,
  };
}

function buildPaymentConfirmJson(fulfillment, extra = {}) {
  const legacy = fulfillmentResultToLegacyResponse(fulfillment);
  const paymentConfirmed = extra.paymentConfirmed !== false;
  const fulfillmentComplete =
    fulfillment.success &&
    fulfillment.ticketsTotalCount > 0 &&
    (!fulfillment.emailAttempted || fulfillment.emailSent);

  return {
    success: paymentConfirmed,
    paymentConfirmed,
    fulfillmentComplete,
    orderId: fulfillment.orderId,
    status: 'PAID',
    ticketsGenerated: fulfillment.ticketsGenerated,
    ticketsCount: fulfillment.ticketsTotalCount,
    ticketsCreatedCount: fulfillment.ticketsCreatedCount,
    emailSent: fulfillment.emailSent,
    emailAttempted: fulfillment.emailAttempted,
    smsSent: fulfillment.smsSent,
    smsAttempted: fulfillment.smsAttempted,
    ticketError: legacy.error,
    fulfillmentWarnings: fulfillment.warnings,
    fulfillment,
    ...extra,
  };
}

module.exports = {
  ORDER_PASSES_COLUMNS,
  ORDER_FULFILLMENT_SELECT,
  TICKETS_LIST_COLUMNS,
  FORBIDDEN_ORDER_PASSES_SELECT_COLUMNS,
  expectedTicketCount,
  ticketsNeededPerPass,
  buildTicketInsertPlan,
  insertTicketsUnderLock,
  orderHasSuccessfulSms,
  isProductionFulfillmentEnv,
  allowUnsafeFulfillmentFallback,
  fulfillPaidOrderTicketsAndEmail,
  buildFulfillmentDepsFromMisc,
  assertFulfillmentLibDir,
  fulfillmentResultToLegacyResponse,
  buildPaymentConfirmJson,
};

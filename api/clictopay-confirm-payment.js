// POST/GET /api/clictopay-confirm-payment
// Dedicated Vercel function (do not route through misc.js rewrite — path dispatch breaks on rewrite).

import '../lib/sentry-server.js';
// Bare imports for Vercel Node File Trace — must live in this entrypoint, not only in api/_lib.
import 'qrcode';
import 'dijkstrajs';
import 'pngjs';
import 'pdf-lib';
import 'puppeteer-core';
import '@sparticuz/chromium';
import 'follow-redirects';
import 'nodemailer';
import { createRequire } from 'module';
import nodePath from 'path';
import { fileURLToPath } from 'url';
import { createServiceRoleClient } from './_lib/service-role-client.js';

const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
const fulfillmentLibDir = nodePath.join(__dirname, '_lib');
const requireFromRoot = createRequire(import.meta.url);

const { ensureSupabaseServerEnv } = requireFromRoot(
  nodePath.join(__dirname, '_lib', 'supabase-env.cjs')
);
ensureSupabaseServerEnv();

const { handleClicToPayConfirmPayment } = requireFromRoot(
  nodePath.join(__dirname, '_lib', 'clictopay-confirm-payment.cjs')
);
const {
  getClientIp,
  enforceRateLimits,
  respondToRateLimit,
} = requireFromRoot(nodePath.join(__dirname, '_lib', 'rate-limit', 'index.cjs'));
const {
  extractPaymentConfirmOrderId,
  isValidPaymentConfirmOrderId,
} = requireFromRoot(nodePath.join(__dirname, '_lib', 'rate-limit', 'payment-confirm-extract.cjs'));
const { processConfirmedTicketPurchaseTracking } = requireFromRoot(
  nodePath.join(__dirname, '_lib', 'meta', 'ticket-purchase-tracking.cjs')
);

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../lib/cors.js');
  }
  return corsUtils;
}

async function parseBody(req) {
  const b = req.body;
  if (b !== undefined && b !== null) {
    if (Buffer.isBuffer(b)) {
      try {
        const t = b.toString('utf8');
        return t.trim() ? JSON.parse(t) : {};
      } catch {
        return {};
      }
    }
    if (typeof b === 'string' && b.trim()) {
      try {
        return JSON.parse(b);
      } catch {
        return {};
      }
    }
    if (typeof b === 'object' && !Array.isArray(b)) {
      return b;
    }
  }
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

async function runTicketMetaTrackingSafe(dbClient, orderId, req) {
  try {
    return await processConfirmedTicketPurchaseTracking(dbClient, orderId, { req });
  } catch (err) {
    console.warn(
      '[Ticket Meta Tracking] tracking failed:',
      err instanceof Error ? err.message : err
    );
    return { trackable: false, pixel: null, capi: { attempted: false, ok: false, skipped: true } };
  }
}

export default async function handler(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (handlePreflight(req, res, { methods: 'GET, POST, OPTIONS', headers: 'Content-Type' })) return;
  if (!setCORSHeaders(res, req, { methods: 'GET, POST', headers: 'Content-Type' })) {
    if (req.headers?.origin) {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
  }

  const method = req.method;
  if (method !== 'POST' && method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  const ipRl = await enforceRateLimits({
    req,
    policyId: 'PAYMENT_CONFIRM',
    segments: { ip: clientIp },
  });
  if (respondToRateLimit(res, ipRl)) return;

  let bodyData = {};
  if (method === 'POST') {
    bodyData = await parseBody(req);
  }
  const orderId = extractPaymentConfirmOrderId(method, bodyData, req.url);
  if (!orderId || !isValidPaymentConfirmOrderId(orderId)) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const orderRl = await enforceRateLimits({
    req,
    policyId: 'PAYMENT_CONFIRM',
    segments: { order: orderId },
  });
  if (respondToRateLimit(res, orderRl)) return;

  return handleClicToPayConfirmPayment({
    req,
    res,
    method,
    validatedOrderId: orderId,
    parseBody,
    createServiceRoleClient,
    requireFromRoot,
    nodePath,
    fulfillmentLibDir,
    runTicketMetaTrackingSafe,
  });
}

// POST /api/orders/create
// Server-side order creation with atomic stock reservation
// Vercel serverless function

import '../lib/sentry-server.js';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import nodemailer from 'nodemailer';
import querystring from 'querystring';
import https from 'https';

const requireCjs = createRequire(import.meta.url);
const { buildOrderConfirmationEmailHtml } = requireCjs('./lib/order-confirmation-email-html.cjs');

// --- Basic helpers (shared within this module) ---

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
}

// Per-IP rate limit: 10 orders per hour per IP
const orderRateByIp = new Map();
const ORDER_IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ORDER_IP_MAX = 10;

function checkOrderIpRateLimit(ip) {
  const now = Date.now();
  let rec = orderRateByIp.get(ip);
  if (!rec || now > rec.resetAt) {
    orderRateByIp.set(ip, { count: 1, resetAt: now + ORDER_IP_WINDOW_MS });
    return true;
  }
  rec.count += 1;
  if (rec.count > ORDER_IP_MAX) return false;
  return true;
}

// Per-device/browser soft limit via X-Device-Id header: 3 orders per 10 minutes
const orderRateByDevice = new Map();
const ORDER_DEVICE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const ORDER_DEVICE_MAX = 3;

function getDeviceId(req) {
  const raw = req.headers['x-device-id'];
  if (!raw) return null;
  // Normalize and cap length to avoid abuse
  return String(Array.isArray(raw) ? raw[0] : raw).slice(0, 128) || null;
}

function checkOrderDeviceRateLimit(deviceId) {
  if (!deviceId) return true; // cannot enforce device limit without identifier
  const now = Date.now();
  let rec = orderRateByDevice.get(deviceId);
  if (!rec || now > rec.resetAt) {
    orderRateByDevice.set(deviceId, { count: 1, resetAt: now + ORDER_DEVICE_WINDOW_MS });
    return true;
  }
  rec.count += 1;
  if (rec.count > ORDER_DEVICE_MAX) return false;
  return true;
}

// Validate phone: 8 digits, first digit 2, 4, 5, or 9 (Tunisian format)
function validateOrderPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 8 && ['2', '4', '5', '9'].includes(digits[0]);
}

// Validate email: non-empty, contains @ and dot, max 254 chars
function validateOrderEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

async function logOrderCreateFailure(dbClient, req, statusCode, details) {
  if (!dbClient) return;
  try {
    const ip = getClientIp(req);
    await dbClient.from('security_audit_logs').insert({
      event_type: 'order_create_failed',
      endpoint: 'POST /api/orders/create',
      request_method: 'POST',
      request_path: '/api/orders/create',
      ip_address: ip,
      user_agent: req.headers['user-agent'] || 'unknown',
      response_status: statusCode,
      details: details || {},
      severity: statusCode >= 500 ? 'high' : 'medium'
    });
  } catch (e) {
    console.error('Failed to log order_create_failed:', e);
  }
}

async function logOrderCreateSuccess(dbClient, req, orderId, details) {
  if (!dbClient) return;
  try {
    const ip = getClientIp(req);
    await dbClient.from('security_audit_logs').insert({
      event_type: 'order_create_success',
      endpoint: 'POST /api/orders/create',
      request_method: 'POST',
      request_path: '/api/orders/create',
      ip_address: ip,
      user_agent: req.headers['user-agent'] || 'unknown',
      response_status: 201,
      details: { order_id: orderId, ...details },
      severity: 'low'
    });
  } catch (e) {
    console.error('Failed to log order_create_success:', e);
  }
}

// Import shared CORS utility (using dynamic import for ES modules)
let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../lib/cors.js');
  }
  return corsUtils;
}

export default async (req, res) => {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  
  // Handle preflight requests
  if (handlePreflight(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type', credentials: true })) {
    return; // Preflight handled
  }
  
  // Set CORS headers for actual requests
  if (!setCORSHeaders(res, req, { methods: 'POST, OPTIONS', headers: 'Content-Type', credentials: true })) {
    if (req.headers.origin) {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- Rate limiting: IP + device/browser (soft limit) ---
    const ip = getClientIp(req);
    if (!checkOrderIpRateLimit(ip)) {
      return res.status(429).json({
        error: 'Too many orders. Please try again later.'
      });
    }

    const deviceId = getDeviceId(req);
    if (!checkOrderDeviceRateLimit(deviceId)) {
      return res.status(429).json({
        error: 'Too many orders. Please try again later.'
      });
    }

    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('❌ Missing Supabase environment variables:', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
      });
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Initialize Supabase client early (for audit logging)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    let dbClient = supabase;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      dbClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      console.log('✅ Using service role key for order creation (bypasses RLS)');
    } else {
      console.warn('⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Order creation may fail due to RLS policies.');
    }

    // Parse request body
    let bodyData;
    if (req.body) {
      bodyData = req.body;
    } else {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      bodyData = JSON.parse(body);
    }

    const {
      customerInfo,
      passes,
      paymentMethod,
      ambassadorId,
      eventId,
      recaptchaToken,
      idempotencyKey
    } = bodyData;

    // reCAPTCHA: bypass if localhost-bypass-token or RECAPTCHA_SECRET_KEY not set
    const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
    const shouldBypassRecaptcha = recaptchaToken === 'localhost-bypass-token' || !RECAPTCHA_SECRET_KEY;
    if (!shouldBypassRecaptcha) {
      if (!recaptchaToken) {
        await logOrderCreateFailure(dbClient, req, 400, { error: 'reCAPTCHA verification required' });
        return res.status(400).json({ error: 'reCAPTCHA verification required' });
      }
      try {
        const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        });
        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
          await logOrderCreateFailure(dbClient, req, 400, { error: 'reCAPTCHA verification failed' });
          return res.status(400).json({
            error: 'reCAPTCHA verification failed',
            details: verifyData['error-codes']?.join(', ') || 'Please complete the reCAPTCHA verification and try again.'
          });
        }
      } catch (recaptchaError) {
        console.error('reCAPTCHA verification error:', recaptchaError);
        await logOrderCreateFailure(dbClient, req, 500, { error: 'reCAPTCHA service unavailable' });
        return res.status(500).json({
          error: 'reCAPTCHA verification service unavailable',
          details: 'Unable to verify reCAPTCHA. Please try again later.'
        });
      }
    }

    // Validate required fields
    if (!customerInfo || !passes || !paymentMethod) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'Missing required fields' });
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'customerInfo, passes, and paymentMethod are required'
      });
    }

    if (!Array.isArray(passes) || passes.length === 0) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'Invalid passes' });
      return res.status(400).json({
        error: 'Invalid passes',
        details: 'passes must be a non-empty array'
      });
    }

    // Validate customer info (required fields)
    if (!customerInfo.full_name || !customerInfo.phone || !customerInfo.email || !customerInfo.city) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'Missing customer information' });
      return res.status(400).json({
        error: 'Missing customer information',
        details: 'full_name, phone, email, and city are required'
      });
    }

    // Phone: 8 digits, first digit 2, 4, 5, or 9
    if (!validateOrderPhone(customerInfo.phone)) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'Invalid phone number' });
      return res.status(400).json({
        error: 'Invalid phone number',
        details: 'Phone must be 8 digits starting with 2, 4, 5, or 9.'
      });
    }
    // Email: format and length
    if (!validateOrderEmail(customerInfo.email)) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'Invalid email' });
      return res.status(400).json({
        error: 'Invalid email',
        details: 'Please provide a valid email address.'
      });
    }

    // Validate payment method
    const validPaymentMethods = ['online', 'external_app', 'ambassador_cash'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'Invalid payment method' });
      return res.status(400).json({
        error: 'Invalid payment method',
        details: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
      });
    }

    // Validate ambassador for ambassador_cash (required)
    if (paymentMethod === 'ambassador_cash' && !ambassadorId) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'Ambassador ID required' });
      return res.status(400).json({
        error: 'Ambassador ID required',
        details: 'ambassadorId is required for ambassador_cash payment method'
      });
    }

    // Ambassador must exist and be active (not paused) for ambassador_cash
    if (paymentMethod === 'ambassador_cash' && ambassadorId) {
      const { data: ambassador, error: ambassadorError } = await dbClient
        .from('ambassadors')
        .select('id, status')
        .eq('id', ambassadorId)
        .single();
      if (ambassadorError || !ambassador) {
        await logOrderCreateFailure(dbClient, req, 400, { error: 'Ambassador not found' });
        return res.status(400).json({ error: 'Ambassador not found', details: 'The selected ambassador was not found.' });
      }
      const activeStatuses = ['approved', 'ACTIVE'];
      if (!activeStatuses.includes(ambassador.status)) {
        await logOrderCreateFailure(dbClient, req, 400, { error: 'Ambassador cannot receive orders' });
        return res.status(400).json({
          error: 'This ambassador cannot receive new orders',
          details: 'The selected ambassador is paused or not active.'
        });
      }
    }

    // Idempotency: if key provided, return existing order if already created
    const safeIdempotencyKey = idempotencyKey && typeof idempotencyKey === 'string'
      ? idempotencyKey.trim().slice(0, 128)
      : null;
    if (safeIdempotencyKey) {
      const { data: existingOrder, error: lookupErr } = await dbClient
        .from('orders')
        .select('id')
        .eq('idempotency_key', safeIdempotencyKey)
        .maybeSingle();
      if (!lookupErr && existingOrder) {
        const { data: existingWithPasses } = await dbClient
          .from('orders')
          .select('*, order_passes (*)')
          .eq('id', existingOrder.id)
          .single();
        return res.status(200).json({
          success: true,
          order: existingWithPasses || existingOrder
        });
      }
    }

    // STEP 1: Validate all passes exist and are active
    const passIds = passes.map(p => p.passId);
    const { data: eventPasses, error: passesError } = await dbClient
      .from('event_passes')
      .select('id, name, price, is_active, max_quantity, sold_quantity, allowed_payment_methods, event_id')
      .in('id', passIds);

    if (passesError) {
      console.error('Error fetching passes:', passesError);
      await logOrderCreateFailure(dbClient, req, 500, { error: 'Failed to validate passes', details: passesError.message });
      return res.status(500).json({
        error: 'Failed to validate passes',
        details: passesError.message
      });
    }

    if (!eventPasses || eventPasses.length !== passIds.length) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'One or more passes not found' });
      return res.status(400).json({
        error: 'Invalid passes',
        details: 'One or more passes not found'
      });
    }

    const orderEventIds = [...new Set((eventPasses || []).map((p) => p.event_id).filter(Boolean))];
    if (orderEventIds.length > 0) {
      const { data: evRows, error: evErr } = await dbClient
        .from('events')
        .select('id, event_status')
        .in('id', orderEventIds);
      if (!evErr && evRows) {
        const blocked = evRows.find(
          (e) => e.event_status === 'completed' || e.event_status === 'cancelled'
        );
        if (blocked) {
          await logOrderCreateFailure(dbClient, req, 400, {
            error: 'Event not available for purchase',
            eventId: blocked.id,
            event_status: blocked.event_status
          });
          return res.status(400).json({
            error: 'Event not available for purchase',
            details:
              blocked.event_status === 'cancelled'
                ? 'This event has been cancelled.'
                : 'Pass sales are closed for this event.'
          });
        }
      }
    }

    // Create pass lookup map
    const passMap = new Map();
    eventPasses.forEach(p => passMap.set(p.id, p));

    // STEP 2: Validate each pass and check stock availability
    const validatedPasses = [];
    for (const pass of passes) {
      const eventPass = passMap.get(pass.passId);
      
      if (!eventPass) {
        await logOrderCreateFailure(dbClient, req, 400, { error: 'Invalid pass', passId: pass.passId });
        return res.status(400).json({
          error: 'Invalid pass',
          details: `Pass ${pass.passId} not found`
        });
      }

      // Check if pass is active
      if (!eventPass.is_active) {
        await logOrderCreateFailure(dbClient, req, 400, { error: 'Pass not available', passName: eventPass.name });
        return res.status(400).json({
          error: 'Pass not available',
          details: `Pass "${eventPass.name}" is no longer available for purchase`
        });
      }

      // Validate payment method compatibility (BACKEND ENFORCEMENT - MANDATORY)
      // If allowed_payment_methods is NULL, allow all methods (backward compatible)
      if (eventPass.allowed_payment_methods && eventPass.allowed_payment_methods.length > 0) {
        if (!eventPass.allowed_payment_methods.includes(paymentMethod)) {
          await logOrderCreateFailure(dbClient, req, 400, { error: 'Payment method not allowed' });
          return res.status(400).json({
            error: 'Payment method not allowed',
            details: `Pass "${eventPass.name}" is only available with the following payment methods: ${eventPass.allowed_payment_methods.join(', ')}. Selected method: ${paymentMethod}`
          });
        }
      }

      // Validate price (server is authority for pricing)
      if (parseFloat(eventPass.price) !== parseFloat(pass.price)) {
        console.warn(`Price mismatch for pass ${pass.passId}: client=${pass.price}, server=${eventPass.price}`);
        // Use server price
        pass.price = parseFloat(eventPass.price);
      }

      // Check stock availability
      if (eventPass.max_quantity !== null) {
        const remaining = eventPass.max_quantity - eventPass.sold_quantity;
        if (remaining < pass.quantity) {
          await logOrderCreateFailure(dbClient, req, 400, { error: 'Insufficient stock', remaining, requested: pass.quantity });
          return res.status(400).json({
            error: 'Insufficient stock',
            details: `Only ${remaining} ${eventPass.name} pass(es) available, requested ${pass.quantity}`
          });
        }
      }

      validatedPasses.push({
        ...pass,
        eventPass: eventPass
      });
    }

    // Max 10 passes per order
    const totalQuantityForCap = validatedPasses.reduce((sum, p) => sum + p.quantity, 0);
    if (totalQuantityForCap > 10) {
      await logOrderCreateFailure(dbClient, req, 400, { error: 'Maximum 10 passes per order' });
      return res.status(400).json({
        error: 'Maximum 10 passes per order',
        details: 'You can order at most 10 passes per order.'
      });
    }

    // STEP 3: Atomically reserve stock for ALL passes (all-or-nothing)
    const stockReservations = [];
    for (const validatedPass of validatedPasses) {
      const { id, max_quantity, sold_quantity } = validatedPass.eventPass;

      // If unlimited stock, skip reservation
      if (max_quantity === null) {
        stockReservations.push({ passId: id, reserved: true, unlimited: true });
        continue;
      }

      // Atomic stock reservation
      // First re-fetch current stock to check availability (prevents stale reads)
      const { data: currentPass, error: fetchError } = await dbClient
        .from('event_passes')
        .select('sold_quantity, max_quantity, is_active')
        .eq('id', id)
        .single();

      if (fetchError || !currentPass) {
        // Rollback already reserved stock
        for (const reservation of stockReservations) {
          if (!reservation.unlimited && reservation.reserved) {
            const prevPass = validatedPasses.find(p => p.passId === reservation.passId);
            if (prevPass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - prevPass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }
        await logOrderCreateFailure(dbClient, req, 400, { error: 'Pass not found', passId: id });
        return res.status(400).json({
          error: 'Pass not found',
          details: `Pass with ID ${id} not found`
        });
      }

      // Check stock availability with current values
      if (!currentPass.is_active) {
        // Rollback
        for (const reservation of stockReservations) {
          if (!reservation.unlimited && reservation.reserved) {
            const prevPass = validatedPasses.find(p => p.passId === reservation.passId);
            if (prevPass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - prevPass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }
        await logOrderCreateFailure(dbClient, req, 400, { error: 'Pass no longer active', passName: validatedPass.eventPass.name });
        return res.status(400).json({
          error: 'Pass not available',
          details: `Pass "${validatedPass.eventPass.name}" is no longer active`
        });
      }

      if (currentPass.max_quantity !== null) {
        const newSoldQuantity = currentPass.sold_quantity + validatedPass.quantity;
        if (newSoldQuantity > currentPass.max_quantity) {
          // Rollback
          for (const reservation of stockReservations) {
            if (!reservation.unlimited && reservation.reserved) {
              const prevPass = validatedPasses.find(p => p.passId === reservation.passId);
              if (prevPass) {
                const { data: currentStock } = await dbClient
                  .from('event_passes')
                  .select('sold_quantity')
                  .eq('id', reservation.passId)
                  .single();
                if (currentStock) {
                  await dbClient
                    .from('event_passes')
                    .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - prevPass.quantity) })
                    .eq('id', reservation.passId);
                }
              }
            }
          }
          const remaining = currentPass.max_quantity - currentPass.sold_quantity;
          await logOrderCreateFailure(dbClient, req, 400, { error: 'Insufficient stock', remaining, requested: validatedPass.quantity });
          return res.status(400).json({
            error: 'Insufficient stock',
            details: `Only ${remaining} ${validatedPass.eventPass.name} pass(es) available, requested ${validatedPass.quantity}`
          });
        }
      }

      // Atomic UPDATE - only succeeds if conditions still met
      const { data: updatedPass, error: reserveError } = await dbClient
        .from('event_passes')
        .update({
          sold_quantity: currentPass.sold_quantity + validatedPass.quantity
        })
        .eq('id', id)
        .eq('is_active', true)
        .eq('sold_quantity', currentPass.sold_quantity)  // Ensure no one else updated it
        .select('id, sold_quantity')
        .single();

      if (reserveError || !updatedPass) {
        // Stock reservation failed - need to release already reserved stock
        console.error(`Stock reservation failed for pass ${id}:`, reserveError);
        
        // Release any already reserved stock
        for (const reservation of stockReservations) {
          if (!reservation.unlimited && reservation.reserved) {
            const pass = validatedPasses.find(p => p.passId === reservation.passId);
            if (pass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - pass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }

        await logOrderCreateFailure(dbClient, req, 400, { error: 'Stock reservation failed', passName: validatedPass.eventPass.name });
        return res.status(400).json({
          error: 'Stock reservation failed',
          details: `Insufficient stock for "${validatedPass.eventPass.name}" or pass is no longer active`
        });
      }

      stockReservations.push({ passId: id, reserved: true, unlimited: false });
    }

    // STEP 4: Calculate totals (server-side authority)
    const totalQuantity = validatedPasses.reduce((sum, p) => sum + p.quantity, 0);
    const subtotal = validatedPasses.reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0);
    // Apply 5% fee only for online card payments; other methods use pure subtotal.
    let feeAmount = 0;
    let totalWithFees = subtotal;
    if (paymentMethod === 'online' && subtotal > 0) {
      feeAmount = Number((subtotal * 0.05).toFixed(3));
      totalWithFees = subtotal + feeAmount;
    }

    // STEP 5: Determine initial status
    let initialStatus;
    switch (paymentMethod) {
      case 'online':
      case 'external_app':
        initialStatus = 'PENDING_ONLINE';
        break;
      case 'ambassador_cash':
        initialStatus = 'PENDING_CASH';
        break;
      default:
        // Rollback stock reservations
        for (const reservation of stockReservations) {
          if (!reservation.unlimited) {
            const pass = validatedPasses.find(p => p.passId === reservation.passId);
            if (pass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - pass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }
        await logOrderCreateFailure(dbClient, req, 400, { error: 'Invalid payment method', paymentMethod });
        return res.status(400).json({
          error: 'Invalid payment method',
          details: `Unknown payment method: ${paymentMethod}`
        });
    }

    // STEP 6: Create order
    const isOnline = paymentMethod !== 'ambassador_cash';
    const orderData = {
      source: paymentMethod === 'ambassador_cash' ? 'platform_cod' : 'platform_online',
      user_name: customerInfo.full_name.trim(),
      user_phone: customerInfo.phone.trim(),
      user_email: customerInfo.email.trim() || null,
      city: customerInfo.city.trim(),
      ville: customerInfo.ville?.trim() || null,
      event_id: eventId || null,
      ambassador_id: ambassadorId || null,
      quantity: totalQuantity,
      // For online orders, total_price is fee-inclusive and mirrors total_with_fees.
      total_price: isOnline ? totalWithFees : subtotal,
      fee_amount: isOnline ? feeAmount : null,
      total_with_fees: isOnline ? totalWithFees : null,
      payment_method: paymentMethod,
      status: initialStatus,
      payment_status: isOnline ? 'PENDING_PAYMENT' : null,  // So "Pending Payment" filter works
      stock_released: false,  // Stock is reserved, not released
      assigned_at: ambassadorId ? new Date().toISOString() : null,
      idempotency_key: safeIdempotencyKey || null,
      notes: JSON.stringify({
        all_passes: validatedPasses.map(p => ({
          passId: p.passId,
          passName: p.passName,
          quantity: p.quantity,
          price: p.price
        })),
        total_order_price: isOnline ? totalWithFees : subtotal,
        pass_count: validatedPasses.length,
        // Persist fee breakdown for online payments so admin and reports can see with/without fees.
        ...(paymentMethod === 'online'
          ? {
              payment_fees: {
                fee_rate: 0.05,
                fee_amount: feeAmount,
                subtotal,
                total_with_fees: totalWithFees
              }
            }
          : {})
      })
    };

    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      // Rollback stock reservations
      console.error('Order creation failed, rolling back stock:', orderError);
      for (const reservation of stockReservations) {
        if (!reservation.unlimited) {
          const pass = validatedPasses.find(p => p.passId === reservation.passId);
          if (pass) {
            const { data: currentStock } = await dbClient
              .from('event_passes')
              .select('sold_quantity')
              .eq('id', reservation.passId)
              .single();
            if (currentStock) {
              await dbClient
                .from('event_passes')
                .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - pass.quantity) })
                .eq('id', reservation.passId);
            }
          }
        }
      }
      await logOrderCreateFailure(dbClient, req, 500, { error: 'Failed to create order', details: orderError.message });
      return res.status(500).json({
        error: 'Failed to create order',
        details: orderError.message
      });
    }

    // STEP 7: Create order_passes WITH pass_id (REQUIRED)
    const orderPassesData = validatedPasses.map(pass => ({
      order_id: order.id,
      pass_id: pass.passId,  // REQUIRED for stock release
      pass_type: pass.passName,  // Historical display
      quantity: pass.quantity,
      price: parseFloat(pass.price)
    }));

    const { error: passesInsertError } = await dbClient
      .from('order_passes')
      .insert(orderPassesData);

    if (passesInsertError) {
        // Rollback: delete order and release stock
        console.error('Order passes creation failed, rolling back:', passesInsertError);
        await dbClient.from('orders').delete().eq('id', order.id);
        for (const reservation of stockReservations) {
          if (!reservation.unlimited) {
            const pass = validatedPasses.find(p => p.passId === reservation.passId);
            if (pass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - pass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }
      await logOrderCreateFailure(dbClient, req, 500, { error: 'Failed to create order passes', details: passesInsertError.message });
      return res.status(500).json({
        error: 'Failed to create order passes',
        details: passesInsertError.message
      });
    }

    // STEP 8: Send SMS notifications and emails for COD orders
    // Both SMS and emails are sent here directly - with timeout to prevent blocking
    if (paymentMethod === 'ambassador_cash' && ambassadorId) {
      console.log(`📱📧 Order ${order.id} is ambassador_cash - attempting to send SMS and emails...`);
      
      // Send SMS and emails in parallel with timeout
      // In Vercel serverless, we need to await before response is sent
      // But use timeout to prevent blocking too long
      try {
        await Promise.race([
          Promise.all([
            // Send SMS to client
            sendClientOrderConfirmationSMS(order.id, dbClient).catch(smsError => {
              console.error(`📱 Client SMS failed for order ${order.id} (non-fatal):`, smsError);
              return { success: false, error: smsError.message };
            }),
            // Send SMS to ambassador
            sendAmbassadorNewOrderSMS(order.id, dbClient).catch(smsError => {
              console.error(`📱 Ambassador SMS failed for order ${order.id} (non-fatal):`, smsError);
              return { success: false, error: smsError.message };
            }),
            // Send emails
            sendOrderConfirmationEmails(order.id, dbClient).catch(emailError => {
              console.error(`📧 Email sending failed for order ${order.id} (non-fatal):`, emailError);
              return { success: false, error: emailError.message };
            })
          ]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SMS/Email sending timeout')), 5000)
          )
        ]);
        console.log(`📱📧 SMS and email sending completed for order ${order.id}`);
      } catch (error) {
        // Log but don't fail - SMS/emails are non-critical
        // If timeout occurs, they may still send but we don't wait
        console.error(`📱📧 SMS/Email sending timed out or failed for order ${order.id} (non-fatal):`, error.message || error);
      }
    } else {
      console.log(`📱📧 Skipping SMS/email - paymentMethod: ${paymentMethod}, ambassadorId: ${ambassadorId}`);
    }
    
    // STEP 9: Return created order with order_passes
    const { data: createdOrder, error: fetchError } = await dbClient
      .from('orders')
      .select(`
        *,
        order_passes (*)
      `)
      .eq('id', order.id)
      .single();

    if (fetchError) {
      console.warn('Failed to fetch created order with relations:', fetchError);
      await logOrderCreateSuccess(dbClient, req, order.id, { payment_method: paymentMethod, total_quantity: totalQuantity });
      return res.status(201).json({
        success: true,
        order: order
      });
    }

    await logOrderCreateSuccess(dbClient, req, createdOrder.id, {
      payment_method: paymentMethod,
      total_quantity: totalQuantity,
      ambassador_id: ambassadorId || null,
      event_id: eventId || null
    });
    res.status(201).json({
      success: true,
      order: createdOrder
    });

  } catch (error) {
    console.error('❌ Error in /api/orders/create:', error);
    try {
      const dbClient = process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      await logOrderCreateFailure(dbClient, req, 500, { error: error.message });
    } catch (logErr) {
      console.error('Failed to log order_create_failed:', logErr);
    }
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

// Order confirmation email HTML: api/lib/order-confirmation-email-html.cjs

// ============================================
// SMS Helper Functions
// ============================================

/**
 * Format phone number for WinSMS API (+216XXXXXXXX)
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove country code if present (216 or +216)
  if (cleaned.startsWith('216')) {
    cleaned = cleaned.substring(3);
  }
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Validate: must be 8 digits starting with 2, 5, 9, or 4
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
    // Return with +216 prefix for WinSMS API
    return '+216' + cleaned;
  }
  
  return null;
}

/**
 * Send SMS via WinSMS API
 */
async function sendSms(phoneNumbers, message, senderId = 'Andiamo') {
  const WINSMS_API_KEY = process.env.WINSMS_API_KEY;
  const WINSMS_API_HOST = 'www.winsmspro.com';
  const WINSMS_API_PATH = '/sms/sms/api';

  if (!WINSMS_API_KEY) {
    throw new Error('SMS service not configured: WINSMS_API_KEY is required');
  }

  if (!phoneNumbers || (Array.isArray(phoneNumbers) && phoneNumbers.length === 0)) {
    throw new Error('Phone numbers are required');
  }

  if (!message || !message.trim()) {
    throw new Error('Message is required');
  }

  // Format phone numbers
  const phoneArray = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
  const formattedNumbers = phoneArray
    .map(phone => formatPhoneNumber(phone))
    .filter(phone => phone !== null);

  if (formattedNumbers.length === 0) {
    throw new Error('No valid phone numbers provided');
  }

  // Join multiple numbers with comma (as per WinSMS documentation)
  const toParam = formattedNumbers.join(',');

  // Build URL with query parameters (GET method as per WinSMS documentation)
  const queryParams = querystring.stringify({
    action: 'send-sms',
    api_key: WINSMS_API_KEY,
    to: toParam,
    sms: message.trim(),
    from: senderId,
    response: 'json' // Required by WinSMS API to get JSON response
  });

  const url = `https://${WINSMS_API_HOST}${WINSMS_API_PATH}?${queryParams}`;
  
  console.log('📱 Sending SMS:', {
    from: senderId,
    messageLength: message.trim().length,
    recipientCount: formattedNumbers.length
  });

  // Make HTTPS GET request (as per WinSMS documentation)
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: parsed,
            raw: data
          });
        } catch (e) {
          console.error('❌ WinSMS API response parse error:', e.message);
          console.error('❌ Raw response:', data);
          resolve({
            status: res.statusCode,
            data: data,
            raw: data,
            parseError: e.message
          });
        }
      });
    }).on('error', (e) => {
      console.error('❌ WinSMS API request error:', e.message);
      reject(new Error(`SMS API request failed: ${e.message}`));
    });
  });
}

/**
 * Format passes text for SMS: "VIP x2, Standard x1"
 */
function formatPassesText(passes) {
  if (!passes || passes.length === 0) {
    throw new Error('Passes array is required and cannot be empty');
  }
  
  return passes
    .map(p => {
      const passType = p.pass_type || p.passName || 'Standard';
      const quantity = p.quantity || 1;
      return `${passType} x${quantity}`;
    })
    .join(', ');
}

/**
 * Format order number for SMS display
 */
function formatOrderNumber(order) {
  // Use only order_number from database (numeric values like 518954, 907756, etc.)
  if (order.order_number != null) {
    return order.order_number.toString();
  }
  // Return empty string if order_number doesn't exist
  return '';
}

/**
 * Build client order confirmation SMS message
 */
function buildClientOrderConfirmationSMS(data) {
  const { order, passes, ambassador } = data;
  
  // Validate required fields
  if (!order) throw new Error('Order is required for client order confirmation SMS');
  if (!passes || passes.length === 0) throw new Error('Passes are required for client order confirmation SMS');
  if (!ambassador) throw new Error('Ambassador is required for client order confirmation SMS');
  if (!ambassador.full_name) throw new Error('Ambassador full_name is required');
  if (!ambassador.phone) throw new Error('Ambassador phone is required');
  if (order.total_price === undefined || order.total_price === null) throw new Error('Order total_price is required');
  
  const orderNumber = formatOrderNumber(order);
  const passesText = formatPassesText(passes);
  const totalPrice = parseFloat(order.total_price).toFixed(0);
  const ambassadorName = ambassador.full_name;
  const ambassadorPhone = ambassador.phone;
  
  // Template EXACT - DO NOT MODIFY
  return `Commande #${orderNumber} confirmée
Pass: ${passesText} | Total: ${totalPrice} DT
Ambassadeur: ${ambassadorName} – ${ambassadorPhone}
We Create Memories`;
}

/**
 * Build ambassador new order SMS message
 */
function buildAmbassadorNewOrderSMS(data) {
  const { order, passes } = data;
  
  // Validate required fields
  if (!order) throw new Error('Order is required for ambassador new order SMS');
  if (!passes || passes.length === 0) throw new Error('Passes are required for ambassador new order SMS');
  if (!order.user_name) throw new Error('Order user_name is required');
  if (!order.user_phone) throw new Error('Order user_phone is required');
  if (order.total_price === undefined || order.total_price === null) throw new Error('Order total_price is required');
  
  const orderNumber = formatOrderNumber(order);
  const clientName = order.user_name;
  const clientPhone = order.user_phone;
  const passesText = formatPassesText(passes);
  const totalPrice = parseFloat(order.total_price).toFixed(0);
  
  // Template EXACT - DO NOT MODIFY
  return `Nouvelle commande #${orderNumber}
Client: ${clientName} – ${clientPhone} Pass: ${passesText}
Total: ${totalPrice} DT`;
}

/**
 * Send order confirmation SMS to client
 */
async function sendClientOrderConfirmationSMS(orderId, dbClient) {
  if (!dbClient) {
    console.warn('📱 Cannot send SMS - Supabase client not provided');
    return { success: false, skipped: true, reason: 'no_db_client' };
  }

  if (!process.env.WINSMS_API_KEY) {
    console.warn('📱 SMS service not configured - WINSMS_API_KEY missing');
    return { success: false, skipped: true, reason: 'not_configured' };
  }

  try {
    // Fetch order with relations
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select(`
        *,
        order_passes (*),
        ambassadors (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Failed to fetch order for SMS:', orderError);
      return { success: false, error: 'Order not found' };
    }

    if (!order.ambassador_id || !order.ambassadors) {
      console.warn('📱 Skipping SMS - order does not have an ambassador assigned');
      return { success: false, skipped: true, reason: 'no_ambassador' };
    }

    if (!order.user_phone) {
      console.warn('📱 Skipping SMS - no user phone number');
      return { success: false, skipped: true, reason: 'no_phone' };
    }

    // Prepare passes array for SMS template
    let passes = [];
    if (order.order_passes && order.order_passes.length > 0) {
      passes = order.order_passes.map(p => ({
        pass_type: p.pass_type,
        quantity: p.quantity || 1
      }));
    } else {
      if (order.notes) {
        try {
          const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
          if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
            passes = notesData.all_passes.map(p => ({
              pass_type: p.passName || p.pass_type || 'Standard',
              quantity: p.quantity || 1
            }));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (passes.length === 0) {
        passes = [{
          pass_type: order.pass_type || 'Standard',
          quantity: order.quantity || 1
        }];
      }
    }

    // Build SMS message
    let message;
    try {
      message = buildClientOrderConfirmationSMS({
        order,
        passes,
        ambassador: order.ambassadors
      });
      
      console.log('📱 SMS Type: Client Order Confirmation');
      console.log('📱 Order ID:', order.id);
      console.log('📱 Recipient:', order.user_phone ? `${order.user_phone.substring(0, 3)}***` : 'NOT SET');
    } catch (smsError) {
      console.error('❌ Error building SMS message:', smsError);
      return { success: false, error: `Failed to build SMS message: ${smsError.message}` };
    }

    // Format and send SMS
    const formattedNumber = formatPhoneNumber(order.user_phone);
    if (!formattedNumber) {
      console.error('❌ Invalid phone number format:', order.user_phone);
      return { success: false, error: `Invalid phone number format: ${order.user_phone}` };
    }

    const responseData = await sendSms(formattedNumber, message);
    const isSuccess = responseData.status === 200 &&
                      responseData.data &&
                      (responseData.data.code === 'ok' ||
                       responseData.data.code === '200' ||
                       (responseData.data.message && responseData.data.message.toLowerCase().includes('successfully')));

    // Log to sms_logs
    try {
      await dbClient.from('sms_logs').insert({
        phone_number: order.user_phone,
        message: message.trim(),
        status: isSuccess ? 'sent' : 'failed',
        api_response: JSON.stringify(responseData.data || responseData.raw),
        sent_at: isSuccess ? new Date().toISOString() : null,
        error_message: isSuccess ? null : (responseData.data?.message || 'SMS sending failed')
      });
    } catch (logErr) {
      console.warn('⚠️ Failed to log SMS send result:', logErr);
    }

    if (!isSuccess) {
      console.error('❌ SMS sending failed:', responseData.data?.message || 'Unknown error');
      return { success: false, error: responseData.data?.message || 'Failed to send SMS' };
    }

    console.log('✅ Client order confirmation SMS sent successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending client order confirmation SMS:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Send new order SMS to ambassador
 */
async function sendAmbassadorNewOrderSMS(orderId, dbClient) {
  if (!dbClient) {
    console.warn('📱 Cannot send SMS - Supabase client not provided');
    return { success: false, skipped: true, reason: 'no_db_client' };
  }

  if (!process.env.WINSMS_API_KEY) {
    console.warn('📱 SMS service not configured - WINSMS_API_KEY missing');
    return { success: false, skipped: true, reason: 'not_configured' };
  }

  try {
    // Fetch order with relations
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select(`
        *,
        order_passes (*),
        ambassadors (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Failed to fetch order for SMS:', orderError);
      return { success: false, error: 'Order not found' };
    }

    if (!order.ambassador_id || !order.ambassadors) {
      console.warn('📱 Skipping SMS - order does not have an ambassador assigned');
      return { success: false, skipped: true, reason: 'no_ambassador' };
    }

    if (!order.ambassadors.phone) {
      console.warn('📱 Skipping SMS - no ambassador phone number');
      return { success: false, skipped: true, reason: 'no_ambassador_phone' };
    }

    // Prepare passes array for SMS template
    let passes = [];
    if (order.order_passes && order.order_passes.length > 0) {
      passes = order.order_passes.map(p => ({
        pass_type: p.pass_type,
        quantity: p.quantity || 1
      }));
    } else {
      if (order.notes) {
        try {
          const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
          if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
            passes = notesData.all_passes.map(p => ({
              pass_type: p.passName || p.pass_type || 'Standard',
              quantity: p.quantity || 1
            }));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (passes.length === 0) {
        passes = [{
          pass_type: order.pass_type || 'Standard',
          quantity: order.quantity || 1
        }];
      }
    }

    // Build SMS message
    let message;
    try {
      message = buildAmbassadorNewOrderSMS({
        order,
        passes
      });
      
      console.log('📱 SMS Type: Ambassador New Order');
      console.log('📱 Order ID:', order.id);
      console.log('📱 Recipient:', order.ambassadors?.phone ? `${order.ambassadors.phone.substring(0, 3)}***` : 'NOT SET');
    } catch (smsError) {
      console.error('❌ Error building SMS message:', smsError);
      return { success: false, error: `Failed to build SMS message: ${smsError.message}` };
    }

    // Format and send SMS
    const formattedNumber = formatPhoneNumber(order.ambassadors.phone);
    if (!formattedNumber) {
      console.error('❌ Invalid ambassador phone number format:', order.ambassadors.phone);
      return { success: false, error: `Invalid ambassador phone number: ${order.ambassadors.phone}` };
    }

    const responseData = await sendSms(formattedNumber, message);
    const isSuccess = responseData.status === 200 &&
                      responseData.data &&
                      (responseData.data.code === 'ok' ||
                       responseData.data.code === '200' ||
                       (responseData.data.message && responseData.data.message.toLowerCase().includes('successfully')));

    // Log to sms_logs
    try {
      await dbClient.from('sms_logs').insert({
        phone_number: order.ambassadors.phone,
        message: message.trim(),
        status: isSuccess ? 'sent' : 'failed',
        api_response: JSON.stringify(responseData.data || responseData.raw),
        sent_at: isSuccess ? new Date().toISOString() : null,
        error_message: isSuccess ? null : (responseData.data?.message || 'SMS sending failed')
      });
    } catch (logErr) {
      console.warn('⚠️ Failed to log SMS send result:', logErr);
    }

    if (!isSuccess) {
      console.error('❌ SMS sending failed:', responseData.data?.message || 'Unknown error');
      return { success: false, error: responseData.data?.message || 'Failed to send SMS' };
    }

    console.log('✅ Ambassador new order SMS sent successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending ambassador new order SMS:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

// ============================================
// Email Helper Functions
// ============================================

/**
 * Get email transporter (creates new instance each time)
 */
function getEmailTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  
  if (!host || !user || !pass) {
    throw new Error('Email configuration incomplete. Check EMAIL_HOST, EMAIL_USER, and EMAIL_PASS environment variables.');
  }
  
  const authConfig = {
    user: user.trim(),
    pass: pass
  };
  
  const transporterConfig = {
    host: host,
    port: port,
    secure: false,
    requireTLS: true,
    tls: {
      rejectUnauthorized: false,
    },
    auth: {
      user: authConfig.user,
      pass: authConfig.pass
    }
  };
  
  return nodemailer.createTransport(transporterConfig);
}

/**
 * Send order confirmation email to a single recipient
 * Non-blocking, logs errors but doesn't throw
 */
async function sendOrderConfirmationEmailToRecipient(order, orderPasses, recipientEmail, recipientName, recipientType, dbClient) {
  if (!recipientEmail) {
    console.log(`📧 Skipping ${recipientType} email - no email address`);
    return { success: false, skipped: true, reason: 'no_email' };
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST) {
    console.error(`📧 Email service not configured - Missing:`, {
      EMAIL_USER: !process.env.EMAIL_USER,
      EMAIL_PASS: !process.env.EMAIL_PASS,
      EMAIL_HOST: !process.env.EMAIL_HOST
    });
    return { success: false, skipped: true, reason: 'not_configured' };
  }
  
  console.log(`📧 Attempting to send ${recipientType} email to: ${recipientEmail.substring(0, 3)}***`);

  // Create email log entry (before try block so it's accessible in catch)
  let emailLog = null;
  if (dbClient) {
    try {
      const { data: logData } = await dbClient
        .from('email_delivery_logs')
        .insert({
          order_id: order.id,
          email_type: 'order_confirmation',
          recipient_email: recipientEmail,
          recipient_name: recipientName || 'Recipient',
          subject: recipientType === 'client' ? 'Payment Processing – Andiamo Events' : 'New Order - Andiamo Events',
          status: 'pending'
        })
        .select()
        .single();
      emailLog = logData;
    } catch (logError) {
      console.warn(`⚠️ Failed to create email log for ${recipientType}:`, logError);
    }
  }

  try {
    const emailHtml = buildOrderConfirmationEmailHtml(order, orderPasses, recipientType);
    const subject = recipientType === 'client' ? 'Payment Processing – Andiamo Events' : 'New Order - Andiamo Events';

    // Send email
    // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
    // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
    console.log(`📧 Creating email transporter for ${recipientType}...`);
    const emailTransporter = getEmailTransporter();
    console.log(`📧 Sending email to ${recipientType}...`);
    const emailResult = await emailTransporter.sendMail({
      from: '"Andiamo Events" <contact@andiamoevents.com>',
      replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
      to: recipientEmail,
      subject: subject,
      html: emailHtml
    });
    console.log(`📧 Email sent successfully to ${recipientType}, messageId: ${emailResult.messageId}`);

    // Update email log
    if (emailLog && dbClient) {
      try {
        await dbClient
          .from('email_delivery_logs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', emailLog.id);
      } catch (logError) {
        console.warn(`⚠️ Failed to update email log for ${recipientType}:`, logError);
      }
    }

    console.log(`✅ Order confirmation email sent to ${recipientType}: ${recipientEmail.substring(0, 3)}***`);
    return { success: true, recipientType, email: recipientEmail };
  } catch (emailError) {
    console.error(`❌ Failed to send order confirmation email to ${recipientType}:`, {
      email: recipientEmail.substring(0, 3) + '***',
      error: emailError.message
    });

    // Update email log with failure
    if (emailLog && dbClient) {
      try {
        await dbClient
          .from('email_delivery_logs')
          .update({
            status: 'failed',
            error_message: emailError.message
          })
          .eq('id', emailLog.id);
      } catch (logError) {
        // Ignore log update errors
      }
    }

    return { success: false, recipientType, email: recipientEmail, error: emailError.message };
  }
}

/**
 * Send order confirmation emails to both client and ambassador
 * Called during order creation, right after SMS
 */
async function sendOrderConfirmationEmails(orderId, dbClient) {
  if (!dbClient) {
    console.warn('📧 Cannot send order confirmation emails - Supabase client not provided');
    return;
  }

  console.log(`📧 Starting email sending for order: ${orderId}`);

  try {
    // Fetch order with all needed relations
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select(`
        *,
        order_passes (*),
        events (
          id,
          name,
          date,
          venue
        ),
        ambassadors (
          id,
          full_name,
          phone,
          email
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Failed to fetch order for email:', orderError);
      return;
    }

    // Fetch order passes if not included
    let orderPasses = order.order_passes || [];
    if (orderPasses.length === 0) {
      const { data: passes } = await dbClient
        .from('order_passes')
        .select('*')
        .eq('order_id', orderId);
      orderPasses = passes || [];
    }

    // Fetch ambassador social_link from ambassador_applications
    if (order.ambassadors) {
      try {
        // Always fetch social_link from ambassador_applications to ensure we have the latest
        const { data: application } = await dbClient
          .from('ambassador_applications')
          .select('social_link')
          .eq('phone_number', order.ambassadors.phone)
          .maybeSingle();
        
        if (application?.social_link) {
          order.ambassadors.social_link = application.social_link;
          console.log(`📧 Fetched ambassador Instagram: ${application.social_link}`);
        } else {
          console.log(`⚠️ No Instagram link found for ambassador ${order.ambassadors.phone}`);
        }
      } catch (err) {
        console.warn('⚠️ Failed to fetch ambassador social_link from applications:', err);
      }
    }

    // Send email to client
    if (order.user_email) {
      await sendOrderConfirmationEmailToRecipient(
        order,
        orderPasses,
        order.user_email,
        order.user_name,
        'client',
        dbClient
      );
    } else {
      console.log('📧 Skipping client email - no user_email');
    }

    // Send email to ambassador
    if (order.ambassadors?.email) {
      await sendOrderConfirmationEmailToRecipient(
        order,
        orderPasses,
        order.ambassadors.email,
        order.ambassadors.full_name,
        'ambassador',
        dbClient
      );
    } else {
      console.log('📧 Skipping ambassador email - no ambassador email address');
    }
  } catch (error) {
    console.error('❌ Error in sendOrderConfirmationEmails:', error);
    // Don't throw - this is non-blocking
  }
}

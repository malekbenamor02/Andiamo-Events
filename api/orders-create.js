// POST /api/orders/create
// Server-side order creation with atomic stock reservation
// Vercel serverless function

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('❌ Missing Supabase environment variables:', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
      });
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Warn if service role key is missing (order creation may fail due to RLS)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
      eventId
    } = bodyData;

    // Validate required fields
    if (!customerInfo || !passes || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'customerInfo, passes, and paymentMethod are required'
      });
    }

    if (!Array.isArray(passes) || passes.length === 0) {
      return res.status(400).json({
        error: 'Invalid passes',
        details: 'passes must be a non-empty array'
      });
    }

    // Validate customer info
    if (!customerInfo.full_name || !customerInfo.phone || !customerInfo.email || !customerInfo.city) {
      return res.status(400).json({
        error: 'Missing customer information',
        details: 'full_name, phone, email, and city are required'
      });
    }

    // Validate payment method
    const validPaymentMethods = ['online', 'external_app', 'ambassador_cash'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Invalid payment method',
        details: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
      });
    }

    // Validate ambassador for ambassador_cash
    if (paymentMethod === 'ambassador_cash' && !ambassadorId) {
      return res.status(400).json({
        error: 'Ambassador ID required',
        details: 'ambassadorId is required for ambassador_cash payment method'
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Use service role key if available for better access (matches localhost behavior)
    // CRITICAL: Service role key is required for stock reservation and order creation
    let dbClient = supabase;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      dbClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      console.log('✅ Using service role key for order creation (bypasses RLS)');
    } else {
      console.warn('⚠️ WARNING: Using anon key for order creation. Stock reservation may fail due to RLS policies.');
    }

    // STEP 1: Validate all passes exist and are active
    const passIds = passes.map(p => p.passId);
    const { data: eventPasses, error: passesError } = await dbClient
      .from('event_passes')
      .select('id, name, price, is_active, max_quantity, sold_quantity')
      .in('id', passIds);

    if (passesError) {
      console.error('Error fetching passes:', passesError);
      return res.status(500).json({
        error: 'Failed to validate passes',
        details: passesError.message
      });
    }

    if (!eventPasses || eventPasses.length !== passIds.length) {
      return res.status(400).json({
        error: 'Invalid passes',
        details: 'One or more passes not found'
      });
    }

    // Create pass lookup map
    const passMap = new Map();
    eventPasses.forEach(p => passMap.set(p.id, p));

    // STEP 2: Validate each pass and check stock availability
    const validatedPasses = [];
    for (const pass of passes) {
      const eventPass = passMap.get(pass.passId);
      
      if (!eventPass) {
        return res.status(400).json({
          error: 'Invalid pass',
          details: `Pass ${pass.passId} not found`
        });
      }

      // Check if pass is active
      if (!eventPass.is_active) {
        return res.status(400).json({
          error: 'Pass not available',
          details: `Pass "${eventPass.name}" is no longer available for purchase`
        });
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

        return res.status(400).json({
          error: 'Stock reservation failed',
          details: `Insufficient stock for "${validatedPass.eventPass.name}" or pass is no longer active`
        });
      }

      stockReservations.push({ passId: id, reserved: true, unlimited: false });
    }

    // STEP 4: Calculate totals (server-side authority)
    const totalQuantity = validatedPasses.reduce((sum, p) => sum + p.quantity, 0);
    const totalPrice = validatedPasses.reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0);

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
        return res.status(400).json({
          error: 'Invalid payment method',
          details: `Unknown payment method: ${paymentMethod}`
        });
    }

    // STEP 6: Create order
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
      total_price: totalPrice,
      payment_method: paymentMethod,
      status: initialStatus,
      stock_released: false,  // Stock is reserved, not released
      assigned_at: ambassadorId ? new Date().toISOString() : null,
      notes: JSON.stringify({
        all_passes: validatedPasses.map(p => ({
          passId: p.passId,
          passName: p.passName,
          quantity: p.quantity,
          price: p.price
        })),
        total_order_price: totalPrice,
        pass_count: validatedPasses.length
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
      return res.status(500).json({
        error: 'Failed to create order passes',
        details: passesInsertError.message
      });
    }

    // STEP 8: Send SMS notifications and emails for COD orders
    // Note: In Vercel serverless, SMS can be sent via separate endpoint calls
    // Emails are sent here directly - with timeout to prevent blocking
    if (paymentMethod === 'ambassador_cash' && ambassadorId) {
      console.log(`📧 Order ${order.id} is ambassador_cash - attempting to send confirmation emails...`);
      // In Vercel serverless, we need to await before response is sent
      // But use timeout to prevent blocking too long
      try {
        await Promise.race([
          sendOrderConfirmationEmails(order.id, dbClient),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email sending timeout')), 3000)
          )
        ]);
        console.log(`📧 Email sending completed for order ${order.id}`);
      } catch (emailError) {
        // Log but don't fail - emails are non-critical
        // If timeout occurs, emails may still send but we don't wait
        console.error(`📧 Email sending timed out or failed for order ${order.id} (non-fatal):`, emailError.message || emailError);
      }
    } else {
      console.log(`📧 Skipping email - paymentMethod: ${paymentMethod}, ambassadorId: ${ambassadorId}`);
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
      // Return order without relations
      return res.status(201).json({
        success: true,
        order: order
      });
    }

    res.status(201).json({
      success: true,
      order: createdOrder
    });

  } catch (error) {
    console.error('❌ Error in /api/orders/create:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

// ============================================
// EMAIL HELPER FUNCTIONS
// ============================================

/**
 * Helper function to format event time
 */
function formatEventTime(eventDate) {
  if (!eventDate) return null;
  try {
    const date = new Date(eventDate);
    if (isNaN(date.getTime())) return null;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${dayName} · ${day} ${monthName} ${year} · ${hours}:${minutes}`;
  } catch (e) {
    return null;
  }
}

/**
 * Build order confirmation email HTML (simple version without tickets)
 * Reusable for both client and ambassador
 */
function buildOrderConfirmationEmailHtml(order, orderPasses) {
  const orderNumber = order.order_number !== null && order.order_number !== undefined 
    ? `#${order.order_number}` 
    : order.id.substring(0, 8).toUpperCase();
  
  const eventTime = formatEventTime(order.events?.date) || 'TBA';
  const venue = order.events?.venue || 'Venue to be announced';
  
  // Build passes summary
  const passesSummaryHtml = orderPasses.map(p => `
    <tr>
      <td>${p.pass_type}</td>
      <td style="text-align: center;">${p.quantity}</td>
      <td style="text-align: right;">${parseFloat(p.price).toFixed(2)} TND</td>
    </tr>
  `).join('');
  
  const supportUrl = `${process.env.VITE_API_URL || process.env.API_URL || 'https://andiamoevents.com'}/contact`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Order Confirmation - Andiamo Events</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #1A1A1A; 
          background: #FFFFFF;
          padding: 0;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        @media (prefers-color-scheme: dark) {
          body {
            color: #FFFFFF;
            background: #1A1A1A;
          }
        }
        a {
          color: #E21836 !important;
          text-decoration: none;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #FFFFFF;
        }
        @media (prefers-color-scheme: dark) {
          .email-wrapper {
            background: #1A1A1A;
          }
        }
        .content-card {
          background: #F5F5F5;
          margin: 0 20px 30px;
          border-radius: 12px;
          padding: 50px 40px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .content-card {
            background: #1F1F1F;
            border: 1px solid rgba(42, 42, 42, 0.5);
          }
        }
        .title-section {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .title-section {
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .title {
          font-size: 32px;
          font-weight: 700;
          color: #1A1A1A;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .title {
            color: #FFFFFF;
          }
        }
        .subtitle {
          font-size: 16px;
          color: #666666;
          font-weight: 400;
        }
        @media (prefers-color-scheme: dark) {
          .subtitle {
            color: #B0B0B0;
          }
        }
        .greeting {
          font-size: 18px;
          color: #1A1A1A;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .greeting {
            color: #FFFFFF;
          }
        }
        .greeting strong {
          color: #E21836;
          font-weight: 600;
        }
        .message {
          font-size: 16px;
          color: #666666;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .message {
            color: #B0B0B0;
          }
        }
        .order-info-block {
          background: #E8E8E8;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        @media (prefers-color-scheme: dark) {
          .order-info-block {
            background: #252525;
            border: 1px solid rgba(42, 42, 42, 0.8);
          }
        }
        .info-row {
          margin-bottom: 20px;
        }
        .info-row:last-child {
          margin-bottom: 0;
        }
        .info-label {
          font-size: 11px;
          color: #999999;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        @media (prefers-color-scheme: dark) {
          .info-label {
            color: #6B6B6B;
          }
        }
        .info-value {
          font-family: 'Courier New', 'Monaco', monospace;
          font-size: 18px;
          color: #1A1A1A;
          font-weight: 500;
          word-break: break-all;
          letter-spacing: 0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .info-value {
            color: #FFFFFF;
          }
        }
        .passes-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .passes-table th {
          text-align: left;
          padding: 12px 0;
          color: #E21836;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid rgba(226, 24, 54, 0.3);
        }
        .passes-table td {
          padding: 12px 0;
          color: #1A1A1A;
          font-size: 15px;
        }
        @media (prefers-color-scheme: dark) {
          .passes-table td {
            color: #FFFFFF;
          }
        }
        .total-row {
          border-top: 2px solid rgba(226, 24, 54, 0.3);
          margin-top: 10px;
          padding-top: 15px;
        }
        .total-row td {
          font-weight: 700;
          font-size: 18px;
          color: #E21836;
          padding-top: 15px;
        }
        .support-section {
          background: #E8E8E8;
          border-left: 3px solid rgba(226, 24, 54, 0.3);
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .support-section {
            background: #252525;
          }
        }
        .support-text {
          font-size: 14px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .support-text {
            color: #B0B0B0;
          }
        }
        .support-email {
          color: #E21836 !important;
          text-decoration: none;
          font-weight: 500;
        }
        .closing-section {
          text-align: center;
          margin: 50px 0 40px;
          padding-top: 40px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .closing-section {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .slogan {
          font-size: 24px;
          font-style: italic;
          color: #E21836;
          font-weight: 300;
          margin-bottom: 30px;
        }
        .signature {
          font-size: 16px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .signature {
            color: #B0B0B0;
          }
        }
        .footer {
          margin-top: 50px;
          padding: 40px 20px 30px;
          text-align: center;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .footer {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        }
        .footer-text {
          font-size: 12px;
          color: #999999;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        @media (prefers-color-scheme: dark) {
          .footer-text {
            color: #6B6B6B;
          }
        }
        .footer-links {
          margin: 15px auto 0;
          text-align: center;
        }
        .footer-link {
          color: #999999;
          text-decoration: none;
          font-size: 13px;
          margin: 0 8px;
        }
        @media (prefers-color-scheme: dark) {
          .footer-link {
            color: #6B6B6B;
          }
        }
        .footer-link:hover {
          color: #E21836 !important;
        }
        @media only screen and (max-width: 600px) {
          .content-card {
            margin: 0 15px 20px;
            padding: 35px 25px;
          }
          .title {
            font-size: 26px;
          }
          .order-info-block {
            padding: 25px 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="content-card">
          <div class="title-section">
            <h1 class="title">Order Confirmed</h1>
            <p class="subtitle">Order Confirmation - Andiamo Events</p>
          </div>
          
          <p class="greeting">Dear <strong>${order.user_name || 'Valued Customer'}</strong>,</p>
          
          <p class="message">
            We're excited to confirm that your order has been successfully processed!
          </p>
          
          <div class="order-info-block">
            <div class="info-row">
              <div class="info-label">Order Number</div>
              <div class="info-value">${orderNumber}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Event</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.events?.name || 'Event'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Event Time</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${eventTime}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Venue</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${venue}</div>
            </div>
            ${order.ambassadors ? `
            <div class="info-row">
              <div class="info-label">Delivered by</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.ambassadors.full_name}</div>
            </div>
            ` : ''}
          </div>

          <div class="order-info-block">
            <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Passes Purchased</h3>
            <table class="passes-table">
              <thead>
                <tr>
                  <th>Pass Type</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${passesSummaryHtml}
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; padding-right: 20px;"><strong>Total Amount Paid:</strong></td>
                  <td style="text-align: right;"><strong>${parseFloat(order.total_price).toFixed(2)} TND</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="support-section">
            <p class="support-text">Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>.</p>
          </div>
          <div class="closing-section">
            <p class="slogan">We Create Memories</p>
            <p class="signature">Best regards,<br>The Andiamo Events Team</p>
          </div>
        </div>
        
        <div class="footer">
          <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
          <div class="footer-links">
            <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a>
            <span style="color: #999999;">•</span>
            <a href="https://malekbenamor.dev/" target="_blank" class="footer-link">Website</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

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
          subject: 'Order Confirmation - Andiamo Events',
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
    const emailHtml = buildOrderConfirmationEmailHtml(order, orderPasses);
    const subject = 'Order Confirmation - Andiamo Events';

    // Send email
    console.log(`📧 Creating email transporter for ${recipientType}...`);
    const emailTransporter = getEmailTransporter();
    console.log(`📧 Sending email to ${recipientType}...`);
    const emailResult = await emailTransporter.sendMail({
      from: `Andiamo Events <${process.env.EMAIL_USER}>`,
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

// POST /api/orders/create
// Server-side order creation with atomic stock reservation
// Vercel serverless function

import { createClient } from '@supabase/supabase-js';

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

    // STEP 8: Send SMS notifications for COD orders (non-blocking)
    // Note: In Vercel serverless, we'll skip async SMS for now
    // SMS can be sent via separate endpoint calls if needed
    
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

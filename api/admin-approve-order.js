// Admin Approve Order endpoint for Vercel
// This endpoint approves orders in PENDING_ADMIN_APPROVAL status

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
    // Verify admin authentication
    const { verifyAdminAuth } = await import('./authAdminMiddleware.js');
    const authResult = await verifyAdminAuth(req);
    
    if (!authResult.valid) {
      return res.status(authResult.statusCode || 401).json({
        error: authResult.error,
        reason: authResult.reason || 'Authentication failed',
        valid: false
      });
    }
    
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Supabase not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      });
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
    
    const { orderId } = bodyData;
    const adminId = authResult.admin?.id;
    const adminEmail = authResult.admin?.email;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }
    
    console.log('✅ ADMIN: Approve Order Request:', {
      orderId,
      adminId,
      adminEmail: adminEmail ? `${adminEmail.substring(0, 3)}***` : 'NOT SET'
    });
    
    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // Use service role if available (for RLS bypass)
    let supabaseService = null;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabaseService = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
    
    const dbClient = supabaseService || supabase;
    
    // Step 1: Verify order exists and is in valid status
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status, source, payment_method, user_email, user_phone, total_price')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      console.error('❌ Order not found:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    console.log('✅ Order status check:', {
      orderId: order.id,
      currentStatus: order.status,
      source: order.source,
      paymentMethod: order.payment_method
    });
    
    // Step 2: Validate order status (must be PENDING_ADMIN_APPROVAL)
    if (order.status !== 'PENDING_ADMIN_APPROVAL') {
      console.error('❌ Invalid order status for approval:', order.status);
      
      // Log security event
      try {
        await dbClient.from('security_audit_logs').insert({
          event_type: 'invalid_status_transition',
          endpoint: '/api/admin-approve-order',
          user_id: adminId,
          ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.url,
          details: {
            reason: 'Order status is not PENDING_ADMIN_APPROVAL',
            order_id: orderId,
            current_status: order.status,
            attempted_action: 'approve_order'
          },
          severity: 'medium'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      
      return res.status(400).json({
        error: 'Invalid order status',
        details: `Order must be in PENDING_ADMIN_APPROVAL status. Current status: ${order.status}`
      });
    }
    
    // Step 3: Update order status to PAID (conditional update for idempotency)
    const oldStatus = order.status;
    const { data: updatedOrder, error: updateError } = await dbClient
      .from('orders')
      .update({
        status: 'PAID',
        payment_status: 'PAID',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('status', 'PENDING_ADMIN_APPROVAL') // Only update if still in PENDING_ADMIN_APPROVAL (idempotency)
      .select('id, status')
      .single();
    
    if (updateError || !updatedOrder) {
      // Check if order was already updated (idempotency check)
      const { data: checkOrder } = await dbClient
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single();
      
      if (checkOrder && checkOrder.status === 'PAID') {
        console.log('⚠️ Order already PAID (idempotent call)');
        
        // Check if tickets already exist
        const { data: existingTickets } = await dbClient
          .from('tickets')
          .select('id')
          .eq('order_id', orderId)
          .limit(1);
        
        // Log the duplicate attempt
        await dbClient.from('order_logs').insert({
          order_id: orderId,
          action: 'admin_approve_duplicate',
          performed_by: adminId,
          performed_by_type: 'admin',
          details: {
            old_status: oldStatus,
            new_status: 'PAID',
            tickets_already_exist: existingTickets && existingTickets.length > 0,
            admin_email: adminEmail
          }
        });
        
        return res.status(200).json({
          success: true,
          message: 'Order already approved (idempotent call)',
          orderId: orderId,
          status: 'PAID',
          ticketsExist: existingTickets && existingTickets.length > 0
        });
      }
      
      console.error('❌ Error updating order status:', updateError);
      return res.status(500).json({
        error: 'Failed to update order status',
        details: updateError?.message || 'Unknown error'
      });
    }
    
    console.log('✅ Order status updated:', {
      orderId: updatedOrder.id,
      oldStatus,
      newStatus: updatedOrder.status
    });
    
    // Step 4: Ticket generation will be handled separately
    // The frontend can call /api/generate-tickets-for-order after approval
    // or it can be triggered by database triggers/events
    // We don't block the approval on ticket generation
    const ticketResult = {
      success: false,
      message: 'Tickets will be generated separately'
    };
    
    // Step 5: Log to order_logs (audit trail)
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'admin_approve',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          old_status: oldStatus,
          new_status: 'PAID',
          tickets_generated: ticketResult?.success || false,
          tickets_count: ticketResult?.ticketsCount || 0,
          email_sent: ticketResult?.emailSent || false,
          sms_sent: ticketResult?.smsSent || false,
          admin_email: adminEmail,
          admin_action: true
        }
      });
      console.log('✅ Audit log created');
    } catch (logError) {
      console.error('❌ Error creating audit log:', logError);
      // Don't fail the request if logging fails
    }
    
    console.log('✅ ADMIN: Approve Order Completed');
    
    res.status(200).json({
      success: true,
      message: 'Order approved successfully',
      orderId: orderId,
      oldStatus,
      newStatus: 'PAID',
      ticketsGenerated: ticketResult?.success || false,
      ticketsCount: ticketResult?.ticketsCount || 0,
      emailSent: ticketResult?.emailSent || false,
      smsSent: ticketResult?.smsSent || false,
      ticketError: ticketResult?.error || null
    });
    
  } catch (error) {
    console.error('❌ ADMIN: Approve Order Error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      error: 'Failed to approve order',
      details: error.message
    });
  }
};

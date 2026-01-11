// Admin Approve Order endpoint for Vercel
// This endpoint approves orders in PENDING_ADMIN_APPROVAL status
// CRITICAL: Inlined authAdminMiddleware to avoid separate function

// Inlined verifyAdminAuth function
async function verifyAdminAuth(req) {
  try {
    // Get token from cookie
    const cookies = req.headers.cookie || '';
    const cookieMatch = cookies.match(/adminToken=([^;]+)/);
    const token = cookieMatch ? cookieMatch[1] : null;
    
    if (!token) {
      return {
        valid: false,
        error: 'No authentication token provided',
        statusCode: 401
      };
    }
    
    // Verify JWT signature and expiration
    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    
    const isProduction = process.env.NODE_ENV === 'production' || 
                         process.env.VERCEL === '1' || 
                         !!process.env.VERCEL_URL;
    
    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (isProduction) {
        return {
          valid: false,
          error: 'Server configuration error: JWT_SECRET not set',
          statusCode: 500
        };
      }
    }
    
    let decoded;
    try {
      decoded = jwt.default.verify(token, jwtSecret);
    } catch (jwtError) {
      return {
        valid: false,
        error: 'Invalid or expired token',
        reason: jwtError.name === 'TokenExpiredError' 
          ? 'Token expired - session ended' 
          : jwtError.message,
        statusCode: 401
      };
    }
    
    if (!decoded.id || !decoded.email || !decoded.role) {
      return {
        valid: false,
        error: 'Invalid token payload',
        statusCode: 401
      };
    }
    
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return {
        valid: false,
        error: 'Invalid admin role',
        statusCode: 403
      };
    }
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return {
        valid: false,
        error: 'Supabase not configured',
        statusCode: 500
      };
    }
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();
    
    if (dbError || !admin) {
      return {
        valid: false,
        error: 'Admin not found or inactive',
        statusCode: 401
      };
    }
    
    if (admin.role !== decoded.role) {
      return {
        valid: false,
        error: 'Admin role mismatch',
        statusCode: 401
      };
    }
    
    const tokenExpiration = decoded.exp ? decoded.exp * 1000 : null;
    const timeRemaining = tokenExpiration 
      ? Math.max(0, Math.floor((tokenExpiration - Date.now()) / 1000)) 
      : 0;
    
    return {
      valid: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      sessionExpiresAt: tokenExpiration,
      sessionTimeRemaining: timeRemaining
    };
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      valid: false,
      error: 'Authentication error',
      details: error.message,
      statusCode: 500
    };
  }
}

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
    
    // Step 4: Generate tickets and send email/SMS
    let ticketResult = {
      success: false,
      message: 'Ticket generation not started',
      ticketsCount: 0,
      emailSent: false,
      smsSent: false,
      error: null
    };
    
    try {
      console.log('🚀 Starting ticket generation and email/SMS sending...');
      
      // Fetch full order data with relations
      const { data: fullOrderData, error: fullOrderError } = await dbClient
        .from('orders')
        .select(`
          *,
          events (
            id,
            name,
            date,
            venue
          ),
          ambassadors (
            id,
            full_name,
            phone
          )
        `)
        .eq('id', orderId)
        .single();
      
      if (fullOrderError || !fullOrderData) {
        throw new Error(`Failed to fetch order data: ${fullOrderError?.message || 'Unknown error'}`);
      }
      
      const fullOrder = fullOrderData;
      
      // Check if tickets already exist
      const { data: existingTickets } = await dbClient
        .from('tickets')
        .select('id')
        .eq('order_id', orderId)
        .limit(1);
      
      if (existingTickets && existingTickets.length > 0) {
        console.log('⚠️ Tickets already exist, skipping generation');
        ticketResult = {
          success: true,
          message: 'Tickets already generated',
          ticketsCount: existingTickets.length,
          emailSent: true,
          smsSent: true
        };
      } else {
        // Fetch order passes
        const { data: orderPasses, error: passesError } = await dbClient
          .from('order_passes')
          .select('*')
          .eq('order_id', orderId);
        
        if (passesError) {
          throw new Error(`Failed to fetch order passes: ${passesError.message}`);
        }
        
        if (!orderPasses || orderPasses.length === 0) {
          throw new Error('No passes found for this order');
        }
        
        // Import required modules
        const { v4: uuidv4 } = await import('uuid');
        const QRCode = await import('qrcode');
        
        // Generate order access token
        const orderAccessToken = uuidv4();
        
        // Calculate expiration date
        let urlExpiresAt = null;
        if (fullOrder.events?.date) {
          const eventDate = new Date(fullOrder.events.date);
          eventDate.setDate(eventDate.getDate() + 1);
          urlExpiresAt = eventDate.toISOString();
        } else {
          const fallbackDate = new Date();
          fallbackDate.setDate(fallbackDate.getDate() + 30);
          urlExpiresAt = fallbackDate.toISOString();
        }
        
        // Update order with access token
        await dbClient
          .from('orders')
          .update({
            qr_access_token: orderAccessToken,
            qr_url_accessed: false,
            qr_url_expires_at: urlExpiresAt
          })
          .eq('id', orderId);
        
        // Generate tickets with QR codes
        const tickets = [];
        const storageClient = supabaseService || supabase;
        
        for (const pass of orderPasses) {
          for (let i = 0; i < pass.quantity; i++) {
            const secureToken = uuidv4();
            
            // Generate QR code
            const qrCodeBuffer = await QRCode.default.toBuffer(secureToken, {
              type: 'png',
              width: 300,
              margin: 2
            });
            
            // Upload to Supabase Storage
            const fileName = `tickets/${orderId}/${secureToken}.png`;
            const { data: uploadData, error: uploadError } = await storageClient.storage
              .from('tickets')
              .upload(fileName, qrCodeBuffer, {
                contentType: 'image/png',
                upsert: true
              });
            
            if (uploadError) {
              console.error(`❌ Error uploading QR code:`, uploadError);
              continue;
            }
            
            // Get public URL
            const { data: urlData } = storageClient.storage
              .from('tickets')
              .getPublicUrl(fileName);
            
            // Create ticket entry
            const { data: ticketData, error: ticketError } = await dbClient
              .from('tickets')
              .insert({
                order_id: orderId,
                order_pass_id: pass.id,
                secure_token: secureToken,
                qr_code_url: urlData?.publicUrl || null,
                status: 'GENERATED',
                generated_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (ticketError) {
              console.error(`❌ Error creating ticket:`, ticketError);
              continue;
            }
            
            if (ticketData) {
              tickets.push(ticketData);
            }
          }
        }
        
        if (tickets.length === 0) {
          throw new Error('Failed to generate any tickets');
        }
        
        console.log(`✅ Generated ${tickets.length} tickets`);
        ticketResult.ticketsCount = tickets.length;
        
        // Group tickets by pass type for email
        const ticketsByPassType = new Map();
        tickets.forEach(ticket => {
          const pass = orderPasses.find(p => p.id === ticket.order_pass_id);
          if (pass) {
            const key = pass.pass_type;
            if (!ticketsByPassType.has(key)) {
              ticketsByPassType.set(key, []);
            }
            ticketsByPassType.get(key).push({ ...ticket, passType: key });
          }
        });
        
        // Build passes summary
        const passesSummary = orderPasses.map(p => ({
          passType: p.pass_type,
          quantity: p.quantity,
          price: p.price,
        }));
        
        // Build tickets HTML for email
        const ticketsHtml = Array.from(ticketsByPassType.entries())
          .map(([passType, passTickets]) => {
            const ticketsList = passTickets
              .map((ticket, index) => {
                return `
                  <div style="margin: 20px 0; padding: 20px; background: #E8E8E8; border-radius: 8px; text-align: center; border: 1px solid rgba(0, 0, 0, 0.1);">
                    <h4 style="margin: 0 0 15px 0; color: #E21836; font-size: 16px; font-weight: 600;">${passType} - Ticket ${index + 1}</h4>
                    <img src="${ticket.qr_code_url}" alt="QR Code for ${passType}" style="max-width: 250px; height: auto; border-radius: 8px; border: 2px solid rgba(226, 24, 54, 0.3); display: block; margin: 0 auto;" />
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #666666; font-family: 'Courier New', monospace;">Token: ${ticket.secure_token.substring(0, 8)}...</p>
                  </div>
                `;
              })
              .join('');
            
            return `
              <div style="margin: 30px 0;">
                <h3 style="color: #E21836; margin-bottom: 15px; font-size: 18px; font-weight: 600;">${passType} Tickets (${passTickets.length})</h3>
                ${ticketsList}
              </div>
            `;
          })
          .join('');
        
        const passesSummaryHtml = passesSummary.map(p => `
          <tr style="border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px;">${p.passType}</td>
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: center;">${p.quantity}</td>
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: right;">${p.price.toFixed(2)} TND</td>
          </tr>
        `).join('');
        
        // Send email with QR codes
        if (fullOrder.user_email && process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_HOST) {
          try {
            const nodemailer = await import('nodemailer');
            const transporter = nodemailer.default.createTransport({
              host: process.env.EMAIL_HOST,
              port: parseInt(process.env.EMAIL_PORT || '587'),
              secure: false,
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });
            
            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Your Digital Tickets - Andiamo Events</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; background: #FFFFFF; }
                  .email-wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
                  .content-card { background: #F5F5F5; margin: 0 20px 30px; border-radius: 12px; padding: 50px 40px; border: 1px solid rgba(0, 0, 0, 0.1); }
                  .title-section { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); }
                  .title { font-size: 32px; font-weight: 700; color: #1A1A1A; margin-bottom: 12px; }
                  .subtitle { font-size: 16px; color: #666666; }
                  .greeting { font-size: 18px; color: #1A1A1A; margin-bottom: 30px; }
                  .greeting strong { color: #E21836; font-weight: 600; }
                  .message { font-size: 16px; color: #666666; margin-bottom: 25px; }
                  .order-info-block { background: #E8E8E8; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 8px; padding: 30px; margin: 40px 0; }
                  .info-row { margin-bottom: 20px; }
                  .info-label { font-size: 11px; color: #999999; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 600; }
                  .info-value { font-family: 'Courier New', monospace; font-size: 18px; color: #1A1A1A; font-weight: 500; }
                  .passes-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                  .passes-table th { text-align: left; padding: 12px 0; color: #E21836; font-weight: 600; font-size: 14px; border-bottom: 2px solid rgba(226, 24, 54, 0.3); }
                  .passes-table td { padding: 12px 0; color: #1A1A1A; font-size: 15px; }
                  .total-row { border-top: 2px solid rgba(226, 24, 54, 0.3); }
                  .total-row td { font-weight: 700; font-size: 18px; color: #E21836; padding-top: 15px; }
                  .tickets-section { background: #E8E8E8; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 8px; padding: 30px; margin: 40px 0; }
                  .support-section { background: #E8E8E8; border-left: 3px solid rgba(226, 24, 54, 0.3); padding: 20px 25px; margin: 35px 0; border-radius: 4px; }
                  .support-text { font-size: 14px; color: #666666; line-height: 1.7; }
                  .support-email { color: #E21836 !important; text-decoration: none; font-weight: 500; }
                  .closing-section { text-align: center; margin: 50px 0 40px; padding-top: 40px; border-top: 1px solid rgba(0, 0, 0, 0.1); }
                  .slogan { font-size: 24px; font-style: italic; color: #E21836; font-weight: 300; margin-bottom: 30px; }
                  .signature { font-size: 16px; color: #666666; line-height: 1.7; }
                </style>
              </head>
              <body>
                <div class="email-wrapper">
                  <div class="content-card">
                    <div class="title-section">
                      <h1 class="title">Your Tickets Are Ready</h1>
                      <p class="subtitle">Order Confirmation - Andiamo Events</p>
                    </div>
                    <p class="greeting">Dear <strong>${fullOrder.user_name || 'Valued Customer'}</strong>,</p>
                    <p class="message">We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are ready and attached below.</p>
                    <div class="order-info-block">
                      <div class="info-row">
                        <div class="info-label">Order ID</div>
                        <div class="info-value">${fullOrder.order_number != null ? fullOrder.order_number.toString() : orderId.substring(0, 8).toUpperCase()}</div>
                      </div>
                      <div class="info-row">
                        <div class="info-label">Event</div>
                        <div style="font-size: 18px; color: #E21836; font-weight: 600;">${fullOrder.events?.name || 'Event'}</div>
                      </div>
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
                            <td style="text-align: right;"><strong>${fullOrder.total_price.toFixed(2)} TND</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div class="tickets-section">
                      <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Your Digital Tickets</h3>
                      <p class="message" style="margin-bottom: 25px;">Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.</p>
                      ${ticketsHtml}
                    </div>
                    <div class="support-section">
                      <p class="support-text">Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>.</p>
                    </div>
                    <div class="closing-section">
                      <p class="slogan">We Create Memories</p>
                      <p class="signature">Best regards,<br>The Andiamo Events Team</p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `;
            
            await transporter.sendMail({
              from: `Andiamo Events <${process.env.EMAIL_USER}>`,
              to: fullOrder.user_email,
              subject: 'Your Digital Tickets Are Ready - Andiamo Events',
              html: emailHtml
            });
            
            // Update tickets to DELIVERED
            const ticketIds = tickets.map(t => t.id);
            await dbClient
              .from('tickets')
              .update({
                status: 'DELIVERED',
                email_delivery_status: 'sent',
                delivered_at: new Date().toISOString()
              })
              .in('id', ticketIds);
            
            // Log email delivery
            await dbClient.from('email_delivery_logs').insert({
              order_id: orderId,
              email_type: 'ticket_delivery',
              recipient_email: fullOrder.user_email,
              recipient_name: fullOrder.user_name,
              subject: 'Your Digital Tickets Are Ready - Andiamo Events',
              status: 'sent',
              sent_at: new Date().toISOString()
            });
            
            ticketResult.emailSent = true;
            console.log('✅ Email sent successfully');
          } catch (emailError) {
            console.error('❌ Error sending email:', emailError);
            ticketResult.error = `Email failed: ${emailError.message}`;
          }
        } else {
          console.warn('⚠️ Email not sent - missing email address or email configuration');
        }
        
        // Send SMS
        if (fullOrder.user_phone && process.env.WINSMS_API_KEY) {
          try {
            // Format phone number
            let cleaned = fullOrder.user_phone.replace(/\D/g, '');
            if (cleaned.startsWith('216')) {
              cleaned = cleaned.substring(3);
            }
            cleaned = cleaned.replace(/^0+/, '');
            
            if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
              const formattedPhone = '+216' + cleaned;
              
              // Build SMS message
              const orderNumber = fullOrder.order_number != null ? fullOrder.order_number.toString() : '';
              const totalPrice = parseFloat(fullOrder.total_price).toFixed(0);
              const smsMessage = `Paiement confirmé #${orderNumber}
Total: ${totalPrice} DT
Billets envoyés par email (Check SPAM).
We Create Memories`;
              
              // Send SMS via WinSMS API
              const querystring = await import('querystring');
              const https = await import('https');
              
              const queryParams = querystring.default.stringify({
                action: 'send-sms',
                api_key: process.env.WINSMS_API_KEY,
                to: formattedPhone,
                sms: smsMessage.trim(),
                from: 'Andiamo',
                response: 'json'
              });
              
              const url = `https://www.winsmspro.com/sms/sms/api?${queryParams}`;
              
              const smsResponse = await new Promise((resolve, reject) => {
                https.default.get(url, (res) => {
                  let data = '';
                  res.on('data', (chunk) => { data += chunk; });
                  res.on('end', () => {
                    try {
                      resolve({ status: res.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                      resolve({ status: res.statusCode, data: data });
                    }
                  });
                }).on('error', reject);
              });
              
              const isSuccess = smsResponse.status === 200 &&
                smsResponse.data &&
                (smsResponse.data.code === 'ok' || smsResponse.data.code === '200');
              
              if (isSuccess) {
                ticketResult.smsSent = true;
                await dbClient.from('sms_logs').insert({
                  phone_number: fullOrder.user_phone,
                  message: smsMessage.trim(),
                  status: 'sent',
                  api_response: JSON.stringify(smsResponse.data),
                  sent_at: new Date().toISOString()
                });
                console.log('✅ SMS sent successfully');
              } else {
                throw new Error('SMS API returned error');
              }
            } else {
              console.warn('⚠️ Invalid phone number format:', fullOrder.user_phone);
            }
          } catch (smsError) {
            console.error('❌ Error sending SMS:', smsError);
            if (!ticketResult.error) {
              ticketResult.error = `SMS failed: ${smsError.message}`;
            } else {
              ticketResult.error += `; SMS failed: ${smsError.message}`;
            }
          }
        } else {
          console.warn('⚠️ SMS not sent - missing phone number or SMS configuration');
        }
        
        ticketResult.success = true;
        ticketResult.message = 'Tickets generated successfully';
      }
    } catch (ticketError) {
      console.error('❌ Error generating tickets:', ticketError);
      ticketResult.error = ticketError.message;
    }
    
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

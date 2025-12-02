/**
 * Ticket Generation Service
 * 
 * This service handles the automated ticket generation process when an order reaches PAID status.
 * For COD orders, this happens when an ambassador marks the order as COMPLETED.
 * 
 * Process Flow:
 * 1. Monitor order status changes to COMPLETED (COD orders) or PAID (online orders)
 * 2. For each pass in order_passes, create a ticket entry with unique secure token
 * 3. Generate QR code image from the secure token
 * 4. Upload QR code to Supabase Storage
 * 5. Update ticket status to GENERATED
 * 6. Compose and send confirmation email with all ticket QR codes
 * 7. Update all tickets to DELIVERED status
 * 8. Log email delivery state for admin monitoring
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { API_ROUTES } from './api-routes';

// Types
interface OrderPass {
  id: string;
  order_id: string;
  pass_type: string;
  quantity: number;
  price: number;
}

interface Ticket {
  id: string;
  order_id: string;
  order_pass_id: string;
  secure_token: string;
  qr_code_url: string | null;
  status: 'PENDING' | 'GENERATED' | 'DELIVERED' | 'FAILED';
  email_delivery_status: 'pending' | 'sent' | 'failed' | 'pending_retry' | null;
}

interface OrderData {
  id: string;
  user_name: string;
  user_email: string;
  total_price: number;
  status: string;
  payment_method: string;
  source: string;
  events?: {
    id: string;
    name: string;
    date: string;
    venue: string;
  };
  ambassadors?: {
    id: string;
    full_name: string;
    phone: string;
  };
}

interface TicketGenerationResult {
  success: boolean;
  tickets: Ticket[];
  emailSent: boolean;
  error?: string;
}

// Initialize Supabase client
const getSupabaseClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
};

/**
 * Generate QR code image from secure token
 * Note: This function should be called from the backend (server.cjs) where Node.js QR code libraries are available
 * For frontend usage, this would need to call an API endpoint
 */
const generateQRCodeImage = async (secureToken: string): Promise<Buffer | string> => {
  // This function should be implemented on the backend
  // For now, we'll return a placeholder that indicates the backend should handle this
  // In server.cjs, use: const QRCode = require('qrcode');
  // const qrCodeBuffer = await QRCode.toBuffer(secureToken, { type: 'png', width: 300 });
  
  // For frontend, we need to call an API endpoint
  try {
    const response = await fetch(API_ROUTES.GENERATE_QR_CODE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: secureToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate QR code');
    }

    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

/**
 * Upload QR code to Supabase Storage
 */
const uploadQRCodeToStorage = async (
  supabase: ReturnType<typeof createClient>,
  qrCodeBlob: Blob | Buffer,
  secureToken: string,
  orderId: string
): Promise<string> => {
  const fileName = `tickets/${orderId}/${secureToken}.png`;
  
  // Convert Blob to ArrayBuffer if needed
  let arrayBuffer: ArrayBuffer;
  if (qrCodeBlob instanceof Blob) {
    arrayBuffer = await qrCodeBlob.arrayBuffer();
  } else {
    // It's a Buffer (Node.js)
    arrayBuffer = qrCodeBlob.buffer.slice(qrCodeBlob.byteOffset, qrCodeBlob.byteOffset + qrCodeBlob.byteLength);
  }

  const { data, error } = await supabase.storage
    .from('tickets')
    .upload(fileName, arrayBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading QR code to storage:', error);
    throw new Error(`Failed to upload QR code: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('tickets')
    .getPublicUrl(fileName);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for QR code');
  }

  return urlData.publicUrl;
};

/**
 * Create ticket entries for all passes in an order
 */
const createTicketEntries = async (
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  orderPasses: OrderPass[]
): Promise<Ticket[]> => {
  const tickets: Ticket[] = [];

  for (const pass of orderPasses) {
    // Generate unique secure token for each ticket
    // For multiple quantities, create one ticket per quantity
    for (let i = 0; i < pass.quantity; i++) {
      const secureToken = uuidv4();
      
      const { data: ticketData, error } = await supabase
        .from('tickets')
        .insert({
          order_id: orderId,
          order_pass_id: pass.id,
          secure_token: secureToken,
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) {
        console.error(`Error creating ticket for pass ${pass.id}:`, error);
        throw new Error(`Failed to create ticket: ${error.message}`);
      }

      if (ticketData) {
        tickets.push(ticketData as Ticket);
      }
    }
  }

  return tickets;
};

/**
 * Generate QR codes for all tickets and upload to storage
 */
const generateAndUploadQRCodes = async (
  supabase: ReturnType<typeof createClient>,
  tickets: Ticket[],
  orderId: string
): Promise<Ticket[]> => {
  const updatedTickets: Ticket[] = [];

  for (const ticket of tickets) {
    try {
      // Generate QR code image
      const qrCodeBlob = await generateQRCodeImage(ticket.secure_token);

      // Upload to Supabase Storage
      const qrCodeUrl = await uploadQRCodeToStorage(
        supabase,
        qrCodeBlob as Blob,
        ticket.secure_token,
        orderId
      );

      // Update ticket with QR code URL and status
      const { data: updatedTicket, error } = await supabase
        .from('tickets')
        .update({
          qr_code_url: qrCodeUrl,
          status: 'GENERATED',
          generated_at: new Date().toISOString(),
        })
        .eq('id', ticket.id)
        .select()
        .single();

      if (error) {
        console.error(`Error updating ticket ${ticket.id}:`, error);
        // Mark ticket as failed
        await supabase
          .from('tickets')
          .update({ status: 'FAILED' })
          .eq('id', ticket.id);
        continue;
      }

      if (updatedTicket) {
        updatedTickets.push(updatedTicket as Ticket);
      }
    } catch (error) {
      console.error(`Error generating QR code for ticket ${ticket.id}:`, error);
      // Mark ticket as failed
      await supabase
        .from('tickets')
        .update({ status: 'FAILED' })
        .eq('id', ticket.id);
    }
  }

  return updatedTickets;
};

/**
 * Compose confirmation email HTML with all ticket QR codes
 */
const composeConfirmationEmail = (
  orderData: OrderData,
  tickets: Ticket[],
  orderPasses: OrderPass[]
): string => {
  const customerName = orderData.user_name || 'Valued Customer';
  const eventName = orderData.events?.name || 'Event';
  const totalAmount = orderData.total_price;
  const ambassadorName = orderData.ambassadors?.full_name || 'Our Ambassador';

  // Group tickets by pass type
  const ticketsByPassType = new Map<string, Ticket[]>();
  tickets.forEach(ticket => {
    const pass = orderPasses.find(p => p.id === ticket.order_pass_id);
    if (pass) {
      const key = pass.pass_type;
      if (!ticketsByPassType.has(key)) {
        ticketsByPassType.set(key, []);
      }
      ticketsByPassType.get(key)!.push(ticket);
    }
  });

  // Build passes summary
  const passesSummary = orderPasses.map(p => ({
    passType: p.pass_type,
    quantity: p.quantity,
    price: p.price,
  }));

  // Build tickets HTML
  const ticketsHtml = Array.from(ticketsByPassType.entries())
    .map(([passType, passTickets]) => {
      const ticketsList = passTickets
        .map(ticket => {
          if (ticket.qr_code_url) {
            return `
              <div style="margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 15px 0; color: #667eea;">${passType} - Ticket ${passTickets.indexOf(ticket) + 1}</h4>
                <img src="${ticket.qr_code_url}" alt="QR Code for ${passType}" style="max-width: 250px; height: auto; border-radius: 8px; border: 2px solid hsl(195, 100%, 50%, 0.3); display: block; margin: 0 auto;" />
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Token: ${ticket.secure_token.substring(0, 8)}...</p>
              </div>
            `;
          }
          return '';
        })
        .join('');

      return `
        <div style="margin: 30px 0;">
          <h3 style="color: #667eea; margin-bottom: 15px;">${passType} Tickets (${passTickets.length})</h3>
          ${ticketsList}
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - Andiamo Events</title>
      <style>
        body { 
          font-family: 'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
          line-height: 1.7; 
          color: #333; 
          background: #f4f4f4; 
          padding: 20px; 
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white; 
          padding: 30px; 
          border-radius: 10px; 
          box-shadow: 0 0 10px rgba(0,0,0,0.1); 
        }
        .header { 
          background: linear-gradient(135deg, hsl(285, 85%, 65%) 0%, hsl(195, 100%, 50%) 50%, hsl(330, 100%, 65%) 100%); 
          color: white; 
          padding: 30px; 
          text-align: center; 
          border-radius: 10px 10px 0 0; 
          margin: -30px -30px 30px -30px; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px; 
        }
        .content { 
          padding: 20px 0; 
        }
        .order-info { 
          background: #f9f9f9; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
        }
        .order-info h3 { 
          margin-top: 0; 
          color: #667eea; 
        }
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          padding: 10px 0; 
          border-bottom: 1px solid #eee; 
        }
        .info-row:last-child { 
          border-bottom: none; 
        }
        .passes-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0; 
        }
        .passes-table th, .passes-table td { 
          padding: 12px; 
          text-align: left; 
          border-bottom: 1px solid #eee; 
        }
        .passes-table th { 
          background: #f9f9f9; 
          color: #667eea; 
          font-weight: 600; 
        }
        .total-row { 
          font-weight: bold; 
          font-size: 18px; 
          color: #667eea; 
        }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #eee; 
          color: #666; 
          font-size: 14px; 
        }
        .support-link { 
          display: inline-block; 
          margin-top: 20px; 
          padding: 12px 24px; 
          background: #667eea; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Order Confirmed!</h1>
          <p>Your Digital Tickets Are Ready</p>
        </div>
        <div class="content">
          <p>Dear <strong>${customerName}</strong>,</p>
          <p>We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are ready and attached below.</p>
          
          <div class="order-info">
            <h3>📋 Order Details</h3>
            <div class="info-row">
              <span><strong>Order ID:</strong></span>
              <span>${orderData.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span><strong>Event:</strong></span>
              <span>${eventName}</span>
            </div>
            <div class="info-row">
              <span><strong>Total Amount:</strong></span>
              <span><strong>${totalAmount.toFixed(2)} TND</strong></span>
            </div>
            ${orderData.ambassadors ? `
            <div class="info-row">
              <span><strong>Delivered by:</strong></span>
              <span>${ambassadorName}</span>
            </div>
            ` : ''}
          </div>

          <div class="order-info">
            <h3>🎫 Passes Purchased</h3>
            <table class="passes-table">
              <thead>
                <tr>
                  <th>Pass Type</th>
                  <th>Quantity</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                ${passesSummary.map(p => `
                  <tr>
                    <td>${p.passType}</td>
                    <td>${p.quantity}</td>
                    <td>${p.price.toFixed(2)} TND</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="2"><strong>Total Amount Paid:</strong></td>
                  <td><strong>${totalAmount.toFixed(2)} TND</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="order-info">
            <h3>🎫 Your Digital Tickets</h3>
            <p>Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.</p>
            ${ticketsHtml}
          </div>

          <div class="order-info">
            <h3>💳 Payment Confirmation</h3>
            <p>Your payment of <strong>${totalAmount.toFixed(2)} TND</strong> has been successfully received${orderData.ambassadors ? ` by our ambassador <strong>${ambassadorName}</strong>` : ''}. Your order is now fully validated and confirmed.</p>
          </div>

          <div class="order-info">
            <h3>💬 Need Help?</h3>
            <p>If you have any questions about your order, need to verify your purchase, or require assistance, please don't hesitate to contact our support team.</p>
            <a href="${typeof window !== 'undefined' ? window.location.origin : 'https://andiamo-events.tn'}/contact" class="support-link">Contact Support</a>
          </div>

          <p>Thank you for choosing Andiamo Events! We look forward to seeing you at the event.</p>
          <p><strong>Best regards,<br>The Andiamo Team</strong></p>
        </div>
        <div class="footer">
          <p>© 2024 Andiamo Events. All rights reserved.</p>
          <p>Tunisia's Premier Nightlife Experience</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send confirmation email with all ticket QR codes
 */
const sendConfirmationEmail = async (
  orderData: OrderData,
  tickets: Ticket[],
  orderPasses: OrderPass[]
): Promise<{ success: boolean; error?: string }> => {
  if (!orderData.user_email) {
    throw new Error('Customer email is required to send confirmation email');
  }

  const emailHtml = composeConfirmationEmail(orderData, tickets, orderPasses);
  const subject = '✅ Order Confirmation - Your Digital Tickets Are Ready!';

  try {
    const response = await fetch(API_ROUTES.SEND_EMAIL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: orderData.user_email,
        subject,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send email');
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Log email delivery status
 */
const logEmailDelivery = async (
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  orderData: OrderData,
  tickets: Ticket[],
  emailStatus: 'sent' | 'failed' | 'pending_retry',
  errorMessage?: string
): Promise<void> => {
  try {
    await supabase.from('email_delivery_logs').insert({
      order_id: orderId,
      email_type: 'ticket_delivery',
      recipient_email: orderData.user_email,
      recipient_name: orderData.user_name,
      subject: '✅ Order Confirmation - Your Digital Tickets Are Ready!',
      status: emailStatus,
      error_message: errorMessage || null,
      sent_at: emailStatus === 'sent' ? new Date().toISOString() : null,
      retry_count: emailStatus === 'pending_retry' ? 1 : 0,
    });
  } catch (error) {
    console.error('Error logging email delivery:', error);
    // Don't throw - logging failure shouldn't break the process
  }
};

/**
 * Update tickets to DELIVERED status
 */
const updateTicketsToDelivered = async (
  supabase: ReturnType<typeof createClient>,
  tickets: Ticket[],
  emailStatus: 'sent' | 'failed' | 'pending_retry'
): Promise<void> => {
  const ticketIds = tickets.map(t => t.id);
  const deliveryStatus = emailStatus === 'sent' ? 'DELIVERED' : 'FAILED';
  const emailDeliveryStatus = emailStatus;

  await supabase
    .from('tickets')
    .update({
      status: deliveryStatus,
      email_delivery_status: emailDeliveryStatus,
      delivered_at: emailStatus === 'sent' ? new Date().toISOString() : null,
    })
    .in('id', ticketIds);
};

/**
 * Main function: Generate tickets for an order
 * This should be called when an order reaches COMPLETED status (COD) or PAID status (online)
 */
export const generateTicketsForOrder = async (
  orderId: string
): Promise<TicketGenerationResult> => {
  const supabase = getSupabaseClient();

  try {
    // 1. Fetch order data with related information
    const { data: orderData, error: orderError } = await supabase
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

    if (orderError || !orderData) {
      throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
    }

    const order = orderData as unknown as OrderData;

    // 2. Check if order is in the correct status (COMPLETED for COD, PAID for online)
    const isPaidStatus = 
      (order.source === 'platform_cod' && order.status === 'COMPLETED') ||
      (order.source === 'platform_online' && order.status === 'PAID');

    if (!isPaidStatus) {
      throw new Error(`Order is not in a paid status. Current status: ${order.status}, Source: ${order.source}`);
    }

    // 3. Check if tickets already exist for this order
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (existingTickets && existingTickets.length > 0) {
      // Tickets already exist, return them
      const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('order_id', orderId);

      return {
        success: true,
        tickets: (tickets || []) as Ticket[],
        emailSent: false,
      };
    }

    // 4. Fetch all passes for this order
    const { data: orderPasses, error: passesError } = await supabase
      .from('order_passes')
      .select('*')
      .eq('order_id', orderId);

    if (passesError) {
      throw new Error(`Failed to fetch order passes: ${passesError.message}`);
    }

    if (!orderPasses || orderPasses.length === 0) {
      throw new Error('No passes found for this order');
    }

    // 5. Create ticket entries for all passes
    const tickets = await createTicketEntries(supabase, orderId, orderPasses as OrderPass[]);

    // 6. Generate QR codes and upload to storage
    const ticketsWithQRCodes = await generateAndUploadQRCodes(supabase, tickets, orderId);

    if (ticketsWithQRCodes.length === 0) {
      throw new Error('Failed to generate QR codes for any tickets');
    }

    // 7. Send confirmation email with all QR codes
    const emailResult = await sendConfirmationEmail(
      order,
      ticketsWithQRCodes,
      orderPasses as OrderPass[]
    );

    // 8. Log email delivery status
    const emailStatus = emailResult.success ? 'sent' : 'failed';
    await logEmailDelivery(
      supabase,
      orderId,
      order,
      ticketsWithQRCodes,
      emailStatus,
      emailResult.error
    );

    // 9. Update tickets to DELIVERED status
    await updateTicketsToDelivered(supabase, ticketsWithQRCodes, emailStatus);

    return {
      success: true,
      tickets: ticketsWithQRCodes,
      emailSent: emailResult.success,
    };
  } catch (error) {
    console.error('Error generating tickets:', error);
    return {
      success: false,
      tickets: [],
      emailSent: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Hook to monitor order status changes and trigger ticket generation
 * This can be used in a React component to watch for order status changes
 */
export const useTicketGeneration = () => {
  const supabase = getSupabaseClient();

  const monitorOrderStatus = (orderId: string, callback?: (result: TicketGenerationResult) => void) => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          const order = payload.new as OrderData;
          const isPaidStatus = 
            (order.source === 'platform_cod' && order.status === 'COMPLETED') ||
            (order.source === 'platform_online' && order.status === 'PAID');

          if (isPaidStatus) {
            const result = await generateTicketsForOrder(orderId);
            if (callback) {
              callback(result);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return { monitorOrderStatus, generateTicketsForOrder };
};


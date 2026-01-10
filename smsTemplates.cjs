/**
 * Centralized SMS Template Helpers
 * 
 * IMPORTANT: These templates are EXACT branding requirements.
 * DO NOT modify wording, capitalization, punctuation, or formatting.
 * ONLY replace placeholders with runtime values.
 * 
 * @module smsTemplates
 */

/**
 * Format passes text in the required format: "VIP x2, Standard x1"
 * @param {Array} passes - Array of pass objects with { pass_type, quantity }
 * @returns {string} Formatted passes text
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
 * @param {Object} order - Order object with order_number or id
 * @returns {string} Formatted order number (e.g., "123" without #)
 */
function formatOrderNumber(order) {
  if (order.order_number) {
    return order.order_number.toString();
  }
  // Fallback to first 8 characters of UUID if order_number doesn't exist
  return order.id ? order.id.substring(0, 8).toUpperCase() : '';
}

/**
 * 1️⃣ Client SMS — Order Confirmation
 * 
 * Template EXACT:
 * Commande #{order_number} confirmée
 * Pass: {passes_text} | Total: {total_price} DT
 * Ambassadeur: {ambassador_name} – {ambassador_phone}
 * We Create Memories
 * 
 * @param {Object} data - Order data
 * @param {Object} data.order - Order object
 * @param {Array} data.passes - Array of pass objects with { pass_type, quantity }
 * @param {Object} data.ambassador - Ambassador object with { full_name, phone }
 * @returns {string} SMS message
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
 * 2️⃣ Ambassador SMS — New Order
 * 
 * Template EXACT:
 * Nouvelle commande #{order_number}
 * Client: {client_name} – {client_phone} Pass: {passes_text}
 * Total: {total_price} DT
 * 
 * @param {Object} data - Order data
 * @param {Object} data.order - Order object with user_name, user_phone, total_price
 * @param {Array} data.passes - Array of pass objects with { pass_type, quantity }
 * @returns {string} SMS message
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
 * 3️⃣ Client SMS — After Admin Approval
 * 
 * Template EXACT:
 * Paiement confirmé #{order_number}
 * Total: {total_price} DT
 * Billets envoyés par email (Check SPAM).
 * We Create Memories
 * 
 * @param {Object} data - Order data
 * @param {Object} data.order - Order object with total_price
 * @returns {string} SMS message
 */
function buildClientAdminApprovalSMS(data) {
  const { order } = data;
  
  // Validate required fields
  if (!order) throw new Error('Order is required for client admin approval SMS');
  if (order.total_price === undefined || order.total_price === null) throw new Error('Order total_price is required');
  
  const orderNumber = formatOrderNumber(order);
  const totalPrice = parseFloat(order.total_price).toFixed(0);
  
  // Template EXACT - DO NOT MODIFY
  return `Paiement confirmé #${orderNumber}
Total: ${totalPrice} DT
Billets envoyés par email (Check SPAM).
We Create Memories`;
}

module.exports = {
  buildClientOrderConfirmationSMS,
  buildAmbassadorNewOrderSMS,
  buildClientAdminApprovalSMS,
  formatPassesText,
  formatOrderNumber
};

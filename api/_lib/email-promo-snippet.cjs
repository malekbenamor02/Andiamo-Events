'use strict';

/**
 * Parse promo snapshot from orders.notes JSON (written server-side at order create).
 * @param {unknown} orderOrNotes
 * @returns {{ code?: string, discount_amount?: number, original_subtotal?: number, discounted_subtotal?: number } | null}
 */
function parseOrderNotesPromo(orderOrNotes) {
  try {
    let notes = orderOrNotes;
    if (orderOrNotes && typeof orderOrNotes === 'object' && 'notes' in orderOrNotes) {
      notes = orderOrNotes.notes;
    }
    if (typeof notes === 'string') notes = JSON.parse(notes);
    if (!notes || typeof notes !== 'object') return null;
    const promo = notes.promo;
    if (!promo || typeof promo !== 'object') return null;
    return promo;
  } catch {
    return null;
  }
}

/**
 * @param {ReturnType<typeof parseOrderNotesPromo>} promo
 * @returns {string}
 */
function buildPromoEmailRowsHtml(promo) {
  if (!promo || !promo.code) return '';
  const discount = Number(promo.discount_amount);
  if (!Number.isFinite(discount) || discount <= 0) return '';
  const code = String(promo.code);
  return `
    <tr class="total-row">
      <td colspan="2" style="text-align: right; padding-right: 20px;"><strong>Promo code (${code}):</strong></td>
      <td style="text-align: right;"><strong>−${discount.toFixed(2)} TND</strong></td>
    </tr>`;
}

module.exports = {
  parseOrderNotesPromo,
  buildPromoEmailRowsHtml,
};

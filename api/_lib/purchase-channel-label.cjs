'use strict';

/**
 * Short label for the premium ticket footer / channel strip.
 *
 * @param {object} order - orders row (+ joined ambassadors, pos_outlets when available)
 * @param {{ mode?: 'order' | 'invitation' }} [ctx]
 * @returns {string}
 */
function getPurchaseChannelLabel(order, ctx) {
  if (!order || typeof order !== 'object') return 'Online';
  const mode = ctx && ctx.mode;
  if (mode === 'invitation') return 'Official invitation';

  const source = String(order.source || '').trim();
  const pm = String(order.payment_method || '').trim().toLowerCase();

  if (source === 'platform_online') return 'Online';

  if (source === 'point_de_vente') {
    const outlet =
      order.pos_outlets &&
      typeof order.pos_outlets === 'object' &&
      order.pos_outlets.name &&
      String(order.pos_outlets.name).trim();
    return outlet ? `Point de vente · ${outlet}` : 'Point de vente';
  }

  if (source === 'official_invitation') return 'Official invitation';

  const codLike =
    source === 'platform_cod' ||
    source === 'ambassador_manual' ||
    pm === 'ambassador_cash' ||
    pm === 'cod';

  if (codLike && pm !== 'online' && pm !== 'pos') {
    const name =
      order.ambassadors &&
      typeof order.ambassadors === 'object' &&
      order.ambassadors.full_name &&
      String(order.ambassadors.full_name).trim();
    return name || 'Ambassador';
  }

  return 'Online';
}

module.exports = { getPurchaseChannelLabel };

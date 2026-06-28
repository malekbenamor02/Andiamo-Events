'use strict';

const { getOnlinePaymentFeeRate, computeOnlinePaymentFees } = require('./online-payment-fee.cjs');

function isPaidOnlineOrder(order) {
  if (order.payment_method !== 'online') return false;
  return order.payment_status === 'PAID' || order.status === 'PAID' || order.status === 'COMPLETED';
}

function isPaidAmbassadorCashOrder(order) {
  if (order.payment_method !== 'ambassador_cash') return false;
  return order.status === 'PAID' || order.status === 'COMPLETED';
}

function isPaidOnlineOrAmbassadorOrder(order) {
  return isPaidOnlineOrder(order) || isPaidAmbassadorCashOrder(order);
}

function isPaidPosOrder(order) {
  if (order.status !== 'PAID' && order.status !== 'COMPLETED') return false;
  return order.payment_method === 'pos' || order.source === 'point_de_vente';
}

function getOrderTicketsAndRevenue(order) {
  const passes = order.order_passes;
  if (passes && Array.isArray(passes) && passes.length > 0) {
    let revenue = 0;
    let tickets = 0;
    for (const op of passes) {
      const q = op.quantity || 0;
      tickets += q;
      revenue += (op.price || 0) * q;
    }
    return { tickets, revenue };
  }
  const tickets = order.quantity || 0;
  const fromPrice = Number(order.total_price);
  const fromTotal = Number(order.total);
  const revenue = Number.isFinite(fromPrice) ? fromPrice : Number.isFinite(fromTotal) ? fromTotal : 0;
  return { tickets, revenue };
}

function getOrderReportRevenue(order) {
  const line = getOrderTicketsAndRevenue(order).revenue;
  if (order.payment_method !== 'online') return line;
  const paidOnline =
    order.payment_status === 'PAID' || order.status === 'PAID' || order.status === 'COMPLETED';
  if (!paidOnline) return line;
  const twf = Number(order.total_with_fees);
  if (Number.isFinite(twf)) return twf;
  if (line > 0) {
    const rate = getOnlinePaymentFeeRate();
    if (rate > 0) {
      return Number(computeOnlinePaymentFees(line).totalWithFees.toFixed(2));
    }
  }
  const tp = Number(order.total_price);
  return Number.isFinite(tp) ? tp : line;
}

module.exports = {
  isPaidOnlineOrder,
  isPaidAmbassadorCashOrder,
  isPaidOnlineOrAmbassadorOrder,
  isPaidPosOrder,
  getOrderTicketsAndRevenue,
  getOrderReportRevenue,
};

/**
 * Checkout / admin UI: must match server {@link api/lib/online-payment-fee.cjs}.
 * Set VITE_ONLINE_PAYMENT_FEE_RATE to the same value as ONLINE_PAYMENT_FEE_RATE (e.g. 0.05).
 */

const DEFAULT_ONLINE_PAYMENT_FEE_RATE = 0.05;
const MAX_ONLINE_PAYMENT_FEE_RATE = 0.5;

function parseOnlinePaymentFeeRate(raw: string | undefined): number {
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_ONLINE_PAYMENT_FEE_RATE;
  }
  const n = Number.parseFloat(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_ONLINE_PAYMENT_FEE_RATE;
  }
  return Math.min(MAX_ONLINE_PAYMENT_FEE_RATE, n);
}

export function getOnlinePaymentFeeRate(): number {
  return parseOnlinePaymentFeeRate(import.meta.env.VITE_ONLINE_PAYMENT_FEE_RATE as string | undefined);
}

export function computeOnlinePaymentFeesDisplay(subtotal: number): {
  feeRate: number;
  feeAmount: number;
  totalWithFees: number;
} {
  const rate = getOnlinePaymentFeeRate();
  const sub = Number(subtotal);
  if (!Number.isFinite(sub) || sub <= 0) {
    return { feeRate: rate, feeAmount: 0, totalWithFees: 0 };
  }
  if (rate <= 0) {
    return { feeRate: rate, feeAmount: 0, totalWithFees: sub };
  }
  const feeAmount = Number((sub * rate).toFixed(3));
  const totalWithFees = sub + feeAmount;
  return { feeRate: rate, feeAmount, totalWithFees };
}

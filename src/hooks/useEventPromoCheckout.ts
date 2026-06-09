import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { normalizeEventPromoCodeInput } from '@/lib/eventPromo/promoCode';
import { PaymentMethod } from '@/lib/constants/orderStatuses';

const DEBOUNCE_MS = 450;

/** Server validate response — preview only; billing is recomputed on order create. */
export type EventPromoPreview =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'valid';
      code: string;
      discountAmount: number;
      discountLabel: string;
      subtotalBeforePromo: number;
      discountedSubtotal: number;
      feeAmount: number;
      totalWithFees: number;
    }
  | { status: 'invalid' };

type PassLineInput = { passId: string; quantity: number };

export function useEventPromoCheckout(options: {
  eventId: string | undefined;
  promoAvailable: boolean;
  promoCodeDraft: string;
  passes: PassLineInput[];
  paymentMethod: PaymentMethod | null;
}) {
  const { eventId, promoAvailable, promoCodeDraft, passes, paymentMethod } = options;
  const [preview, setPreview] = useState<EventPromoPreview>({ status: 'idle' });
  const requestGen = useRef(0);

  const promoAllowedPayment =
    paymentMethod === PaymentMethod.ONLINE || paymentMethod === PaymentMethod.AMBASSADOR_CASH;

  const runValidate = useCallback(async () => {
    const gen = ++requestGen.current;
    const raw = promoCodeDraft.trim();
    if (!promoAvailable || !eventId || !raw) {
      setPreview({ status: 'idle' });
      return;
    }
    const code = normalizeEventPromoCodeInput(raw);
    if (!code) {
      setPreview({ status: 'idle' });
      return;
    }
    if (!promoAllowedPayment) {
      setPreview({ status: 'idle' });
      return;
    }
    const cartLines = passes.filter((p) => p.quantity > 0);
    if (!cartLines.length) {
      setPreview({ status: 'idle' });
      return;
    }

    setPreview({ status: 'loading' });
    try {
      const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.EVENT_PROMO_VALIDATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          promoCode: code,
          passes: cartLines,
          paymentMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (gen !== requestGen.current) return;

      if (data.valid) {
        setPreview({
          status: 'valid',
          code: String(data.code || code),
          discountAmount: Number(data.discountAmount) || 0,
          discountLabel: String(data.discountLabel || ''),
          subtotalBeforePromo: Number(data.subtotalBeforePromo) || 0,
          discountedSubtotal: Number(data.discountedSubtotal) || 0,
          feeAmount: Number(data.feeAmount) || 0,
          totalWithFees: Number(data.totalWithFees) || 0,
        });
        return;
      }
      setPreview({ status: 'invalid' });
    } catch {
      if (gen === requestGen.current) setPreview({ status: 'invalid' });
    }
  }, [eventId, promoAvailable, promoCodeDraft, passes, paymentMethod, promoAllowedPayment]);

  useEffect(() => {
    if (!promoAvailable || !eventId) {
      setPreview({ status: 'idle' });
      return;
    }
    const raw = promoCodeDraft.trim();
    if (!raw) {
      setPreview({ status: 'idle' });
      return;
    }

    const timer = window.setTimeout(() => {
      void runValidate();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [promoAvailable, eventId, promoCodeDraft, passes, paymentMethod, runValidate]);

  const promoSubmitCode =
    preview.status === 'valid' ? normalizeEventPromoCodeInput(promoCodeDraft) : null;

  return {
    preview,
    promoSubmitCode,
    promoAllowedPayment,
  };
}

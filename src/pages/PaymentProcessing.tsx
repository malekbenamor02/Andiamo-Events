/**
 * Payment Processing Page
 * Handles ClicToPay redirect: calls confirm API and shows success/failure
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { OnlinePaymentStatusScreen } from '@/components/orders/OnlinePaymentStatusScreen';
import { getPaymentReturnPath } from '@/lib/orders/paymentReturnPath';
import { getApiBaseUrl } from '@/lib/api-routes';
import { mapPublicError, mapThrownError } from '@/lib/userErrors';
import {
  consumePurchaseSnapshot,
  isValidTicketMetaPixelPayload,
  trackConfirmedPurchase,
  trackPurchaseFromBackend,
} from '@/lib/meta';
import type { TicketMetaTrackingResponse } from '@/lib/meta';

interface PaymentProcessingProps {
  language?: 'en' | 'fr';
}

export default function PaymentProcessing({ language = 'en' }: PaymentProcessingProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId') || searchParams.get('order_id');
  const isReturn = searchParams.get('return') === '1';
  const isInit = searchParams.get('init') === '1';

  const [state, setState] = useState<'loading' | 'success' | 'failed' | 'redirecting' | 'unknown'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<{
    success?: boolean;
    orderId?: string;
    status?: string;
    message?: string;
    ticketsGenerated?: boolean;
    ticketsCount?: number;
    emailSent?: boolean;
    smsSent?: boolean;
    alreadyPaid?: boolean;
    metaTracking?: TicketMetaTrackingResponse;
  } | null>(null);
  const [purchaseTracked, setPurchaseTracked] = useState(false);
  const confirmStartedRef = useRef(false);

  const t = language === 'en' ? {
    title: 'Processing payment',
    redirecting: 'Redirecting to payment...',
    pleaseWait: 'Please wait...',
    successTitle: 'Payment confirmed',
    successSubtitle: 'Thank you for your order',
    successMessage: 'Your payment has been confirmed. Your tickets have been sent to your email.',
    failedTitle: 'Payment failed',
    failedMessage: 'Your payment could not be completed. Please try again or choose another payment method.',
    unknownTitle: 'Payment not confirmed',
    unknownMessage:
      'We could not reach the bank to confirm your payment. If you see a debit on your card, please wait for an email or SMS confirmation, or contact our support.',
    backToEvents: 'Back to events',
    buyAgain: 'Buy again',
    goBack: 'Go back',
    contactSupport: 'Contact support',
    close: 'Close',
    noOrder: 'Invalid request. No order ID provided.',
    genericError: 'Something went wrong. Please try again or contact us.'
  } : {
    title: 'Traitement du paiement',
    redirecting: 'Redirection vers le paiement...',
    pleaseWait: 'Veuillez patienter...',
    successTitle: 'Paiement confirmé',
    successSubtitle: 'Merci pour votre commande',
    successMessage: 'Votre paiement a été confirmé. Vos billets ont été envoyés par email.',
    failedTitle: 'Paiement échoué',
    failedMessage: 'Votre paiement n\'a pas pu être traité. Veuillez réessayer ou choisir un autre mode de paiement.',
    unknownTitle: 'Paiement non confirmé',
    unknownMessage:
      'Nous n\'avons pas pu joindre la banque pour confirmer votre paiement. Si vous voyez un débit sur votre carte, veuillez attendre un email ou un SMS de confirmation, ou contacter notre support.',
    backToEvents: 'Retour aux événements',
    buyAgain: 'Réessayer',
    goBack: 'Retour',
    contactSupport: 'Contacter le support',
    close: 'Fermer',
    noOrder: 'Requête invalide. Aucun numéro de commande.',
    genericError: 'Une erreur s\'est produite. Veuillez réessayer ou nous contacter.'
  };

  const mapPaymentError = (input: Parameters<typeof mapPublicError>[0]) =>
    mapPublicError(input, language);

  useEffect(() => {
    if (!orderId) {
      setState('failed');
      setError(mapPaymentError({ error: 'invalid_request', message: t.noOrder }).description);
      return;
    }

    const generateAndRedirect = async () => {
      const base = getApiBaseUrl();
      const url = `${base}/api/clictopay-generate-payment`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId })
        });
        const data = await res.json().catch(() => ({}));
        const formUrl = data.formUrl || data.form_url;
        if (formUrl) {
          setState('redirecting');
          window.location.href = formUrl;
          return;
        }
        setState('failed');
        setError(
          mapPaymentError({
            error: data.error,
            message: data.message || data.error || t.genericError,
          }).description
        );
      } catch (err: unknown) {
        setState('failed');
        setError(mapThrownError(err, language).description);
      }
    };

    const confirm = async () => {
      if (confirmStartedRef.current) return;
      confirmStartedRef.current = true;

      const base = getApiBaseUrl();
      const url = `${base}/api/clictopay-confirm-payment`;
      const body = JSON.stringify({ orderId });
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
        const data = await res.json().catch(() => ({}));
        setConfirmResult(data);

        if (data.alreadyPaid || (data.success && data.status === 'PAID')) {
          setState('success');
        } else if (data.status === 'UNKNOWN') {
          setState('unknown');
          setError(
            mapPaymentError({
              error: 'payment_unknown',
              message: data.message,
            }).description
          );
        } else if (data.status === 'failed' || !data.success) {
          setState('failed');
          setError(
            mapPaymentError({
              error: data.error || 'payment_failed',
              message: data.message || t.failedMessage,
            }).description
          );
        } else if (!res.ok) {
          setState('failed');
          setError(
            mapPaymentError({
              error: data.error,
              message: data.message || t.genericError,
            }).description
          );
        } else {
          setState('success');
        }
      } catch (err: unknown) {
        setState('failed');
        setError(mapThrownError(err, language).description);
      }
    };

    if (isInit) {
      generateAndRedirect();
    } else if (isReturn) {
      confirm();
    } else {
      setState('failed');
      setError(mapPaymentError({ error: 'invalid_request', message: t.genericError }).description);
    }
  }, [orderId, isReturn, isInit, language]);

  useEffect(() => {
    if (state !== 'success' || purchaseTracked || !orderId) return;
    if (!confirmResult?.alreadyPaid && !(confirmResult?.success && confirmResult?.status === 'PAID')) return;

    const metaTracking = confirmResult.metaTracking;
    if (metaTracking?.pixel && isValidTicketMetaPixelPayload(metaTracking.pixel)) {
      trackPurchaseFromBackend(metaTracking.pixel);
    } else {
      // Transitional fallback for in-flight sessions created before backend tracking.
      const snapshot = consumePurchaseSnapshot(orderId);
      if (snapshot) {
        trackConfirmedPurchase(snapshot);
      }
    }
    setPurchaseTracked(true);
  }, [state, purchaseTracked, confirmResult, orderId]);

  const statusVariant =
    state === 'redirecting' ? 'redirecting' : state;

  const statusTitle =
    statusVariant === 'loading' || statusVariant === 'redirecting'
      ? t.title
      : statusVariant === 'success'
        ? t.successTitle
        : statusVariant === 'unknown'
          ? t.unknownTitle
          : t.failedTitle;

  const statusSubtitle =
    statusVariant === 'loading' || statusVariant === 'redirecting'
      ? statusVariant === 'redirecting'
        ? t.redirecting
        : t.pleaseWait
      : statusVariant === 'success'
        ? t.successSubtitle
        : undefined;

  const statusMessage =
    statusVariant === 'success'
      ? t.successMessage
      : statusVariant === 'failed' || statusVariant === 'unknown'
        ? error || (statusVariant === 'unknown' ? t.unknownMessage : t.failedMessage)
        : undefined;

  const buyAgainPath = getPaymentReturnPath();

  return (
    <div className="min-h-screen bg-gradient-dark">
      <OnlinePaymentStatusScreen
        variant={statusVariant}
        title={statusTitle}
        subtitle={statusSubtitle}
        message={statusMessage}
        closeLabel={t.close}
        onClose={() =>
          statusVariant === 'failed' ? navigate(buyAgainPath) : navigate('/events')
        }
        primaryActionLabel={
          statusVariant === 'unknown'
            ? t.contactSupport
            : statusVariant === 'failed'
              ? t.buyAgain
              : t.backToEvents
        }
        onPrimaryAction={() =>
          statusVariant === 'unknown'
            ? navigate('/contact')
            : statusVariant === 'failed'
              ? navigate(buyAgainPath)
              : navigate('/events')
        }
      />
    </div>
  );
}

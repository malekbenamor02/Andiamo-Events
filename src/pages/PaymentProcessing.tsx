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

type PageState =
  | 'loading'
  | 'success'
  | 'success_pending'
  | 'success_email_pending'
  | 'failed'
  | 'redirecting'
  | 'unknown';

export default function PaymentProcessing({ language = 'en' }: PaymentProcessingProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId') || searchParams.get('order_id');
  const isReturn = searchParams.get('return') === '1';
  const isInit = searchParams.get('init') === '1';

  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<{
    success?: boolean;
    paymentConfirmed?: boolean;
    fulfillmentComplete?: boolean;
    orderId?: string;
    status?: string;
    message?: string;
    ticketsGenerated?: boolean;
    ticketsCount?: number;
    emailSent?: boolean;
    emailAttempted?: boolean;
    smsSent?: boolean;
    alreadyPaid?: boolean;
    ticketError?: string | null;
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
    fulfillmentPendingTitle: 'Payment confirmed',
    fulfillmentPendingSubtitle: 'Thank you for your order',
    fulfillmentPendingMessage:
      'Payment received. Your tickets are being generated. If you do not receive them shortly, contact support with your order number.',
    emailPendingTitle: 'Payment confirmed',
    emailPendingSubtitle: 'Thank you for your order',
    emailPendingMessage:
      'Your payment was successful and your tickets are ready. The confirmation email may be delayed — check spam or contact support with your order number if needed.',
    failedTitle: 'Payment failed',
    failedMessage: 'Your payment could not be completed. Please try again or choose another payment method.',
    unknownTitle: 'Payment not confirmed',
    unknownMessage:
      'We could not reach the bank to confirm your payment. If you see a debit on your card, please wait for an email or SMS confirmation, or contact our support.',
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
    fulfillmentPendingTitle: 'Paiement confirmé',
    fulfillmentPendingSubtitle: 'Merci pour votre commande',
    fulfillmentPendingMessage:
      'Paiement reçu. Vos billets sont en cours de génération. Si vous ne les recevez pas sous peu, contactez le support avec votre numéro de commande.',
    emailPendingTitle: 'Paiement confirmé',
    emailPendingSubtitle: 'Merci pour votre commande',
    emailPendingMessage:
      'Votre paiement a réussi et vos billets sont prêts. L\'email de confirmation peut être retardé — vérifiez les spams ou contactez le support avec votre numéro de commande.',
    failedTitle: 'Paiement échoué',
    failedMessage: 'Votre paiement n\'a pas pu être traité. Veuillez réessayer ou choisir un autre mode de paiement.',
    unknownTitle: 'Paiement non confirmé',
    unknownMessage:
      'Nous n\'avons pas pu joindre la banque pour confirmer votre paiement. Si vous voyez un débit sur votre carte, veuillez attendre un email ou un SMS de confirmation, ou contacter notre support.',
    buyAgain: 'Acheter à nouveau',
    goBack: 'Retour',
    contactSupport: 'Contacter le support',
    close: 'Fermer',
    noOrder: 'Requête invalide. Aucun numéro de commande.',
    genericError: 'Une erreur s\'est produite. Veuillez réessayer ou nous contacter.'
  };

  const mapPaymentError = (input: Parameters<typeof mapPublicError>[0]) =>
    mapPublicError(input, language);

  function resolveFulfillmentState(data: NonNullable<typeof confirmResult>): PageState {
    const paid =
      data.alreadyPaid ||
      (data.paymentConfirmed !== false && data.success && data.status === 'PAID');
    if (!paid) return 'failed';

    if (data.fulfillmentComplete === true) return 'success';
    if (data.ticketsGenerated && data.emailAttempted && !data.emailSent) {
      return 'success_email_pending';
    }
    if (!data.ticketsGenerated || data.ticketError) {
      return 'success_pending';
    }
    if (data.fulfillmentComplete === false) return 'success_pending';
    return 'success';
  }

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

        if (data.status === 'UNKNOWN') {
          setState('unknown');
          setError(
            mapPaymentError({
              error: 'payment_unknown',
              message: data.message,
            }).description
          );
        } else if (data.status === 'failed' || (data.success === false && data.status !== 'PAID')) {
          setState('failed');
          setError(
            mapPaymentError({
              error: data.error || 'payment_failed',
              message: data.message || t.failedMessage,
            }).description
          );
        } else if (!res.ok && data.status !== 'PAID') {
          // Server/route errors after bank redirect: payment may already have succeeded.
          const showUnknown =
            res.status === 404 || res.status >= 500 || data.error === 'Failed to load order';
          setState(showUnknown ? 'unknown' : 'failed');
          setError(
            mapPaymentError({
              error: showUnknown ? 'payment_unknown' : data.error,
              message: showUnknown
                ? data.message || t.unknownMessage
                : data.message || t.genericError,
            }).description
          );
        } else {
          setState(resolveFulfillmentState(data));
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
    const paidConfirmed =
      confirmResult?.alreadyPaid ||
      (confirmResult?.paymentConfirmed !== false &&
        confirmResult?.success &&
        confirmResult?.status === 'PAID');
    if (!paidConfirmed || purchaseTracked || !orderId) return;
    if (state !== 'success' && state !== 'success_pending' && state !== 'success_email_pending') {
      return;
    }

    const metaTracking = confirmResult.metaTracking;
    if (metaTracking?.pixel && isValidTicketMetaPixelPayload(metaTracking.pixel)) {
      trackPurchaseFromBackend(metaTracking.pixel);
    } else {
      const snapshot = consumePurchaseSnapshot(orderId);
      if (snapshot) {
        trackConfirmedPurchase(snapshot);
      }
    }
    setPurchaseTracked(true);
  }, [state, purchaseTracked, confirmResult, orderId]);

  const statusVariant =
    state === 'redirecting'
      ? 'redirecting'
      : state === 'success_pending' || state === 'success_email_pending'
        ? 'unknown'
        : state;

  const statusTitle =
    statusVariant === 'loading' || statusVariant === 'redirecting'
      ? t.title
      : state === 'success'
        ? t.successTitle
        : state === 'success_pending'
          ? t.fulfillmentPendingTitle
          : state === 'success_email_pending'
            ? t.emailPendingTitle
            : statusVariant === 'unknown'
              ? t.unknownTitle
              : t.failedTitle;

  const statusSubtitle =
    statusVariant === 'loading' || statusVariant === 'redirecting'
      ? statusVariant === 'redirecting'
        ? t.redirecting
        : t.pleaseWait
      : state === 'success'
        ? t.successSubtitle
        : state === 'success_pending'
          ? t.fulfillmentPendingSubtitle
          : state === 'success_email_pending'
            ? t.emailPendingSubtitle
            : undefined;

  const statusMessage =
    state === 'success'
      ? t.successMessage
      : state === 'success_pending'
        ? t.fulfillmentPendingMessage
        : state === 'success_email_pending'
          ? t.emailPendingMessage
          : statusVariant === 'failed' || statusVariant === 'unknown'
            ? error || (statusVariant === 'unknown' ? t.unknownMessage : t.failedMessage)
            : undefined;

  const buyAgainPath = getPaymentReturnPath();
  const isTerminalOutcome =
    statusVariant === 'success' || statusVariant === 'failed';

  return (
    <div className="min-h-screen bg-gradient-dark">
      <OnlinePaymentStatusScreen
        variant={statusVariant}
        title={statusTitle}
        subtitle={statusSubtitle}
        message={statusMessage}
        closeLabel={t.close}
        onClose={() =>
          isTerminalOutcome ? navigate(buyAgainPath) : navigate('/contact')
        }
        primaryActionLabel={
          statusVariant === 'unknown' || state === 'success_pending' || state === 'success_email_pending'
            ? t.contactSupport
            : t.buyAgain
        }
        onPrimaryAction={() =>
          statusVariant === 'unknown' || state === 'success_pending' || state === 'success_email_pending'
            ? navigate('/contact')
            : navigate(buyAgainPath)
        }
      />
    </div>
  );
}

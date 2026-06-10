/**
 * Payment Processing Page
 * Handles ClicToPay redirect: calls confirm API and shows success/failure
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Loader from '@/components/ui/Loader';
import { CheckCircle, XCircle } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api-routes';
import { mapPublicError, mapThrownError } from '@/lib/userErrors';
import { consumePurchaseSnapshot, trackConfirmedPurchase } from '@/lib/meta';

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
  } | null>(null);
  const [purchaseTracked, setPurchaseTracked] = useState(false);

  const t = language === 'en' ? {
    title: 'Processing payment',
    successTitle: 'Payment successful!',
    successMessage: 'Your payment has been confirmed. Your tickets have been sent to your email.',
    failedTitle: 'Payment failed',
    failedMessage: 'Your payment could not be completed. Please try again or choose another payment method.',
    backToEvents: 'Back to Events',
    noOrder: 'Invalid request. No order ID provided.',
    genericError: 'Something went wrong. Please try again or contact us.'
  } : {
    title: 'Traitement du paiement',
    successTitle: 'Paiement réussi !',
    successMessage: 'Votre paiement a été confirmé. Vos billets ont été envoyés par email.',
    failedTitle: 'Paiement échoué',
    failedMessage: 'Votre paiement n\'a pas pu être traité. Veuillez réessayer ou choisir un autre mode de paiement.',
    backToEvents: 'Retour aux Événements',
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

    const snapshot = consumePurchaseSnapshot(orderId);
    if (snapshot) {
      trackConfirmedPurchase(snapshot);
    }
    setPurchaseTracked(true);
  }, [state, purchaseTracked, confirmResult, orderId]);

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md glass border-2 border-primary/30">
        <CardContent className="p-8">
          {(state === 'loading' || state === 'redirecting') && (
            <div className="text-center">
              <Loader size="xl" className="mx-auto mb-4" />
              <h1 className="text-xl font-heading font-bold text-foreground mb-2">{t.title}</h1>
              <p className="text-muted-foreground">{state === 'redirecting' ? (language === 'en' ? 'Redirecting to payment...' : 'Redirection vers le paiement...') : 'Please wait...'}</p>
            </div>
          )}

          {state === 'unknown' && (
            <div className="text-center">
              <XCircle className="w-24 h-24 text-yellow-500 mx-auto mb-6" />
              <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
                {language === 'en' ? 'We could not confirm your payment' : 'Nous n’avons pas pu confirmer votre paiement'}
              </h1>
              <p className="text-muted-foreground mb-6">
                {error ||
                  (language === 'en'
                    ? 'We could not reach the bank to confirm your payment. If you see a debit on your card, please wait for an email/SMS confirmation or contact our support.'
                    : 'Nous n’avons pas pu joindre la banque pour confirmer votre paiement. Si vous voyez un débit sur votre carte, veuillez attendre un email/SMS de confirmation ou contacter notre support.')}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate(-1)} size="lg">
                  {language === 'en' ? 'Go back' : 'Retour'}
                </Button>
                <Button onClick={() => navigate('/contact')} size="lg">
                  {language === 'en' ? 'Contact support' : 'Contacter le support'}
                </Button>
              </div>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center">
              <div className="relative inline-flex mx-auto mb-6">
                <div
                  className="absolute -inset-6 rounded-full bg-green-500/25 blur-2xl animate-success-check-glow"
                  aria-hidden
                />
                <CheckCircle
                  className="relative z-10 h-24 w-24 text-green-500 drop-shadow-[0_0_14px_rgba(34,197,94,0.45)] animate-success-check"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>
              <h1 className="text-2xl font-heading font-bold text-foreground mb-2">{t.successTitle}</h1>
              <p className="text-muted-foreground mb-6">{t.successMessage}</p>
              <Button onClick={() => navigate('/events')} className="btn-gradient" size="lg">
                {t.backToEvents}
              </Button>
            </div>
          )}

          {state === 'failed' && (
            <div className="text-center">
              <XCircle className="w-24 h-24 text-red-500 mx-auto mb-6" />
              <h1 className="text-2xl font-heading font-bold text-foreground mb-2">{t.failedTitle}</h1>
              <p className="text-muted-foreground mb-6">{error || t.failedMessage}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate(-1)} size="lg">
                  {language === 'en' ? 'Go back' : 'Retour'}
                </Button>
                <Button onClick={() => navigate('/events')} className="btn-gradient" size="lg">
                  {t.backToEvents}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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

interface PaymentProcessingProps {
  language?: 'en' | 'fr';
}

export default function PaymentProcessing({ language = 'en' }: PaymentProcessingProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId') || searchParams.get('order_id');
  const isReturn = searchParams.get('return') === '1';
  const isInit = searchParams.get('init') === '1';

  // Success/failure is determined only by the backend (ClicToPay getOrderStatus). Frontend does not trust URL params.

  const [state, setState] = useState<'loading' | 'success' | 'failed' | 'redirecting'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<{
    success?: boolean;
    orderId?: string;
    ticketsGenerated?: boolean;
    ticketsCount?: number;
    emailSent?: boolean;
    alreadyPaid?: boolean;
  } | null>(null);

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

  useEffect(() => {
    if (!orderId) {
      setState('failed');
      setError(t.noOrder);
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
        setError(data.error || data.message || t.genericError);
      } catch (err: any) {
        setState('failed');
        setError(err?.message || t.genericError);
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
        } else if (data.status === 'failed' || !data.success) {
          setState('failed');
          setError(data.message || t.failedMessage);
        } else if (!res.ok) {
          setState('failed');
          setError(data.error || data.details || t.genericError);
        } else {
          setState('success');
        }
      } catch (err: any) {
        setState('failed');
        setError(err?.message || t.genericError);
      }
    };

    if (isInit) {
      generateAndRedirect();
    } else if (isReturn) {
      confirm();
    } else {
      setState('failed');
      setError(t.genericError);
    }
  }, [orderId, isReturn, isInit]);

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

          {state === 'success' && (
            <div className="text-center">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse" />
                <CheckCircle className="w-24 h-24 text-green-500 mx-auto relative z-10" />
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

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Loader from '@/components/ui/Loader';
import { CheckCircle, XCircle } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { mapPublicError, mapThrownError } from '@/lib/userErrors';
import {
  consumeAcademyPurchaseSnapshot,
  isValidAcademyMetaPixelPayload,
  isValidAcademyPurchasePayload,
  trackAcademyPurchaseFromBackend,
  trackConfirmedPurchase,
} from '@/lib/meta';
import type { AcademyMetaTrackingResponse } from '@/lib/meta';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyPaymentProcessingProps {
  language?: AcademyLanguage;
}

export default function AcademyPaymentProcessing({ language = 'fr' }: AcademyPaymentProcessingProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const registrationId = searchParams.get('registrationId') || '';
  const isReturn = searchParams.get('return') === '1';
  const isInit = searchParams.get('init') === '1';

  const [state, setState] = useState<'loading' | 'success' | 'failed' | 'expired' | 'redirecting'>('loading');
  const [error, setError] = useState<string | null>(null);
  const confirmStartedRef = useRef(false);

  const t =
    language === 'en'
      ? {
          title: 'Processing payment',
          successTitle: 'Payment successful!',
          successMessage:
            'Your payment has been confirmed. You will receive a confirmation email shortly.',
          failedTitle: 'Payment failed',
          failedMessage: 'Your payment could not be completed. Please try again or contact us.',
          expiredTitle: 'Registration expired',
          expiredMessage:
            'Your registration was not completed in time. Please register again to book your place.',
          back: 'Back to Academy',
          noId: 'Invalid request. No registration ID.',
          generic: 'Something went wrong. Please try again.',
        }
      : {
          title: 'Traitement du paiement',
          successTitle: 'Paiement réussi !',
          successMessage:
            'Votre paiement a été confirmé. Vous recevrez un e-mail de confirmation sous peu.',
          failedTitle: 'Paiement échoué',
          failedMessage:
            'Votre paiement n\'a pas pu être traité. Veuillez réessayer ou nous contacter.',
          expiredTitle: 'Inscription expirée',
          expiredMessage:
            'Votre inscription n\'a pas été finalisée à temps. Veuillez vous réinscrire pour réserver votre place.',
          back: 'Retour à l\'Academy',
          noId: 'Requête invalide.',
          generic: 'Une erreur s\'est produite.',
        };

  useEffect(() => {
    if (!registrationId) {
      setState('failed');
      setError(mapPublicError({ error: 'invalid_request', message: t.noId }, language).description);
      return;
    }

    const base = getApiBaseUrl();

    const generateAndRedirect = async () => {
      try {
        const res = await fetch(`${base}${API_ROUTES.ACADEMY_CLICTOPAY_GENERATE}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId, language }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 410 || data.error === 'registration_expired') {
          setState('expired');
          setError(
            mapPublicError({ error: 'registration_expired', message: data.message }, language).description
          );
          return;
        }
        const formUrl = data.formUrl || data.form_url;
        if (formUrl) {
          setState('redirecting');
          window.location.href = formUrl;
          return;
        }
        setState('failed');
        setError(
          mapPublicError({ error: data.error, message: data.message || data.error || t.generic }, language)
            .description
        );
      } catch (err: unknown) {
        setState('failed');
        setError(mapThrownError(err, language).description);
      }
    };

    const confirm = async () => {
      if (confirmStartedRef.current) return;
      confirmStartedRef.current = true;
      try {
        const res = await fetch(`${base}${API_ROUTES.ACADEMY_CLICTOPAY_CONFIRM}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId, language }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.success || data.alreadyPaid) {
          const metaTracking = data.metaTracking as AcademyMetaTrackingResponse | undefined;
          if (metaTracking?.pixel && isValidAcademyMetaPixelPayload(metaTracking.pixel)) {
            trackAcademyPurchaseFromBackend(metaTracking.pixel);
          } else {
            // Transitional fallback for in-flight card sessions created before backend tracking.
            const snapshot = consumeAcademyPurchaseSnapshot(registrationId);
            if (snapshot && isValidAcademyPurchasePayload(snapshot)) {
              trackConfirmedPurchase(snapshot);
            }
          }
          setState('success');
          navigate(
            `/academy/register/confirmation?registrationId=${registrationId}&paid=1`,
            {
              replace: true,
              state: {
                fromSubmission: true,
                registrationNumber:
                  typeof data.registrationNumber === 'string' ? data.registrationNumber : null,
                status: typeof data.status === 'string' ? data.status : 'paid_online',
              },
            }
          );
        } else if (res.status === 410 || data.error === 'registration_expired') {
          setState('expired');
          setError(
            mapPublicError({ error: 'registration_expired', message: data.message }, language).description
          );
        } else {
          setState('failed');
          setError(
            mapPublicError({ error: data.error, message: data.message || t.failedMessage }, language)
              .description
          );
        }
      } catch (err: unknown) {
        setState('failed');
        setError(mapThrownError(err, language).description);
      }
    };

    if (isInit) generateAndRedirect();
    else if (isReturn) confirm();
    else {
      setState('failed');
      setError(mapPublicError({ error: 'invalid_request', message: t.generic }, language).description);
    }
  }, [registrationId, isReturn, isInit, language, navigate]);

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center px-4 py-16">
      <PageMeta
        title={language === 'en' ? 'Payment processing' : 'Traitement du paiement'}
        description={
          language === 'en'
            ? 'Andiamo Academy payment processing.'
            : 'Traitement du paiement Andiamo Academy.'
        }
        path="/academy/payment-processing"
        noIndex
      />
      <Card className="w-full max-w-md glass border-2 border-primary/30">
        <CardContent className="p-8 text-center">
          {(state === 'loading' || state === 'redirecting') && (
            <>
              <Loader size="xl" className="mx-auto mb-4" />
              <h1 className="text-xl font-heading font-bold">{t.title}</h1>
            </>
          )}
          {state === 'success' && (
            <>
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-heading font-bold mb-2">{t.successTitle}</h1>
              <p className="text-muted-foreground mb-6">{t.successMessage}</p>
            </>
          )}
          {(state === 'failed' || state === 'expired') && (
            <>
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-heading font-bold mb-2">
                {state === 'expired' ? t.expiredTitle : t.failedTitle}
              </h1>
              {error && <p className="text-muted-foreground mb-6">{error}</p>}
              <Button onClick={() => navigate('/academy/register')}>{t.back}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

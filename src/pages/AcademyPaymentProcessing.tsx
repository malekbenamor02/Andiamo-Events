import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Loader from '@/components/ui/Loader';
import { CheckCircle, XCircle } from 'lucide-react';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
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

  const [state, setState] = useState<'loading' | 'success' | 'failed' | 'redirecting'>('loading');
  const [error, setError] = useState<string | null>(null);

  const t =
    language === 'en'
      ? {
          title: 'Processing payment',
          successTitle: 'Payment successful!',
          successMessage:
            'Your payment has been confirmed. You will receive a confirmation email shortly.',
          failedTitle: 'Payment failed',
          failedMessage: 'Your payment could not be completed. Please try again or contact us.',
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
          back: 'Retour à l\'Academy',
          noId: 'Requête invalide.',
          generic: 'Une erreur s\'est produite.',
        };

  useEffect(() => {
    if (!registrationId) {
      setState('failed');
      setError(t.noId);
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
        const formUrl = data.formUrl || data.form_url;
        if (formUrl) {
          setState('redirecting');
          window.location.href = formUrl;
          return;
        }
        setState('failed');
        setError(data.error || data.message || t.generic);
      } catch (err: unknown) {
        setState('failed');
        setError(err instanceof Error ? err.message : t.generic);
      }
    };

    const confirm = async () => {
      try {
        const res = await fetch(`${base}${API_ROUTES.ACADEMY_CLICTOPAY_CONFIRM}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId, language }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.success || data.alreadyPaid) {
          setState('success');
          navigate(
            `/academy/register/confirmation?registrationId=${registrationId}&paid=1`,
            { replace: true }
          );
        } else {
          setState('failed');
          setError(data.error || data.message || t.failedMessage);
        }
      } catch (err: unknown) {
        setState('failed');
        setError(err instanceof Error ? err.message : t.generic);
      }
    };

    if (isInit) generateAndRedirect();
    else if (isReturn) confirm();
    else {
      setState('failed');
      setError(t.generic);
    }
  }, [registrationId, isReturn, isInit, language, navigate, t]);

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center px-4 py-16">
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
          {state === 'failed' && (
            <>
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-heading font-bold mb-6">{t.failedTitle}</h1>
              <Button onClick={() => navigate('/academy/register')}>{t.back}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

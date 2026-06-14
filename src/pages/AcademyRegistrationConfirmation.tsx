import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageMeta } from '@/components/PageMeta';
import LoadingScreen from '@/components/ui/LoadingScreen';
import NotFound from '@/pages/NotFound';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { ACADEMY_REGISTER_PATH, isAcademyRegistrationId } from '@/lib/academy/academyUtils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyRegistrationConfirmationProps {
  language: AcademyLanguage;
}

type ConfirmationState = 'loading' | 'ready' | 'missing';

export default function AcademyRegistrationConfirmation({
  language,
}: AcademyRegistrationConfirmationProps) {
  const [searchParams] = useSearchParams();
  const rawRegistrationId = searchParams.get('registrationId');
  const registrationId = rawRegistrationId?.trim() ?? '';
  const [pageState, setPageState] = useState<ConfirmationState>(() =>
    isAcademyRegistrationId(registrationId) ? 'loading' : 'missing'
  );
  const [status, setStatus] = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!isAcademyRegistrationId(registrationId)) {
      setPageState('missing');
      return;
    }

    let cancelled = false;
    setPageState('loading');

    fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_REGISTRATION_STATUS(registrationId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 404 || !res.ok) {
          setPageState('missing');
          return;
        }

        setStatus(typeof data.status === 'string' ? data.status : null);
        setRegistrationNumber(
          typeof data.registrationNumber === 'string' ? data.registrationNumber : null
        );
        setPageState('ready');
      })
      .catch(() => {
        if (!cancelled) setPageState('missing');
      });

    return () => {
      cancelled = true;
    };
  }, [registrationId]);

  const isEn = language === 'en';
  const isOnlineSuccess = status === 'paid_online' || status === 'approved';

  if (pageState === 'loading') {
    return <LoadingScreen />;
  }

  if (pageState === 'missing') {
    return <NotFound />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <PageMeta
        title={isEn ? 'Registration confirmation' : 'Confirmation d\'inscription'}
        description={
          isEn
            ? 'Andiamo Academy registration confirmation.'
            : 'Confirmation d\'inscription Andiamo Academy.'
        }
        path="/academy/register/confirmation"
        noIndex
      />
      {isOnlineSuccess ? (
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
      ) : (
        <Clock className="w-16 h-16 text-primary mx-auto mb-6" />
      )}
      <h1 className="text-2xl font-heading font-bold mb-4">
        {isEn ? 'Registration received' : 'Inscription enregistrée'}
      </h1>
      {registrationNumber && (
        <p className="text-sm text-muted-foreground mb-4">
          {isEn ? 'Reference' : 'Référence'}: <strong>{registrationNumber}</strong>
        </p>
      )}
      <p className="text-muted-foreground mb-8 leading-relaxed">
        {isOnlineSuccess
          ? isEn
            ? 'Thank you! Your online payment was confirmed. We will email you with next steps.'
            : 'Merci ! Votre paiement en ligne a été confirmé. Nous vous enverrons les prochaines étapes par e-mail.'
          : isEn
            ? 'We received your registration. Our team will validate your payment as soon as possible and contact you by email.'
            : 'Nous avons bien reçu votre inscription. Notre équipe validera votre paiement dans les plus brefs délais et vous contactera par e-mail.'}
      </p>
      <Button asChild variant="outline">
        <Link to={ACADEMY_REGISTER_PATH}>{isEn ? 'Back to Academy' : 'Retour à l\'Academy'}</Link>
      </Button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageMeta } from '@/components/PageMeta';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { ACADEMY_REGISTER_PATH } from '@/lib/academy/academyUtils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyRegistrationConfirmationProps {
  language: AcademyLanguage;
}

export default function AcademyRegistrationConfirmation({
  language,
}: AcademyRegistrationConfirmationProps) {
  const [searchParams] = useSearchParams();
  const registrationId = searchParams.get('registrationId') || '';
  const paid = searchParams.get('paid') === '1';
  const [loading, setLoading] = useState(!!registrationId);
  const [status, setStatus] = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!registrationId) {
      setLoading(false);
      return;
    }
    fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_REGISTRATION_STATUS(registrationId)}`)
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.status || null);
        setRegistrationNumber(data.registrationNumber || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [registrationId]);

  const isEn = language === 'en';
  const isOnlineSuccess = paid || status === 'paid_online' || status === 'approved';

  if (loading) {
    return <LoadingScreen />;
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

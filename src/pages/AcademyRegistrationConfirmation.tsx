import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AcademyRegistrationSuccessScreen } from '@/components/academy/AcademyRegistrationSuccessScreen';
import { PageMeta } from '@/components/PageMeta';
import LoadingScreen from '@/components/ui/LoadingScreen';
import NotFound from '@/pages/NotFound';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import {
  ACADEMY_REGISTER_PATH,
  isAcademyRegistrationId,
  type AcademyRegistrationConfirmationLocationState,
} from '@/lib/academy/academyUtils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyRegistrationConfirmationProps {
  language: AcademyLanguage;
}

type ConfirmationState = 'loading' | 'ready' | 'missing';

function resolveInitialConfirmation(
  registrationId: string,
  navState: AcademyRegistrationConfirmationLocationState | null,
  paidFromQuery: boolean
): {
  pageState: ConfirmationState;
  status: string | null;
  registrationNumber: string | null;
} {
  if (!isAcademyRegistrationId(registrationId)) {
    return { pageState: 'missing', status: null, registrationNumber: null };
  }

  const hasNavData =
    navState?.fromSubmission === true ||
    typeof navState?.registrationNumber === 'string' ||
    typeof navState?.status === 'string';

  if (hasNavData || paidFromQuery) {
    return {
      pageState: 'ready',
      status: paidFromQuery
        ? navState?.status ?? 'paid_online'
        : navState?.status ?? null,
      registrationNumber: navState?.registrationNumber ?? null,
    };
  }

  return { pageState: 'loading', status: null, registrationNumber: null };
}

export default function AcademyRegistrationConfirmation({
  language,
}: AcademyRegistrationConfirmationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rawRegistrationId = searchParams.get('registrationId');
  const registrationId = rawRegistrationId?.trim() ?? '';
  const paidFromQuery = searchParams.get('paid') === '1';
  const navState = (location.state as AcademyRegistrationConfirmationLocationState | null) ?? null;

  const [initial] = useState(() =>
    resolveInitialConfirmation(registrationId, navState, paidFromQuery)
  );
  const [pageState, setPageState] = useState<ConfirmationState>(initial.pageState);
  const [status, setStatus] = useState<string | null>(initial.status);
  const [registrationNumber, setRegistrationNumber] = useState<string | null>(
    initial.registrationNumber
  );

  useEffect(() => {
    if (!isAcademyRegistrationId(registrationId)) {
      setPageState('missing');
      return;
    }

    let cancelled = false;

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

  const message = isOnlineSuccess
    ? isEn
      ? 'Thank you! Your online payment was confirmed. We will email you with next steps.'
      : 'Merci ! Votre paiement en ligne a été confirmé. Nous vous enverrons les prochaines étapes par e-mail.'
    : isEn
      ? 'We received your registration. Our team will validate your payment as soon as possible and contact you by email.'
      : 'Nous avons bien reçu votre inscription. Notre équipe validera votre paiement dans les plus brefs délais et vous contactera par e-mail.';

  return (
    <>
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
      <AcademyRegistrationSuccessScreen
        registrationNumber={registrationNumber}
        message={message}
        isOnlineSuccess={isOnlineSuccess}
        onBackToAcademy={() => navigate(ACADEMY_REGISTER_PATH)}
        language={language}
      />
    </>
  );
}

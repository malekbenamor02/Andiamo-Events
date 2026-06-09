import { useQuery } from '@tanstack/react-query';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import type { AcademyLanguage } from '@/types/academy';

const DEFAULT_DISABLED_EN =
  'Academy registrations are temporarily closed. Please check back soon.';
const DEFAULT_DISABLED_FR =
  "Les inscriptions à l'Academy sont temporairement fermées. Veuillez réessayer bientôt.";
const DEFAULT_SOLD_OUT_EN = 'Academy registrations are sold out.';
const DEFAULT_SOLD_OUT_FR = "Les inscriptions à l'Academy sont complètes.";

interface AcademyStatusData {
  registrationsOpen: boolean;
  soldOut: boolean;
  messageEn: string;
  messageFr: string;
  onlinePaymentFeeRate: number;
}

const PRERENDER_STATUS: AcademyStatusData = {
  registrationsOpen: true,
  soldOut: false,
  messageEn: '',
  messageFr: '',
  onlinePaymentFeeRate: 0.05,
};

async function fetchAcademyPublicStatus(): Promise<AcademyStatusData> {
  const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_STATUS}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      registrationsOpen: true,
      soldOut: false,
      messageEn: '',
      messageFr: '',
      onlinePaymentFeeRate: 0.05,
    };
  }

  const open =
    data.registrationsOpen !== undefined
      ? data.registrationsOpen !== false
      : data.enabled !== false;
  const isSoldOut = data.soldOut === true;

  return {
    registrationsOpen: open,
    soldOut: isSoldOut,
    messageEn: data.messageEn || data.message_en || '',
    messageFr: data.messageFr || data.message_fr || '',
    onlinePaymentFeeRate:
      typeof data.onlinePaymentFeeRate === 'number' && Number.isFinite(data.onlinePaymentFeeRate)
        ? data.onlinePaymentFeeRate
        : 0.05,
  };
}

function resolveMessage(
  status: AcademyStatusData,
  language: AcademyLanguage
): string {
  if (status.registrationsOpen) return '';

  const msg = language === 'en' ? status.messageEn : status.messageFr;
  if (msg) return msg;

  if (status.soldOut) {
    return language === 'en' ? DEFAULT_SOLD_OUT_EN : DEFAULT_SOLD_OUT_FR;
  }
  return language === 'en' ? DEFAULT_DISABLED_EN : DEFAULT_DISABLED_FR;
}

export function useAcademyPublicStatus(language: AcademyLanguage) {
  const isPrerender = import.meta.env.VITE_PRERENDER === 'true';

  const { data, isLoading } = useQuery({
    queryKey: ['academy', 'public-status'],
    queryFn: fetchAcademyPublicStatus,
    staleTime: 5 * 60 * 1000,
    enabled: !isPrerender,
    initialData: isPrerender ? PRERENDER_STATUS : undefined,
  });

  const status = data ?? PRERENDER_STATUS;

  return {
    loading: isLoading && !isPrerender,
    /** @deprecated use registrationsOpen */
    enabled: status.registrationsOpen,
    registrationsOpen: status.registrationsOpen,
    soldOut: status.soldOut,
    message: resolveMessage(status, language),
    onlinePaymentFeeRate: status.onlinePaymentFeeRate,
  };
}

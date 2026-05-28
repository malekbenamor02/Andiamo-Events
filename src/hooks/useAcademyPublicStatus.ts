import { useEffect, useState } from 'react';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import type { AcademyLanguage } from '@/types/academy';

const DEFAULT_DISABLED_EN =
  'Academy registrations are temporarily closed. Please check back soon.';
const DEFAULT_DISABLED_FR =
  "Les inscriptions à l'Academy sont temporairement fermées. Veuillez réessayer bientôt.";
const DEFAULT_SOLD_OUT_EN = 'Academy registrations are sold out.';
const DEFAULT_SOLD_OUT_FR = "Les inscriptions à l'Academy sont complètes.";

export function useAcademyPublicStatus(language: AcademyLanguage) {
  const [loading, setLoading] = useState(true);
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [soldOut, setSoldOut] = useState(false);
  const [message, setMessage] = useState('');
  const [onlinePaymentFeeRate, setOnlinePaymentFeeRate] = useState(0.05);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_STATUS}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setRegistrationsOpen(true);
          setLoading(false);
          return;
        }

        const open =
          data.registrationsOpen !== undefined
            ? data.registrationsOpen !== false
            : data.enabled !== false;
        const isSoldOut = data.soldOut === true;
        setRegistrationsOpen(open);
        setSoldOut(isSoldOut);
        setOnlinePaymentFeeRate(
          typeof data.onlinePaymentFeeRate === 'number' && Number.isFinite(data.onlinePaymentFeeRate)
            ? data.onlinePaymentFeeRate
            : 0.05
        );

        const msg =
          language === 'en'
            ? data.messageEn || data.message_en
            : data.messageFr || data.message_fr;

        if (!open) {
          if (isSoldOut) {
            setMessage(
              msg ||
                (language === 'en' ? DEFAULT_SOLD_OUT_EN : DEFAULT_SOLD_OUT_FR)
            );
          } else {
            setMessage(
              msg ||
                (language === 'en' ? DEFAULT_DISABLED_EN : DEFAULT_DISABLED_FR)
            );
          }
        } else {
          setMessage('');
        }
      } catch {
        if (!cancelled) setRegistrationsOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return {
    loading,
    /** @deprecated use registrationsOpen */
    enabled: registrationsOpen,
    registrationsOpen,
    soldOut,
    message,
    onlinePaymentFeeRate,
  };
}

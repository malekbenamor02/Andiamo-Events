import { useEffect, useState } from 'react';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import type { AcademyLanguage } from '@/types/academy';

export function useAcademyPublicStatus(language: AcademyLanguage) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_STATUS}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setEnabled(true);
          setLoading(false);
          return;
        }
        setEnabled(data.enabled !== false);
        const msg =
          language === 'en'
            ? data.messageEn || data.message_en
            : data.messageFr || data.message_fr;
        setMessage(
          msg ||
            (language === 'en'
              ? 'Academy registrations are temporarily closed. Please check back soon.'
              : 'Les inscriptions à l\'Academy sont temporairement fermées. Veuillez réessayer bientôt.')
        );
      } catch {
        if (!cancelled) setEnabled(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return { loading, enabled, message };
}

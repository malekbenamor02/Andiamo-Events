import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';

interface ProtectedInfluencerRouteProps {
  children: React.ReactNode;
  language: 'en' | 'fr';
  requirePasswordChanged?: boolean;
}

export default function ProtectedInfluencerRoute({
  children,
  language,
  requirePasswordChanged = true,
}: ProtectedInfluencerRouteProps) {
  const location = useLocation();
  const [state, setState] = useState<'loading' | 'auth' | 'change' | 'ok'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_INFLUENCER_SESSION}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.profile) {
          setState('auth');
          return;
        }
        if (requirePasswordChanged && data.must_change_password) {
          setState('change');
          return;
        }
        setState('ok');
      } catch {
        if (!cancelled) setState('auth');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, requirePasswordChanged]);

  if (state === 'loading') {
    return (
      <LoadingScreen
        size="fullscreen"
        text={language === 'en' ? 'Verifying session…' : 'Vérification de la session…'}
      />
    );
  }

  if (state === 'auth') {
    return <Navigate to="/influencer/auth" replace />;
  }

  if (state === 'change') {
    return <Navigate to="/influencer/change-password" replace />;
  }

  return <>{children}</>;
}

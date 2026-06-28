import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';

interface ProtectedScannerRouteProps {
  children: React.ReactNode;
  language: 'en' | 'fr';
}

const ProtectedScannerRoute = ({ children, language }: ProtectedScannerRouteProps) => {
  const [state, setState] = useState<'loading' | 'auth' | 'guest'>('loading');
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_SESSION}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.ok && data?.scanner) {
          setState('auth');
          return;
        }
        setState('guest');
      } catch {
        if (!cancelled) setState('guest');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (state === 'loading') {
    return (
      <LoadingScreen
        size="fullscreen"
        text={language === 'en' ? 'Verifying scanner session…' : 'Vérification de la session scan…'}
      />
    );
  }

  if (state === 'guest') {
    return <Navigate to="/scanner/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedScannerRoute;

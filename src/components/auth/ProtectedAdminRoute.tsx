import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingScreen from '@/components/ui/LoadingScreen';
import { API_ROUTES } from '@/lib/api-routes';
import { getApiBaseUrl } from '@/lib/api-routes';
const MOBILE_SESSION_KEY = 'mobileAdminSession';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
  language: 'en' | 'fr';
}

const ProtectedAdminRoute = ({ children, language }: ProtectedAdminRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(MOBILE_SESSION_KEY)) {
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    const fromLogin = (location.state as { fromLogin?: boolean })?.fromLogin === true;

    if (fromLogin) {
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    const base = getApiBaseUrl();
    const verifyUrl = base ? `${base}${API_ROUTES.VERIFY_ADMIN}` : API_ROUTES.VERIFY_ADMIN;

    fetch(verifyUrl, { method: 'GET', credentials: 'include' })
      .then((res) => {
        if (cancelled.current) return;
        if (res.ok) return res.json().catch(() => ({}));
        return null;
      })
      .then((data) => {
        if (cancelled.current) return;
        if (data?.valid) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        if (!cancelled.current) setIsAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled.current) setLoading(false);
      });

    return () => { cancelled.current = true; };
  }, [location.state]);

  if (loading) {
    return (
      <LoadingScreen
        size="fullscreen"
        text={language === 'fr' ? 'Vérification...' : 'Verifying...'}
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;

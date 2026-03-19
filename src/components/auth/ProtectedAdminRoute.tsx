import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingScreen from '@/components/ui/LoadingScreen';
import { API_ROUTES } from '@/lib/api-routes';
import { getApiBaseUrl } from '@/lib/api-routes';
import { useIsMobile } from "@/hooks/use-mobile";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
  language: 'en' | 'fr';
}

const ProtectedAdminRoute = ({ children, language }: ProtectedAdminRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const cancelled = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    cancelled.current = false;

    const fromLogin = (location.state as { fromLogin?: boolean })?.fromLogin === true;

    if (fromLogin) {
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    const base = getApiBaseUrl();
    const verifyUrl = base ? `${base}${API_ROUTES.VERIFY_ADMIN}` : API_ROUTES.VERIFY_ADMIN;

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Best-effort parse even when res.ok === false, so we can read `{ reason }`
    const attemptVerify = async (): Promise<{ valid?: boolean; reason?: string } | null> => {
      try {
        const res = await fetch(verifyUrl, { method: 'GET', credentials: 'include' });
        if (cancelled.current) return null;

        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          return body as { valid?: boolean; reason?: string };
        }

        // Still return parsed body so we can decide whether to retry
        return body as { valid?: boolean; reason?: string };
      } catch {
        return null;
      }
    };

    const verifyWithMobileRetry = async () => {
      try {
        const data1 = await attemptVerify();
        if (cancelled.current) return;

        if (data1?.valid) {
          setIsAuthenticated(true);
          return;
        }

        // If cookie/token isn't available yet, wait and retry a few times on mobile.
        const reason = (data1?.reason || "").toLowerCase();
        const shouldRetryNoToken =
          isMobile &&
          (reason.includes("no token provided") || reason.includes("no token") || reason.includes("not authenticated"));

        if (shouldRetryNoToken) {
          // Total warm-up window ~3s (immediate + a couple retries).
          const retryDelays = [900, 1200];
          for (const ms of retryDelays) {
            await delay(ms);
            const data = await attemptVerify();
            if (cancelled.current) return;
            if (data?.valid) {
              setIsAuthenticated(true);
              return;
            }
          }
        }

        setIsAuthenticated(false);
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    };

    verifyWithMobileRetry();

    return () => { cancelled.current = true; };
  }, [location.state, isMobile]);

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

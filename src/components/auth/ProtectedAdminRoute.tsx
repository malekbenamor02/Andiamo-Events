import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingScreen from '@/components/ui/LoadingScreen';
import { API_ROUTES } from '@/lib/api-routes';
import { getApiBaseUrl } from '@/lib/api-routes';
import { useIsMobile } from "@/hooks/use-mobile";
import { ADMIN_SESSION_PENDING_KEY, writeAdminVerifyCache } from "@/lib/admin-verify-cache";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
  language: 'en' | 'fr';
  /** Allow access while forced password reset is pending (change-password page only). */
  allowPasswordChangeRequired?: boolean;
}

const clearAdminSessionPending = () => {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_PENDING_KEY);
  } catch {
    /* ignore */
  }
};

const ProtectedAdminRoute = ({
  children,
  language,
  allowPasswordChangeRequired = false,
}: ProtectedAdminRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [loading, setLoading] = useState(true);
  const cancelled = useRef(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  useEffect(() => {
    cancelled.current = false;

    const base = getApiBaseUrl();
    const verifyUrl = base ? `${base}${API_ROUTES.VERIFY_ADMIN}` : API_ROUTES.VERIFY_ADMIN;

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const attemptVerify = async (): Promise<Record<string, unknown> | null> => {
      try {
        const res = await fetch(verifyUrl, { method: 'GET', credentials: 'include' });
        if (cancelled.current) return null;

        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        return { ...body, _httpOk: res.ok };
      } catch {
        return null;
      }
    };

    const verifyWithRetries = async () => {
      let pending = false;
      try {
        pending = sessionStorage.getItem(ADMIN_SESSION_PENDING_KEY) === '1';
      } catch {
        pending = false;
      }

      const postLoginSchedule = [0, 120, 250, 500, 1000, 2000];
      const schedule = pending ? postLoginSchedule : [0];

      let lastData: Record<string, unknown> | null = null;

      try {
        let prev = 0;
        for (const targetMs of schedule) {
          const wait = targetMs - prev;
          prev = targetMs;
          if (wait > 0) await delay(wait);
          if (cancelled.current) return;

          const data = await attemptVerify();
          if (cancelled.current) return;
          lastData = data;

          if (data?.valid) {
            const admin = data.admin as
              | { id: string; email: string; name: string; role: string }
              | undefined;
            const mustChange = !!data.requiresPasswordChange;
            if (admin?.id) {
              writeAdminVerifyCache({
                admin,
                permissions: Array.isArray(data.permissions) ? data.permissions : undefined,
                allowedTabs: Array.isArray(data.allowedTabs) ? data.allowedTabs : undefined,
                mobileTabs: Array.isArray(data.mobileTabs) ? data.mobileTabs : undefined,
                sessionExpiresAt: data.sessionExpiresAt as number | undefined,
                sessionTimeRemaining: data.sessionTimeRemaining as number | null | undefined,
                requiresPasswordChange: mustChange,
              });
            }
            setRequiresPasswordChange(mustChange);
            setIsAuthenticated(true);
            clearAdminSessionPending();
            return;
          }
        }

        if (pending) {
          clearAdminSessionPending();
        }

        const reason = String(lastData?.reason || "").toLowerCase();
        const shouldRetryNoToken =
          isMobile &&
          (reason.includes("no token provided") || reason.includes("no token") || reason.includes("not authenticated"));

        if (shouldRetryNoToken) {
          const retryDelays = [900, 1200];
          for (const ms of retryDelays) {
            await delay(ms);
            const data = await attemptVerify();
            if (cancelled.current) return;
            if (data?.valid) {
              const admin = data.admin as
                | { id: string; email: string; name: string; role: string }
                | undefined;
              const mustChange = !!data.requiresPasswordChange;
              if (admin?.id) {
                writeAdminVerifyCache({
                  admin,
                  permissions: Array.isArray(data.permissions) ? data.permissions : undefined,
                  allowedTabs: Array.isArray(data.allowedTabs) ? data.allowedTabs : undefined,
                  sessionExpiresAt: data.sessionExpiresAt as number | undefined,
                  sessionTimeRemaining: data.sessionTimeRemaining as number | null | undefined,
                  requiresPasswordChange: mustChange,
                });
              }
              setRequiresPasswordChange(mustChange);
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

    verifyWithRetries();

    return () => { cancelled.current = true; };
  }, [isMobile]);

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

  if (requiresPasswordChange && !allowPasswordChangeRequired) {
    return <Navigate to="/admin/change-password" replace state={{ from: location.pathname }} />;
  }

  if (!requiresPasswordChange && allowPasswordChangeRequired) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;

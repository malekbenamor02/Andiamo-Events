import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from '@/components/ui/LoadingScreen';
import { apiFetch } from '@/lib/api-client';
import { API_ROUTES } from '@/lib/api-routes';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
  language: 'en' | 'fr';
}

const ProtectedAdminRoute = ({ children, language }: ProtectedAdminRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Since the cookie is httpOnly, we can't read it directly
        // Just make the API call and let the server handle the cookie
        // Use apiFetch to automatically handle 401 errors
        const response = await apiFetch(API_ROUTES.VERIFY_ADMIN, {
          method: 'GET',
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.valid) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        } else {
          // If 401, apiFetch already handled redirect, just set auth to false
          setIsAuthenticated(false);
        }
      } catch (error) {
        // Network errors are fine to catch here
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    // Add a small delay to ensure cookies are set
    const timer = setTimeout(checkAuth, 100);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <LoadingScreen 
        variant="default" 
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
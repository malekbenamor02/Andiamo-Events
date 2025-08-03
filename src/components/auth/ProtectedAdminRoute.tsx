import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
        console.log('Checking authentication...');
        
        // Since the cookie is httpOnly, we can't read it directly
        // Just make the API call and let the server handle the cookie
        console.log('Verifying token with server...');
        const response = await fetch('/api/verify-admin', {
          method: 'GET',
          credentials: 'include', // Include cookies
        });

        console.log('Verify response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Verify response data:', data);
          
          if (data.valid) {
            console.log('Authentication successful');
            setIsAuthenticated(true);
          } else {
            console.log('Authentication failed - invalid token');
            setIsAuthenticated(false);
          }
        } else {
          console.log('Authentication failed - server error');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>{language === 'fr' ? 'Vérification...' : 'Verifying...'}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/admin/login" replace />;
  }

  console.log('Authenticated, rendering dashboard');
  return <>{children}</>;
};

export default ProtectedAdminRoute; 
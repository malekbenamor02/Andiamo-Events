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
        // Check if admin session exists in localStorage
        const adminSession = localStorage.getItem('adminSession');
        
        if (!adminSession) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        const sessionData = JSON.parse(adminSession);
        
        // Verify admin exists in database
        const { data: adminData, error } = await supabase
          .from('admins')
          .select('id, email, name, is_active')
          .eq('id', sessionData.id)
          .eq('email', sessionData.email)
          .eq('is_active', true)
          .single();

        if (error || !adminData) {
          // Clear invalid session
          localStorage.removeItem('adminSession');
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('adminSession');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
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
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute; 
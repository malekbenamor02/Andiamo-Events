import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, RefreshCw } from "lucide-react";

interface MaintenanceModeProps {
  children: React.ReactNode;
  language: 'en' | 'fr';
}

const MaintenanceMode = ({ children, language }: MaintenanceModeProps) => {
  const location = useLocation();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('content')
          .eq('key', 'maintenance_settings')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching maintenance settings:', error);
          setIsMaintenanceMode(false);
          setLoading(false);
          return;
        }

        if (data && data.content) {
          const settings = data.content as { enabled?: boolean; message?: string };
          setIsMaintenanceMode(settings.enabled === true);
          setMaintenanceMessage(
            settings.message || 
            (language === 'en' 
              ? 'We are currently performing maintenance. Please check back soon.' 
              : 'Nous effectuons actuellement une maintenance. Veuillez réessayer bientôt.')
          );
        } else {
          setIsMaintenanceMode(false);
          setMaintenanceMessage(
            language === 'en' 
              ? 'We are currently performing maintenance. Please check back soon.' 
              : 'Nous effectuons actuellement une maintenance. Veuillez réessayer bientôt.'
          );
        }
      } catch (error) {
        console.error('Error checking maintenance mode:', error);
        setIsMaintenanceMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenanceMode();

    // Set up real-time subscription to listen for changes
    const channel = supabase
      .channel('maintenance-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_content',
          filter: 'key=eq.maintenance_settings'
        },
        () => {
          checkMaintenanceMode();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [language, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">
            {language === 'en' ? 'Loading...' : 'Chargement...'}
          </p>
        </div>
      </div>
    );
  }

  // Check if current path is admin route - allow admin access during maintenance
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isMaintenanceMode && !isAdminRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 rounded-full blur-2xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-purple-600 to-blue-600 p-8 rounded-full shadow-2xl">
                <Wrench className="w-16 h-16 text-white animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              {language === 'en' ? 'Under Maintenance' : 'En Maintenance'}
            </h1>
            <p className="text-xl md:text-2xl text-purple-200">
              {maintenanceMessage}
            </p>
          </div>

          <div className="pt-8">
            <div className="inline-flex items-center gap-2 text-purple-300">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm">
                {language === 'en' 
                  ? 'We\'ll be back soon!' 
                  : 'Nous serons de retour bientôt!'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MaintenanceMode;


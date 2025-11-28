import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, RefreshCw } from "lucide-react";
import LoadingScreen from '@/components/ui/LoadingScreen';

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
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={language === 'en' ? 'Loading...' : 'Chargement...'}
      />
    );
  }

  // Check if current path is admin route - allow admin access during maintenance
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isMaintenanceMode && !isAdminRoute) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background gradient matching site theme */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background opacity-100"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 opacity-50"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-accent/15 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
          <div className="flex justify-center">
            <div className="relative">
              {/* Outer glow effect */}
              <div className="absolute inset-0 bg-primary rounded-full blur-2xl opacity-40 animate-pulse"></div>
              <div className="absolute inset-0 bg-secondary rounded-full blur-xl opacity-30 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              
              {/* Icon container with gradient */}
              <div className="relative bg-gradient-to-br from-primary via-secondary to-accent p-8 rounded-full shadow-2xl" style={{
                boxShadow: '0 0 40px hsl(var(--primary) / 0.5), 0 0 80px hsl(var(--secondary) / 0.3)'
              }}>
                <Wrench className="w-16 h-16 text-white animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              {language === 'en' ? 'Under Maintenance' : 'En Maintenance'}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              {maintenanceMessage}
            </p>
          </div>

          <div className="pt-8">
            <div className="inline-flex items-center gap-2 text-primary">
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


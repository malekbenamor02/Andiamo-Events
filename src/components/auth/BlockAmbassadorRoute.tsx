/**
 * BlockAmbassadorRoute Component
 * 
 * SECURITY: Blocks ambassadors from accessing order creation pages.
 * Ambassadors should ONLY receive orders from clients, not create them.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useToast } from '@/hooks/use-toast';

interface BlockAmbassadorRouteProps {
  children: React.ReactNode;
  language: 'en' | 'fr';
}

const BlockAmbassadorRoute = ({ children, language }: BlockAmbassadorRouteProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [isAmbassador, setIsAmbassador] = useState(false);

  useEffect(() => {
    const checkAmbassador = () => {
      try {
        const session = localStorage.getItem('ambassadorSession');
        
        if (session) {
          // Ambassador is logged in - block access
          setIsAmbassador(true);
          toast({
            title: language === 'en' ? 'Access Denied' : 'Accès Refusé',
            description: language === 'en' 
              ? 'Ambassadors cannot create orders. You can only receive orders from clients.' 
              : 'Les ambassadeurs ne peuvent pas créer de commandes. Vous ne pouvez recevoir que des commandes de clients.',
            variant: "destructive",
          });
          
          // Redirect to ambassador dashboard
          navigate('/ambassador/dashboard', { replace: true });
        } else {
          // Not an ambassador - allow access
          setIsAmbassador(false);
        }
      } catch (error) {
        console.error('Error checking ambassador session:', error);
        // On error, allow access (fail open for customers)
        setIsAmbassador(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAmbassador();
  }, [navigate, toast, language]);

  if (isChecking) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={language === 'en' ? 'Checking access...' : 'Vérification de l\'accès...'}
      />
    );
  }

  // If ambassador, don't render children (redirect will happen)
  if (isAmbassador) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={language === 'en' ? 'Redirecting...' : 'Redirection...'}
      />
    );
  }

  // Not an ambassador - allow access
  return <>{children}</>;
};

export default BlockAmbassadorRoute;

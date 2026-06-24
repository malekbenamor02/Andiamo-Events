import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';

const ProtectedAmbassadorRoute = ({ children, language }) => {
  const navigate = useNavigate();
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.AMBASSADOR_ME}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok || !data?.ambassador) {
          navigate('/ambassador/auth');
          return;
        }

        setIsAuth(true);
      } catch {
        if (!cancelled) {
          navigate('/ambassador/auth');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!isAuth) {
    return (
      <LoadingScreen 
        size="fullscreen" 
        text={language === 'en' ? 'Redirecting to login...' : 'Redirection vers la connexion...'}
      />
    );
  }

  return children;
};

export default ProtectedAmbassadorRoute;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '@/components/ui/LoadingScreen';

const ProtectedAmbassadorRoute = ({ children, language }) => {
  const navigate = useNavigate();
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('ambassadorSession');
    if (!session) {
      navigate('/ambassador/auth');
    } else {
      setIsAuth(true);
    }
  }, [navigate]);

  if (!isAuth) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={language === 'en' ? 'Redirecting to login...' : 'Redirection vers la connexion...'}
      />
    );
  }

  return children;
};

export default ProtectedAmbassadorRoute; 
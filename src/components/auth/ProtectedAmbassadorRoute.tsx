import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
      <div className="pt-16 min-h-screen bg-background flex items-center justify-center">
        <p>
          {language === 'en' ? 'Redirecting to login...' : 'Redirection vers la connexion...'}
        </p>
      </div>
    );
  }

  return children;
};

export default ProtectedAmbassadorRoute; 
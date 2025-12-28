import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, Lock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_ROUTES } from '@/lib/api-routes';
import { safeApiCall } from '@/lib/api-client';

interface AuthProps {
  language: 'en' | 'fr';
}

interface Ambassador {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  city: string;
  password: string;
  status: string;
  commission_rate: number;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

const Auth = ({ language }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Get reCAPTCHA site key from environment
  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  
  useEffect(() => {
    // Skip loading reCAPTCHA on localhost
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '0.0.0.0' ||
                       window.location.hostname.includes('localhost');
    
    if (isLocalhost) {
      console.log('⚠️  Skipping reCAPTCHA script load on localhost');
      return;
    }

    if (!RECAPTCHA_SITE_KEY) {
      console.error('VITE_RECAPTCHA_SITE_KEY is not set in environment variables');
      return;
    }

    // Only inject script once
    if (window.grecaptcha) {
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [RECAPTCHA_SITE_KEY]);

  const executeRecaptcha = async (): Promise<string | null> => {
    // Check if we're on localhost - automatically bypass for localhost
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '0.0.0.0' ||
                       window.location.hostname.includes('localhost');
    
    if (isLocalhost) {
      // Return a dummy token for localhost development
      console.log('⚠️  reCAPTCHA bypassed for localhost development');
      return 'localhost-bypass-token';
    }
    
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) {
      return null;
    }

    try {
      // Wait for grecaptcha to finish loading before executing
      if (window.grecaptcha.ready) {
        await new Promise<void>((resolve) => {
          window.grecaptcha.ready(() => resolve());
        });
      }

      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'ambassador_auth' });
      return token;
    } catch (error) {
      console.error('reCAPTCHA execution error:', error);
      return null;
    }
  };

  // Form states
  const [loginData, setLoginData] = useState({
    phone: '',
    password: ''
  });

  const content = {
    en: {
      login: {
        title: "Ambassador Login",
        subtitle: "Access your dashboard",
        phone: "Phone Number",
        password: "Password",
        submit: "Login",
        loading: "Logging in...",
        success: "Login successful!",
        error: "Invalid credentials",
        pending: "Your application is under review",
        rejected: "Your application was not approved"
      },
      register: {
        title: "Ambassador Registration",
        subtitle: "Join our ambassador program",
        fullName: "Full Name",
        phone: "Phone Number",
        email: "Email (Optional)",
        city: "City",
        password: "Password",
        confirmPassword: "Confirm Password",
        submit: "Register",
        loading: "Registering...",
        success: "Application submitted successfully!",
        error: "Registration failed",
        duplicate: "Phone number already registered"
      },
      common: {
        toggleLogin: "Login",
        toggleRegister: "Register",
        passwordRequirements: "Password must be at least 6 characters",
        phoneFormat: "Enter valid phone number"
      }
    },
    fr: {
      login: {
        title: "Connexion Ambassadeur",
        subtitle: "Accédez à votre tableau de bord",
        phone: "Numéro de Téléphone",
        password: "Mot de Passe",
        submit: "Se Connecter",
        loading: "Connexion...",
        success: "Connexion réussie!",
        error: "Identifiants invalides",
        pending: "Votre candidature est en cours d'examen",
        rejected: "Votre candidature n'a pas été approuvée"
      },
      register: {
        title: "Inscription Ambassadeur",
        subtitle: "Rejoignez notre programme d'ambassadeur",
        fullName: "Nom Complet",
        phone: "Numéro de Téléphone",
        email: "Email (Optionnel)",
        city: "Ville",
        password: "Mot de Passe",
        confirmPassword: "Confirmer le Mot de Passe",
        submit: "S'inscrire",
        loading: "Inscription...",
        success: "Candidature soumise avec succès!",
        error: "Échec de l'inscription",
        duplicate: "Numéro de téléphone déjà enregistré"
      },
      common: {
        toggleLogin: "Connexion",
        toggleRegister: "Inscription",
        passwordRequirements: "Le mot de passe doit contenir au moins 6 caractères",
        phoneFormat: "Entrez un numéro de téléphone valide"
      }
    }
  };

  const t = content[language];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Execute reCAPTCHA v3
    const recaptchaToken = await executeRecaptcha();
    
    if (!recaptchaToken) {
      toast({
        title: language === 'en' ? "Verification Failed" : "Échec de la vérification",
        description: language === 'en' 
          ? 'reCAPTCHA verification failed. Please try again.' 
          : 'La vérification reCAPTCHA a échoué. Veuillez réessayer.',
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Call ambassador login API endpoint
      const data = await safeApiCall(API_ROUTES.AMBASSADOR_LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: loginData.phone,
          password: loginData.password,
          recaptchaToken
        })
      });

      if (data.success && data.ambassador) {
        // Success - redirect to dashboard
        toast({
          title: t.login.success,
          description: language === 'en' ? "Redirecting to dashboard..." : "Redirection vers le tableau de bord...",
        });

        // Store ambassador session
        localStorage.setItem('ambassadorSession', JSON.stringify({ 
          user: data.ambassador, 
          loggedInAt: new Date().toISOString() 
        }));

        // Redirect to dashboard
        navigate('/ambassador/dashboard');
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || (language === 'en' ? "An error occurred" : "Une erreur s'est produite");
      
      // Handle specific error messages from API
      let title = t.login.error;
      let description = errorMessage;
      
      if (errorMessage.includes('Invalid phone number or password')) {
        description = language === 'en' ? "Invalid phone number or password" : "Numéro de téléphone ou mot de passe invalide";
      } else if (errorMessage.includes('under review')) {
        title = t.login.pending;
        description = language === 'en' ? "Your application is under review" : "Votre candidature est en cours d'examen";
      } else if (errorMessage.includes('not approved') || errorMessage.includes('rejected')) {
        title = t.login.rejected;
        description = language === 'en' ? "Your application was not approved" : "Votre candidature n'a pas été approuvée";
      } else if (errorMessage.includes('Too many')) {
        description = errorMessage;
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-heading text-gradient-neon">
            {t.login.title}
          </CardTitle>
          <p className="text-muted-foreground">
            {t.login.subtitle}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-phone">{t.login.phone}</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-phone"
                  type="tel"
                  placeholder="XX XXX XXX"
                  value={loginData.phone}
                  onChange={(e) => setLoginData({...loginData, phone: e.target.value})}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">{t.login.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-center">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  {language === 'en' 
                    ? '⚠️ Development mode: reCAPTCHA is disabled on localhost'
                    : '⚠️ Mode développement : reCAPTCHA est désactivé sur localhost'}
                </p>
              </div>
            )}

            {!RECAPTCHA_SITE_KEY && (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-center">
                <p className="text-sm text-destructive">
                  {language === 'en' 
                    ? 'reCAPTCHA is not configured. Please set VITE_RECAPTCHA_SITE_KEY in environment variables.'
                    : 'reCAPTCHA n\'est pas configuré. Veuillez définir VITE_RECAPTCHA_SITE_KEY dans les variables d\'environnement.'}
                </p>
              </div>
            )}

            <Button type="submit" className="w-full btn-gradient" disabled={isLoading}>
              {isLoading ? t.login.loading : t.login.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth; 
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { safeApiCall } from '@/lib/api-client';
import { logger } from '@/lib/logger';

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
      // Remove script tag
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      // Remove the visible reCAPTCHA badge
      const badge = document.querySelector('.grecaptcha-badge') as HTMLElement | null;
      if (badge && badge.parentNode) {
        badge.parentNode.removeChild(badge);
      }
      // Reset global grecaptcha so other pages start clean
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).grecaptcha;
    };
  }, [RECAPTCHA_SITE_KEY]);

  const RECAPTCHA_TIMEOUT_MS = 15000;

  const executeRecaptcha = async (): Promise<string | null> => {
    // Check if we're on localhost - automatically bypass for localhost
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '0.0.0.0' ||
                       window.location.hostname.includes('localhost');
    
    if (isLocalhost) {
      // Return a dummy token for localhost development
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

      const executePromise = window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'ambassador_auth' });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('RECAPTCHA_TIMEOUT')), RECAPTCHA_TIMEOUT_MS);
      });
      const token = await Promise.race([executePromise, timeoutPromise]);
      return token;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'RECAPTCHA_TIMEOUT' || (typeof msg === 'string' && msg.includes('reCAPTCHA Timeout'))) {
        throw new Error('RECAPTCHA_TIMEOUT');
      }
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
        phoneFormat: "Enter valid phone number",
        applyLink: "Not an ambassador yet? Apply here"
      },
      brand: {
        headline: "Your crowd. Your commission.",
        tagline: "Sign in to track sales, manage orders, and grow with Andiamo Events."
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
        phoneFormat: "Entrez un numéro de téléphone valide",
        applyLink: "Pas encore ambassadeur ? Postulez ici"
      },
      brand: {
        headline: "Votre réseau. Vos commissions.",
        tagline: "Connectez-vous pour suivre vos ventes, gérer vos commandes et grandir avec Andiamo Events."
      }
    }
  };

  const t = content[language];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.AMBASSADOR_ME}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.ambassador) {
          navigate('/ambassador/dashboard', { replace: true });
        }
      } catch {
        // stay on login page
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const recaptchaTimeoutMessage = language === 'en'
    ? "Verification timed out. Please try again or open this page in your device's browser (e.g. Safari or Chrome) instead of the in-app browser."
    : "Vérification expirée. Veuillez réessayer ou ouvrir cette page dans le navigateur de votre appareil (ex. Safari ou Chrome) plutôt que dans le navigateur intégré.";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Execute reCAPTCHA v3
    let recaptchaToken: string | null = null;
    try {
      recaptchaToken = await executeRecaptcha();
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'RECAPTCHA_TIMEOUT') {
        toast({
          title: language === 'en' ? "Verification timed out" : "Vérification expirée",
          description: recaptchaTimeoutMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      throw err;
    }
    
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
        // Log successful ambassador login
        logger.success('Ambassador login successful', {
          category: 'authentication',
          userType: 'ambassador',
          details: { 
            name: data.ambassador.full_name,
            phone: loginData.phone, 
            ambassadorId: data.ambassador.id 
          }
        });
        logger.action('Ambassador logged in', {
          category: 'authentication',
          userType: 'ambassador',
          details: { 
            name: data.ambassador.full_name,
            phone: loginData.phone, 
            ambassadorId: data.ambassador.id 
          }
        });

        // Success - redirect to dashboard
        toast({
          title: t.login.success,
          description: language === 'en' ? "Redirecting to dashboard..." : "Redirection vers le tableau de bord...",
        });

        navigate('/ambassador/dashboard');
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      // Extract error message from API response
      let errorMessage = error.message || (language === 'en' ? "An error occurred" : "Une erreur s'est produite");
      
      // Check if error has details from API response
      if (error.data) {
        errorMessage = error.data.error || error.data.details || error.data.message || errorMessage;
      }
      
      // Log failed ambassador login attempt
      logger.warning('Ambassador login failed', {
        category: 'authentication',
        userType: 'ambassador',
        details: { phone: loginData.phone, error: errorMessage, status: error.status }
      });
      
      // Handle specific error messages from API
      let title = t.login.error;
      let description = errorMessage;
      
      if (errorMessage.includes('Invalid phone number or password') || errorMessage.includes('Invalid credentials')) {
        title = language === 'en' ? "Invalid Credentials" : "Identifiants invalides";
        description = language === 'en' 
          ? "The phone number or password you entered is incorrect. Please check your credentials and try again." 
          : "Le numéro de téléphone ou le mot de passe que vous avez saisi est incorrect. Veuillez vérifier vos identifiants et réessayer.";
      } else if (errorMessage.includes('under review')) {
        title = t.login.pending;
        description = language === 'en' ? "Your application is under review" : "Votre candidature est en cours d'examen";
      } else if (errorMessage.includes('not approved') || errorMessage.includes('rejected')) {
        title = t.login.rejected;
        description = language === 'en' ? "Your application was not approved" : "Votre candidature n'a pas été approuvée";
      } else if (errorMessage.includes('suspended')) {
        title = language === 'en' ? "Account Suspended" : "Compte suspendu";
        description = language === 'en' 
          ? "Your ambassador account has been suspended. Please contact support for assistance." 
          : "Votre compte ambassadeur a été suspendu. Veuillez contacter le support pour obtenir de l'aide.";
      } else if (errorMessage.includes('Too many')) {
        description = errorMessage;
      } else if (errorMessage.includes('No ambassador found')) {
        title = language === 'en' ? "Account Not Found" : "Compte introuvable";
        description = language === 'en' 
          ? "No ambassador account found with this phone number. Please check your phone number or contact support." 
          : "Aucun compte ambassadeur trouvé avec ce numéro de téléphone. Veuillez vérifier votre numéro de téléphone ou contacter le support.";
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
    <div className="min-h-screen flex flex-col bg-gradient-dark lg:flex-row">
      <aside
        className="ambassador-auth-aside relative hidden shrink-0 flex-col justify-between border-r border-border bg-card p-12 lg:flex lg:w-[min(44%,480px)]"
        aria-hidden="true"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border) / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute left-0 top-[18%] bottom-[18%] w-[3px] rounded-r-full bg-primary" />

        <img
          src="/email-assets/logo-white.png"
          alt=""
          className="relative z-10 h-8 w-auto"
        />

        <div className="relative z-10 space-y-5">
          <h2 className="max-w-[16rem] font-heading text-[2rem] font-bold leading-[1.15] text-foreground">
            {t.brand.headline}
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t.brand.tagline}
          </p>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground">© Andiamo Events</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <header
            className="ambassador-auth-enter mb-9 text-center lg:text-left"
            style={{ animationDelay: "0.08s" }}
          >
            <h1 className="font-heading text-2xl font-bold tracking-tight text-primary sm:text-[1.75rem]">
              {t.login.title}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {t.login.subtitle}
            </p>
          </header>

          <form
            onSubmit={handleLogin}
            className="ambassador-auth-fields ambassador-auth-enter space-y-5"
            style={{ animationDelay: "0.18s" }}
          >
            <div className="space-y-2">
              <Label htmlFor="login-phone">{t.login.phone}</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="XX XXX XXX"
                  value={loginData.phone}
                  onChange={(e) => setLoginData({ ...loginData, phone: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">{t.login.password}</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-2 text-center">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  {language === 'en'
                    ? 'Development mode: reCAPTCHA is disabled on localhost'
                    : 'Mode développement : reCAPTCHA est désactivé sur localhost'}
                </p>
              </div>
            )}

            {!RECAPTCHA_SITE_KEY && (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-center">
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

          <footer
            className="ambassador-auth-enter mt-8 border-t border-border pt-6 text-center text-sm"
            style={{ animationDelay: "0.3s" }}
          >
            <Link
              to="/ambassador"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              {t.common.applyLink}
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Auth; 
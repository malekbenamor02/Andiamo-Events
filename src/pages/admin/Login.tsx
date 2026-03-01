import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, User, Mail, ArrowLeft, Sparkles, AlertCircle, Settings } from "lucide-react";
import Loader from "@/components/ui/Loader";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { API_ROUTES } from "@/lib/api-routes";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/adminLogs";

interface AdminLoginProps {
  language: 'en' | 'fr';
}

const AdminLogin = ({ language }: AdminLoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileEmail, setMobileEmail] = useState("");
  const [mobilePassword, setMobilePassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Get reCAPTCHA site key from environment
  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  
  // Clear form state on mount to ensure fresh login form after logout
  useEffect(() => {
    setEmail("");
    setPassword("");
    setError("");
    setShowPassword(false);
  }, []);

  // Load reCAPTCHA v3 script
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) {
      console.error('VITE_RECAPTCHA_SITE_KEY is not set in environment variables');
      return;
    }

    // Check if script is already loaded
    if (window.grecaptcha) {
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector(`script[src*="recaptcha/api.js"]`);
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, [RECAPTCHA_SITE_KEY]);

  // Execute reCAPTCHA v3
  const executeRecaptcha = async (): Promise<string | null> => {
    // Bypass reCAPTCHA on localhost for development
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('192.168.') ||
                       window.location.hostname.startsWith('10.0.') ||
                       window.location.hostname.startsWith('172.');
    
    if (isLocalhost) {
      return 'localhost-bypass-token';
    }

    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) {
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' });
      return token;
    } catch (error) {
      console.error('reCAPTCHA execution error:', error);
      return null;
    }
  };

  const t = {
    en: {
      title: "Admin Login",
      description: "Enter your credentials to access the admin dashboard",
      email: "Email",
      password: "Password",
      login: "Login",
      error: "Invalid credentials. Please try again.",
      loading: "Logging in...",
      backToHome: "Back to Home"
    },
    fr: {
      title: "Connexion Admin",
      description: "Entrez vos identifiants pour accéder au tableau de bord admin",
      email: "Email",
      password: "Mot de passe",
      login: "Se connecter",
      error: "Identifiants invalides. Veuillez réessayer.",
      loading: "Connexion en cours...",
      backToHome: "Retour à l'accueil"
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Execute reCAPTCHA v3 (bypassed on localhost)
    const recaptchaToken = await executeRecaptcha();
    
    // Only require reCAPTCHA if not on localhost
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('192.168.') ||
                       window.location.hostname.startsWith('10.0.') ||
                       window.location.hostname.startsWith('172.');
    
    if (!isLocalhost && !recaptchaToken) {
      setError(language === 'en' ? 'reCAPTCHA verification failed. Please try again.' : 'La vérification reCAPTCHA a échoué. Veuillez réessayer.');
      toast({
        title: language === 'en' ? "Verification Failed" : "Échec de la vérification",
        description: language === 'en' ? 'reCAPTCHA verification failed. Please try again.' : 'La vérification reCAPTCHA a échoué. Veuillez réessayer.',
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const loginPayload = {
        email,
        password,
        recaptchaToken
      };
      
      const loginEndpoint = API_ROUTES.ADMIN_LOGIN;
      
      // Call the Vercel API route for admin login
      const response = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginPayload)
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = t[language].error;
        let errorData = null;
        try {
          const responseText = await response.text();
          try {
            errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch (parseError) {
            errorMessage = responseText || response.statusText || errorMessage;
          }
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        
        // Log failed admin login attempt
        logger.warning('Admin login failed', {
          category: 'authentication',
          userType: 'admin',
          details: { email, reason: errorMessage }
        });

        setError(errorMessage);
        toast({
          title: language === 'en' ? "Login Failed" : "Échec de connexion",
          description: errorMessage,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Parse JSON response
      let data;
      try {
        const responseText = await response.text();
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse login response:', e);
        setError(t[language].error);
        toast({
          title: language === 'en' ? "Login Failed" : "Échec de connexion",
          description: language === 'en' ? "Invalid response from server" : "Réponse invalide du serveur",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data.success) {
        // Log successful admin login
        const adminName = data.admin?.name || 'Unknown';
        const adminEmail = data.admin?.email || email;
        logger.success('Admin login successful', {
          category: 'authentication',
          userType: 'admin',
          details: { 
            name: adminName,
            email: adminEmail 
          }
        });
        logger.action('Admin logged in', {
          category: 'authentication',
          userType: 'admin',
          details: { 
            name: adminName,
            email: adminEmail 
          }
        });

        if (data.admin?.id) {
          logAdminAction(supabase, { adminId: data.admin.id, adminName: adminName, adminEmail: adminEmail, action: 'admin.login' }).catch(() => {});
        }

        // No localStorage cleanup needed - session is managed by server token only

        // Login successful - JWT token is now stored in httpOnly cookie
        toast({
          title: language === 'en' ? "Login Successful!" : "Connexion réussie!",
          description: language === 'en' 
            ? "Welcome to the admin dashboard."
            : "Bienvenue dans le tableau de bord admin.",
        });

        navigate('/admin', { state: { fromLogin: true }, replace: true });
      } else {
        // Login failed
        setError(data.error || t[language].error);
        toast({
          title: language === 'en' ? "Login Failed" : "Échec de connexion",
          description: data.error || t[language].error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      // More detailed error handling
      let errorMessage = t[language].error;
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = language === 'en' 
          ? "Network error. Please check your connection and ensure the API is accessible."
          : "Erreur réseau. Veuillez vérifier votre connexion et vous assurer que l'API est accessible.";
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = language === 'en' 
          ? "Network error. Please check your connection."
          : "Erreur réseau. Veuillez vérifier votre connexion.";
      }
      setError(errorMessage);
      toast({
        title: language === 'en' ? "Connection Error" : "Erreur de connexion",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Mobile: simple login (no JWT, no verification) — for step-by-step dashboard build. Desktop-only flow saved for later.
  const handleMobileLogin = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      sessionStorage.setItem('mobileAdminSession', '1');
    } catch (_) {}
    navigate('/admin', { replace: true });
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center text-lg">{language === 'en' ? 'Admin (mobile)' : 'Admin (mobile)'}</CardTitle>
            <CardDescription className="text-center text-sm">
              {language === 'en' ? 'Simple sign-in for mobile dashboard.' : 'Connexion simple pour le tableau de bord mobile.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMobileLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile-email">{t[language].email}</Label>
                <Input
                  id="mobile-email"
                  type="email"
                  value={mobileEmail}
                  onChange={(e) => setMobileEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile-password">{t[language].password}</Label>
                <Input
                  id="mobile-password"
                  type="password"
                  value={mobilePassword}
                  onChange={(e) => setMobilePassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">
                {t[language].login}
              </Button>
            </form>
            <Button variant="ghost" className="w-full mt-2" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {language === 'en' ? 'Back to home' : "Retour à l'accueil"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/20 blur-3xl animate-float" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-secondary/20 blur-3xl animate-float delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-accent/10 blur-3xl animate-float delay-2000" />
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '20px 20px',
        }} />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <Card className="glass border-border/50 shadow-2xl">
          <CardHeader className="text-center pt-6 pb-3 relative">
            <div className="mx-auto w-12 h-12 bg-gradient-to-r from-primary via-secondary to-accent rounded-full flex items-center justify-center mb-3 relative overflow-hidden animate-pulse-glow">
              <Lock className="w-6 h-6 text-primary-foreground relative z-10" />
              <Sparkles className="absolute top-0.5 right-0.5 w-3 h-3 text-white/80 animate-spin-slow" />
            </div>
            <CardTitle className="text-2xl font-heading font-bold text-gradient-neon mb-1">
              {t[language].title}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {t[language].description}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-foreground/80">
                  <Mail className="w-4 h-4 text-primary" />
                  {t[language].email}
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full pl-10 h-10 bg-input border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 group"
                    placeholder="admin@andiamoevents.com"
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <div className="absolute inset-0 rounded-md pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-r from-primary/20 to-secondary/20" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-foreground/80">
                  <Lock className="w-4 h-4 text-primary" />
                  {t[language].password}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pr-10 pl-10 h-10 bg-input border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 group"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="absolute inset-0 rounded-md pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-r from-primary/20 to-secondary/20" />
                </div>
              </div>
              
              {!RECAPTCHA_SITE_KEY && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {language === 'en' 
                      ? 'reCAPTCHA is not configured. Please set VITE_RECAPTCHA_SITE_KEY in environment variables.'
                      : 'reCAPTCHA n\'est pas configuré. Veuillez définir VITE_RECAPTCHA_SITE_KEY dans les variables d\'environnement.'}
                  </AlertDescription>
                </Alert>
              )}
              
              <Button
                type="submit"
                className="w-full h-10 btn-gradient text-base font-semibold relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                disabled={loading || (!RECAPTCHA_SITE_KEY && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.startsWith('192.168.') && !window.location.hostname.startsWith('10.0.') && !window.location.hostname.startsWith('172.'))}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader size="sm" className="shrink-0 [background:hsl(var(--primary-foreground))]" />
                      {t[language].loading}
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      {t[language].login}
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-[length:200%_200%] animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundImage: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.1) 70%, transparent 100%)' }} />
              </Button>
            </form>
            
            <div className="mt-4 text-center border-t border-border/50 pt-4">
              <Button
                variant="link"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-primary transition-colors duration-300 flex items-center justify-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                {t[language].backToHome}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin; 
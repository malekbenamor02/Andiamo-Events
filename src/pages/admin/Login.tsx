import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, User, Mail, ArrowLeft, Sparkles, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

interface AdminLoginProps {
  language: 'en' | 'fr';
}

const AdminLogin = ({ language }: AdminLoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

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

    try {
      // Call the Vercel API route for admin login
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: This allows cookies to be set
        body: JSON.stringify({
          email,
          password
        })
      });

      // Check if response is OK before trying to parse JSON
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = t[language].error;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
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
        data = await response.json();
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
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
        logger.success('Admin login successful', {
          category: 'authentication',
          userType: 'admin',
          details: { email }
        });
        logger.action('Admin logged in', {
          category: 'authentication',
          userType: 'admin',
          details: { email }
        });

        // Login successful - JWT token is now stored in httpOnly cookie
        toast({
          title: language === 'en' ? "Login Successful!" : "Connexion réussie!",
          description: language === 'en' 
            ? "Welcome to the admin dashboard."
            : "Bienvenue dans le tableau de bord admin.",
        });

        // Redirect to admin dashboard
        navigate('/admin');
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

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <Card className="glass border-border/50 shadow-2xl">
          <CardHeader className="text-center pt-8 pb-4 relative">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary via-secondary to-accent rounded-full flex items-center justify-center mb-4 relative overflow-hidden animate-pulse-glow">
              <Lock className="w-8 h-8 text-primary-foreground relative z-10" />
              <Sparkles className="absolute top-1 right-1 w-4 h-4 text-white/80 animate-spin-slow" />
            </div>
            <CardTitle className="text-3xl font-orbitron font-bold text-gradient-neon mb-2">
              {t[language].title}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              {t[language].description}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-5">
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
                    className="w-full pl-10 h-12 bg-input border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 group"
                    placeholder="admin@andiamo.com"
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
                    className="w-full pr-10 pl-10 h-12 bg-input border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 group"
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
              
              <Button
                type="submit"
                className="w-full h-12 btn-gradient text-lg font-semibold relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                disabled={loading}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
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
            
            <div className="mt-6 text-center border-t border-border/50 pt-6">
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
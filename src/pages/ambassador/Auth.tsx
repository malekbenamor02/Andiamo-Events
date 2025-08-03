import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, User, Lock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import bcrypt from 'bcryptjs';

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

    try {
      // Fetch ambassador by phone number
      const { data: ambassadors, error } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('phone', loginData.phone)
        .single();

      if (error || !ambassadors) {
        toast({
          title: t.login.error,
          description: language === 'en' ? "Invalid phone number or password" : "Numéro de téléphone ou mot de passe invalide",
          variant: "destructive",
        });
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(loginData.password, ambassadors.password);
      if (!isPasswordValid) {
        toast({
          title: t.login.error,
          description: language === 'en' ? "Invalid phone number or password" : "Numéro de téléphone ou mot de passe invalide",
          variant: "destructive",
        });
        return;
      }

      // Check application status
      if (ambassadors.status === 'pending') {
        toast({
          title: t.login.pending,
          description: language === 'en' ? "Your application is under review" : "Votre candidature est en cours d'examen",
          variant: "destructive",
        });
        return;
      }

      if (ambassadors.status === 'rejected') {
        toast({
          title: t.login.rejected,
          description: language === 'en' ? "Your application was not approved" : "Votre candidature n'a pas été approuvée",
          variant: "destructive",
        });
        return;
      }

      // Success - redirect to dashboard
      toast({
        title: t.login.success,
        description: language === 'en' ? "Redirecting to dashboard..." : "Redirection vers le tableau de bord...",
      });

      // Store ambassador session
      localStorage.setItem('ambassadorSession', JSON.stringify({ user: ambassadors, loggedInAt: new Date().toISOString() }));

      // Redirect to dashboard
      navigate('/ambassador/dashboard');

    } catch (error) {
      toast({
        title: t.login.error,
        description: language === 'en' ? "An error occurred" : "Une erreur s'est produite",
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
          <CardTitle className="text-2xl font-orbitron text-gradient-neon">
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
                  placeholder="+216 XX XXX XXX"
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
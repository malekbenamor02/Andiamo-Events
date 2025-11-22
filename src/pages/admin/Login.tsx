import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {t[language].title}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {t[language].description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {t[language].email}
                </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  required
                    placeholder="admin@andiamo.com"
                  className="w-full"
                  />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {t[language].password}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                disabled={loading}
              >
                {loading ? t[language].loading : t[language].login}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <Button
                variant="link"
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900"
              >
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
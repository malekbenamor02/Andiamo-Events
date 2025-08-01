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
  requires_password_change?: boolean;
  reset_token?: string;
  reset_token_expiry?: string;
}

const Auth = ({ language }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form states
  const [loginData, setLoginData] = useState({
    phone: '',
    password: ''
  });

  const [forgotPasswordData, setForgotPasswordData] = useState({
    phone: ''
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
        rejected: "Your application was not approved",
        forgotPassword: "Forgot Password?"
      },
      forgotPassword: {
        title: "Forgot Password",
        subtitle: "Enter your phone number to receive a password reset link by email",
        phone: "Phone Number",
        submit: "Send Reset Link",
        loading: "Sending...",
        success: "Reset link sent!",
        error: "Phone number not found",
        backToLogin: "Back to Login"
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
        rejected: "Votre candidature n'a pas été approuvée",
        forgotPassword: "Mot de Passe Oublié?"
      },
      forgotPassword: {
        title: "Mot de Passe Oublié",
        subtitle: "Entrez votre numéro de téléphone pour recevoir un lien de réinitialisation par email",
        phone: "Numéro de Téléphone",
        submit: "Envoyer le Lien de Réinitialisation",
        loading: "Envoi...",
        success: "Lien de réinitialisation envoyé!",
        error: "Numéro de téléphone non trouvé",
        backToLogin: "Retour à la Connexion"
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

      // Redirect to dashboard or change password page
      if ((ambassadors as Ambassador).requires_password_change) {
        navigate('/ambassador/change-password');
      } else {
        navigate('/ambassador/dashboard');
      }

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Searching for phone:', forgotPasswordData.phone);
      
      // Check if ambassador exists
      const { data: ambassador, error } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('phone', forgotPasswordData.phone)
        .single();

      console.log('Database response:', { ambassador, error });

      if (error) {
        console.error('Database error:', error);
        toast({
          title: t.forgotPassword.error,
          description: language === 'en' ? "Database error occurred" : "Erreur de base de données",
          variant: "destructive",
        });
        return;
      }

      if (!ambassador) {
        console.log('No ambassador found with phone:', forgotPasswordData.phone);
        toast({
          title: t.forgotPassword.error,
          description: language === 'en' ? "No account found with this phone number" : "Aucun compte trouvé avec ce numéro de téléphone",
          variant: "destructive",
        });
        return;
      }

      console.log('Ambassador found:', ambassador);

      // Show confirmation with masked email
      const email = ambassador.email || 'noreply@andiamo.com';
      const maskedEmail = email.replace(/(.{2}).*@/, '$1***@');
      
      toast({
        title: language === 'en' ? "Reset link will be sent" : "Le lien de réinitialisation sera envoyé",
        description: language === 'en' 
          ? `We will send a password reset link to ${maskedEmail}` 
          : `Nous enverrons un lien de réinitialisation à ${maskedEmail}`,
      });

      // Generate reset token
      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for production

      console.log('Generated token:', resetToken);
      console.log('Token expiry:', resetExpiry.toISOString());

      // Save reset token to database
      const { error: updateError } = await supabase
        .from('ambassadors')
        .update({ 
          reset_token: resetToken,
          reset_token_expiry: resetExpiry.toISOString()
        } as any)
        .eq('id', ambassador.id);

      console.log('Update response:', { updateError });

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Send reset email
      const resetUrl = `${window.location.origin}/ambassador/reset-password?token=${resetToken}`;
      console.log('Reset URL:', resetUrl);
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: import.meta.env.VITE_GMAIL_FROM || 'Andiamo Events <noreply@andiamo.com>',
          to: ambassador.email || 'noreply@andiamo.com',
          subject: language === 'en' ? 'Password Reset Request' : 'Demande de Réinitialisation de Mot de Passe',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Password Reset</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${language === 'en' ? 'Password Reset Request' : 'Demande de Réinitialisation'}</h1>
                </div>
                
                <div class="content">
                  <p>Dear <strong>${ambassador.full_name}</strong>,</p>
                  
                  <p>${language === 'en' ? 'We received a request to reset your password for your Andiamo ambassador account.' : 'Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte ambassadeur Andiamo.'}</p>
                  
                  <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">${language === 'en' ? 'Reset Password' : 'Réinitialiser le Mot de Passe'}</a>
                  </div>
                  
                  <div class="warning">
                    <p><strong>⚠️ ${language === 'en' ? 'Important:' : 'Important :'}</strong> ${language === 'en' ? 'This link will expire in 1 hour for security reasons.' : 'Ce lien expirera dans 1 heure pour des raisons de sécurité.'}</p>
                    <p>${language === 'en' ? 'If you didn\'t request this password reset, please ignore this email.' : 'Si vous n\'avez pas demandé cette réinitialisation, veuillez ignorer cet email.'}</p>
                  </div>
                  
                  <p>${language === 'en' ? 'Best regards,' : 'Cordialement,'}<br>
                  <strong>${language === 'en' ? 'The Andiamo Team' : 'L\'Équipe Andiamo'}</strong></p>
                </div>
                
                <div class="footer">
                  <p>© 2024 Andiamo Events. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `
        }),
      });

      console.log('Email response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Email sending error:', errorData);
        throw new Error('Failed to send email');
      }

      toast({
        title: t.forgotPassword.success,
        description: language === 'en' ? "Reset link sent! Check your email" : "Lien de réinitialisation envoyé! Vérifiez votre email",
      });

      setShowForgotPassword(false);
      setForgotPasswordData({ phone: '' });

    } catch (error) {
      console.error('Forgot password error:', error);
      toast({
        title: t.forgotPassword.error,
        description: language === 'en' ? "Failed to send reset link" : "Échec de l'envoi du lien de réinitialisation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-orbitron text-gradient-neon">
              {t.forgotPassword.title}
            </CardTitle>
            <p className="text-muted-foreground">
              {t.forgotPassword.subtitle}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-phone">{t.forgotPassword.phone}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-phone"
                    type="tel"
                    placeholder="+216 XX XXX XXX"
                    value={forgotPasswordData.phone}
                    onChange={(e) => setForgotPasswordData({...forgotPasswordData, phone: e.target.value})}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full btn-gradient" disabled={isLoading}>
                {isLoading ? t.forgotPassword.loading : t.forgotPassword.submit}
              </Button>

              <Button 
                type="button" 
                variant="ghost" 
                className="w-full" 
                onClick={() => setShowForgotPassword(false)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.forgotPassword.backToLogin}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

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

            <Button 
              type="button" 
              variant="ghost" 
              className="w-full" 
              onClick={() => setShowForgotPassword(true)}
            >
              {t.login.forgotPassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth; 
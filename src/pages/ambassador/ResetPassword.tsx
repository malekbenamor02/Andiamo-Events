import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import bcrypt from 'bcryptjs';

interface ResetPasswordProps {
  language: 'en' | 'fr';
}

const ResetPassword = ({ language }: ResetPasswordProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [ambassador, setAmbassador] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const t = language === 'en' ? {
    title: "Reset Password",
    subtitle: "Enter your new password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    submit: "Reset Password",
    loading: "Resetting...",
    success: "Password reset successfully!",
    error: "Failed to reset password",
    invalidToken: "Invalid or expired reset link",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 8 characters long",
    backToLogin: "Back to Login"
  } : {
    title: "Réinitialiser le Mot de Passe",
    subtitle: "Entrez votre nouveau mot de passe",
    newPassword: "Nouveau Mot de Passe",
    confirmPassword: "Confirmez le Nouveau Mot de Passe",
    submit: "Réinitialiser le Mot de Passe",
    loading: "Réinitialisation...",
    success: "Mot de passe réinitialisé avec succès!",
    error: "Échec de la réinitialisation du mot de passe",
    invalidToken: "Lien de réinitialisation invalide ou expiré",
    passwordMismatch: "Les mots de passe ne correspondent pas",
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères",
    backToLogin: "Retour à la Connexion"
  };

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        toast({
          title: t.invalidToken,
          variant: "destructive",
        });
        navigate('/ambassador/auth');
        return;
      }

      try {
        // Find ambassador with this reset token
        const { data: ambassadorData, error } = await supabase
          .from('ambassadors')
          .select('*')
          .eq('reset_token', token)
          .single();

        if (error || !ambassadorData) {
          toast({
            title: t.invalidToken,
            variant: "destructive",
          });
          navigate('/ambassador/auth');
          return;
        }

        // Check if token is expired
        const resetExpiry = new Date(ambassadorData.reset_token_expiry);
        if (resetExpiry < new Date()) {
          toast({
            title: t.invalidToken,
            description: language === 'en' ? "Reset link has expired" : "Le lien de réinitialisation a expiré",
            variant: "destructive",
          });
          navigate('/ambassador/auth');
          return;
        }

        setAmbassador(ambassadorData);
        setIsValidToken(true);

      } catch (error) {
        toast({
          title: t.invalidToken,
          variant: "destructive",
        });
        navigate('/ambassador/auth');
      }
    };

    validateToken();
  }, [token, navigate, toast, language, t.invalidToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check password length
    if (password.length < 8) {
      toast({ title: t.passwordTooShort, variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: t.passwordMismatch, variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update ambassador password and clear reset token
      const { error } = await supabase
        .from('ambassadors')
        .update({ 
          password: hashedPassword,
          reset_token: null,
          reset_token_expiry: null
        })
        .eq('id', ambassador.id);

      if (error) {
        throw error;
      }

      toast({
        title: t.success,
        description: language === 'en' ? "You can now login with your new password" : "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe",
      });

      navigate('/ambassador/auth');

    } catch (error) {
      toast({
        title: t.error,
        description: language === 'en' ? "An error occurred" : "Une erreur s'est produite",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass">
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {language === 'en' ? "Validating reset link..." : "Validation du lien de réinitialisation..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-orbitron text-gradient-neon">{t.title}</CardTitle>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t.newPassword}</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={language === 'en' ? "Minimum 8 characters" : "Minimum 8 caractères"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t.confirmPassword}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder={language === 'en' ? "Confirm your password" : "Confirmez votre mot de passe"}
              />
            </div>
            <Button type="submit" className="w-full btn-gradient" disabled={isLoading}>
              {isLoading ? t.loading : t.submit}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full" 
              onClick={() => navigate('/ambassador/auth')}
            >
              {t.backToLogin}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword; 
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import bcrypt from 'bcryptjs';

const ChangePassword = ({ language }) => {
  const [ambassador, setAmbassador] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const t = language === 'en' ? {
    title: "Change Your Password",
    subtitle: "For security, you must change your password before proceeding.",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    submit: "Save and Continue",
    loading: "Saving...",
    success: "Password updated successfully!",
    error: "Failed to update password.",
    passwordMismatch: "Passwords do not match.",
  } : {
    title: "Changez Votre Mot de Passe",
    subtitle: "Pour des raisons de sécurité, vous devez changer votre mot de passe.",
    newPassword: "Nouveau Mot de Passe",
    confirmPassword: "Confirmez le Nouveau Mot de Passe",
    submit: "Enregistrer et Continuer",
    loading: "Enregistrement...",
    success: "Mot de passe mis à jour avec succès!",
    error: "Échec de la mise à jour du mot de passe.",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
  };

  useEffect(() => {
    const session = localStorage.getItem('ambassadorSession');
    if (!session) {
      navigate('/ambassador/auth');
    } else {
      const { user } = JSON.parse(session);
      setAmbassador(user);
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: t.passwordMismatch, variant: "destructive" });
      return;
    }
    setIsLoading(true);

    // Hash the new password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase
      .from('ambassadors')
      .update({ 
        password: hashedPassword,
        requires_password_change: false 
      })
      .eq('id', ambassador.id);

    setIsLoading(false);
    if (error) {
      toast({ title: t.error, description: error.message, variant: "destructive" });
    } else {
      toast({ title: t.success });
      // Update local session to reflect the change
      const newSession = { user: { ...ambassador, requires_password_change: false }, loggedInAt: new Date().toISOString() };
      localStorage.setItem('ambassadorSession', JSON.stringify(newSession));
      navigate('/ambassador/dashboard');
    }
  };

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
              />
            </div>
            <Button type="submit" className="w-full btn-gradient" disabled={isLoading}>
              {isLoading ? t.loading : t.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword; 
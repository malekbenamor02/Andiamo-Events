import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import Loader from '@/components/ui/Loader';
import { adminApi } from '@/lib/adminApi';

interface AdminChangePasswordProps {
  language: 'en' | 'fr';
}

const AdminChangePassword = ({ language }: AdminChangePasswordProps) => {
  const isEn = language === 'en';
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(isEn ? 'New password must be at least 8 characters' : 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isEn ? 'Passwords do not match' : 'Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword === currentPassword) {
      setError(isEn ? 'Choose a different password than your current one' : 'Choisissez un mot de passe différent de l’actuel');
      return;
    }

    setLoading(true);
    try {
      await adminApi.changePassword(currentPassword, newPassword);
      navigate('/admin', { replace: true, state: { passwordChanged: true } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || (isEn ? 'Could not update password' : 'Impossible de mettre à jour le mot de passe'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass border-border/50 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-heading text-primary">
            {isEn ? 'Password reset required' : 'Réinitialisation requise'}
          </CardTitle>
          <CardDescription className="text-sm">
            {isEn
              ? 'For security, you must set a new password before accessing the admin dashboard.'
              : 'Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant d’accéder au tableau de bord.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="current-pw">{isEn ? 'Current password' : 'Mot de passe actuel'}</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCurrent((v) => !v)}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-pw">{isEn ? 'New password' : 'Nouveau mot de passe'}</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNew((v) => !v)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-pw">{isEn ? 'Confirm new password' : 'Confirmer le mot de passe'}</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {isEn ? 'Minimum 8 characters.' : 'Minimum 8 caractères.'}
            </p>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size="sm" />
                  {isEn ? 'Updating…' : 'Mise à jour…'}
                </span>
              ) : (
                isEn ? 'Update password & continue' : 'Mettre à jour et continuer'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminChangePassword;

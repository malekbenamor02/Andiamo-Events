import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import ProtectedInfluencerRoute from '@/components/auth/ProtectedInfluencerRoute';

interface ChangePasswordProps {
  language: 'en' | 'fr';
}

function ChangePasswordForm({ language }: ChangePasswordProps) {
  const isEn = language === 'en';
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(isEn ? 'Passwords do not match' : 'Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_INFLUENCER_CHANGE_PASSWORD}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (isEn ? 'Could not update password' : 'Impossible de mettre à jour le mot de passe'));
        return;
      }
      navigate('/influencer/dashboard', { replace: true });
    } catch {
      setError(isEn ? 'Network error' : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/assets/andiamo-academy-cropped.svg"
            alt="Andiamo Academy"
            className="h-9 w-auto dark:block hidden"
          />
          <img
            src="/assets/andiamo-academy-cropped-black.svg"
            alt="Andiamo Academy"
            className="h-9 w-auto dark:hidden block"
          />
          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {isEn ? 'Influencer portal' : 'Portail influenceur'}
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-6 sm:p-8 shadow-sm">
          <div className="mb-6 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">
              {isEn ? 'Set a new password' : 'Nouveau mot de passe'}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isEn
                ? 'Choose a password before opening your sales dashboard.'
                : 'Choisissez un mot de passe avant d’accéder au tableau de bord.'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-pw" className="text-xs font-medium text-muted-foreground">
                {isEn ? 'New password' : 'Nouveau mot de passe'}
              </Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                className="h-11 bg-background/60"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw" className="text-xs font-medium text-muted-foreground">
                {isEn ? 'Confirm password' : 'Confirmer le mot de passe'}
              </Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                className="h-11 bg-background/60"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {isEn
                ? 'At least 8 characters with uppercase, lowercase, and a number.'
                : 'Au moins 8 caractères avec majuscule, minuscule et chiffre.'}
            </p>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (isEn ? 'Saving…' : 'Enregistrement…') : isEn ? 'Continue' : 'Continuer'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function InfluencerChangePassword({ language }: ChangePasswordProps) {
  return (
    <ProtectedInfluencerRoute language={language} requirePasswordChanged={false}>
      <ChangePasswordForm language={language} />
    </ProtectedInfluencerRoute>
  );
}

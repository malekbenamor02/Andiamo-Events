import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';

interface InfluencerAuthProps {
  language: 'en' | 'fr';
}

export default function InfluencerAuth({ language }: InfluencerAuthProps) {
  const isEn = language === 'en';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_INFLUENCER_LOGIN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (isEn ? 'Login failed' : 'Échec de connexion'));
        return;
      }
      if (data.must_change_password) {
        navigate('/influencer/change-password', { replace: true });
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
              {isEn ? 'Sign in' : 'Connexion'}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isEn
                ? 'Use the email and password from your invitation.'
                : 'Utilisez l’e-mail et le mot de passe reçus par invitation.'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="influencer-email" className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="influencer-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-11 bg-background/60"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="influencer-password" className="text-xs font-medium text-muted-foreground">
                {isEn ? 'Password' : 'Mot de passe'}
              </Label>
              <Input
                id="influencer-password"
                type="password"
                autoComplete="current-password"
                className="h-11 bg-background/60"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (isEn ? 'Signing in…' : 'Connexion…') : isEn ? 'Sign in' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

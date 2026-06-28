import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import Loader from '@/components/ui/Loader';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock3,
  LogOut,
  Receipt,
  RefreshCw,
  Tag,
} from 'lucide-react';

interface InfluencerDashboardProps {
  language: 'en' | 'fr';
}

interface SalesSummary {
  approved_count: number;
  approved_revenue_dt: number;
  pending_count: number;
  failed_count: number;
  promo_codes: Array<{ id: string; code: string }>;
}

interface SalesRow {
  registration_number: string;
  formule: string;
  promo_code: string | null;
  status: string;
  total_amount_dt: number;
  created_at: string;
}

function statusLabel(status: string, isEn: boolean) {
  const labels: Record<string, { en: string; fr: string }> = {
    approved: { en: 'Approved', fr: 'Approuvé' },
    rejected: { en: 'Rejected', fr: 'Refusé' },
    proof_received: { en: 'Proof received', fr: 'Preuve reçue' },
    pending_payment: { en: 'Pending payment', fr: 'Paiement en attente' },
    pending_online: { en: 'Online payment pending', fr: 'Paiement en ligne en cours' },
    paid_online: { en: 'Paid online', fr: 'Payé en ligne' },
    failed: { en: 'Payment failed', fr: 'Paiement échoué' },
    cancelled: { en: 'Cancelled', fr: 'Annulé' },
  };
  const row = labels[status];
  return row ? (isEn ? row.en : row.fr) : status;
}

function statusDotClass(status: string) {
  if (status === 'approved') return 'bg-emerald-500';
  if (status === 'rejected' || status === 'failed') return 'bg-red-500';
  if (status === 'proof_received') return 'bg-sky-500';
  if (status === 'pending_payment' || status === 'pending_online') return 'bg-amber-500';
  if (status === 'paid_online') return 'bg-blue-500';
  if (status === 'cancelled') return 'bg-muted-foreground/50';
  return 'bg-muted-foreground/50';
}

function formatDate(iso: string, isEn: boolean) {
  return new Date(iso).toLocaleString(isEn ? 'en-GB' : 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <Card className="border-border/60 bg-card/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30">
            <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status, isEn }: { status: string; isEn: boolean }) {
  const label = statusLabel(status, isEn);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <span
            role="img"
            aria-label={label}
            className={cn('h-2.5 w-2.5 shrink-0 rounded-full', statusDotClass(status))}
          />
          <span className="text-sm">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function DashboardContent({ language }: InfluencerDashboardProps) {
  const isEn = language === 'en';
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState('');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionRes, salesRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_INFLUENCER_SESSION}`, { credentials: 'include' }),
        fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_INFLUENCER_SALES}`, { credentials: 'include' }),
      ]);
      const sessionData = await sessionRes.json().catch(() => ({}));
      const salesData = await salesRes.json().catch(() => ({}));
      if (!sessionRes.ok) {
        navigate('/influencer/auth', { replace: true });
        return;
      }
      if (sessionData.must_change_password) {
        navigate('/influencer/change-password', { replace: true });
        return;
      }
      setProfileName(sessionData.profile?.full_name || '');
      if (!salesRes.ok) throw new Error(salesData.error || 'Failed to load sales');
      setSummary(salesData.summary || null);
      setRows(salesData.registrations || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : isEn ? 'Load failed' : 'Échec du chargement');
    } finally {
      setLoading(false);
    }
  }, [isEn, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const logout = async () => {
    await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_INFLUENCER_LOGOUT}`, {
      method: 'POST',
      credentials: 'include',
    });
    navigate('/influencer/auth', { replace: true });
  };

  const promoCodes = summary?.promo_codes || [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/60 bg-background">
          <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0 sm:gap-4">
                <img
                  src="/assets/andiamo-academy-cropped.svg"
                  alt="Andiamo Academy"
                  className="h-8 w-auto shrink-0 dark:block hidden"
                />
                <img
                  src="/assets/andiamo-academy-cropped-black.svg"
                  alt="Andiamo Academy"
                  className="h-8 w-auto shrink-0 dark:hidden block"
                />
                <div className="h-8 w-px bg-border/60 hidden sm:block" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate sm:text-base">
                    {profileName || (isEn ? 'Influencer dashboard' : 'Tableau de bord')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isEn ? 'Academy promo performance' : 'Performance des codes promo Academy'}
                  </p>
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin', 'sm:mr-1.5')} />
                  {isEn ? 'Refresh' : 'Actualiser'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4 sm:mr-1.5" />
                  {isEn ? 'Log out' : 'Déconnexion'}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
          {loading && !summary ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20">
              <Loader size="md" />
              <p className="text-sm text-muted-foreground">
                {isEn ? 'Loading your sales…' : 'Chargement de vos ventes…'}
              </p>
            </div>
          ) : error ? (
            <Card className="border-destructive/30">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={load}>
                  {isEn ? 'Try again' : 'Réessayer'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard
                  icon={CheckCircle2}
                  label={isEn ? 'Approved sales' : 'Ventes approuvées'}
                  value={String(summary?.approved_count ?? 0)}
                  hint={isEn ? 'Confirmed registrations' : 'Inscriptions confirmées'}
                />
                <StatCard
                  icon={Clock3}
                  label={isEn ? 'Pending' : 'En attente'}
                  value={String(summary?.pending_count ?? 0)}
                  hint={isEn ? 'Awaiting validation or payment' : 'En attente de validation ou paiement'}
                />
              </div>

              <div className="rounded-lg border border-border/60 bg-card/30 px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="font-medium text-foreground">
                      {isEn ? 'Your promo codes' : 'Vos codes promo'}
                    </span>
                  </div>
                  {promoCodes.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      {isEn ? 'No codes assigned yet' : 'Aucun code assigné'}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {promoCodes.map((p) => (
                        <Badge
                          key={p.id}
                          variant="outline"
                          className="font-mono text-xs tracking-wide border-primary/25 bg-primary/5 text-foreground"
                        >
                          {p.code}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Card className="border-border/60 overflow-hidden">
                <CardHeader className="border-b border-border/40 bg-muted/20 px-5 py-4">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {isEn ? 'Registrations' : 'Inscriptions'}
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        {isEn
                          ? 'Sales attributed to your promo codes. Customer contact details are not shown.'
                          : 'Ventes liées à vos codes promo. Les coordonnées clients ne sont pas affichées.'}
                      </CardDescription>
                    </div>
                    {rows.length > 0 && (
                      <Badge variant="secondary" className="tabular-nums font-normal">
                        {rows.length} {isEn ? 'total' : 'au total'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="pl-5">{isEn ? 'Ref' : 'Réf.'}</TableHead>
                          <TableHead>{isEn ? 'Promo' : 'Code'}</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="pr-5">{isEn ? 'Date' : 'Date'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={4} className="py-16">
                              <div className="flex flex-col items-center justify-center gap-3 text-center">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border/80 bg-muted/20">
                                  <Receipt className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">
                                    {isEn ? 'No registrations yet' : 'Aucune inscription pour le moment'}
                                  </p>
                                  <p className="text-xs text-muted-foreground max-w-sm">
                                    {isEn
                                      ? 'When someone registers with your promo code, it will show up here.'
                                      : 'Lorsqu’une personne s’inscrit avec votre code promo, elle apparaîtra ici.'}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          rows.map((r) => (
                            <TableRow key={r.registration_number} className="border-border/40">
                              <TableCell className="pl-5 font-mono text-xs text-muted-foreground">
                                {r.registration_number}
                              </TableCell>
                              <TableCell>
                                {r.promo_code ? (
                                  <span className="font-mono text-xs text-muted-foreground">{r.promo_code}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <StatusDot status={r.status} isEn={isEn} />
                              </TableCell>
                              <TableCell className="pr-5 text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(r.created_at, isEn)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}

export default function InfluencerDashboard({ language }: InfluencerDashboardProps) {
  return <DashboardContent language={language} />;
}

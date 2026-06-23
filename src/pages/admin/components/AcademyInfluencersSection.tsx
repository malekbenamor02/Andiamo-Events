import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { cn } from '@/lib/utils';
import Loader from '@/components/ui/Loader';
import { ChevronRight, Mail, RefreshCw, KeyRound } from 'lucide-react';

type AcademyLanguage = 'en' | 'fr';

interface PromoCodeOption {
  id: string;
  code: string;
  influencer_id?: string | null;
}

interface InfluencerPromo {
  id: string;
  code: string;
}

interface AcademyInfluencer {
  id: string;
  full_name: string;
  email: string;
  instagram_handle?: string | null;
  is_active: boolean;
  must_change_password?: boolean;
  invited_at?: string | null;
  last_invite_sent_at?: string | null;
  last_login?: string | null;
  password_changed_at?: string | null;
  created_at?: string | null;
  promo_code_count?: number;
  promo_codes?: InfluencerPromo[];
}

interface InfluencerSalesSummary {
  approved_count: number;
  approved_revenue_dt: number;
  pending_count: number;
  failed_count: number;
  rejected_count: number;
  total_registrations: number;
  by_formule: Record<string, number>;
  promo_codes: Array<{
    id: string;
    code: string;
    used_count: number;
    max_uses: number;
    active: boolean;
    registrations_count: number;
    approved_count: number;
    approved_revenue_dt: number;
  }>;
}

interface InfluencerRegistrationRow {
  id: string;
  registration_number: string;
  full_name: string;
  email: string;
  phone: string;
  formule: string;
  payment_method: string;
  promo_code: string | null;
  status: string;
  base_amount_dt: number;
  discount_amount_dt: number;
  fee_amount_dt: number;
  total_amount_dt: number;
  created_at: string;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
}

interface InfluencerSalesReport {
  influencer: AcademyInfluencer;
  summary: InfluencerSalesSummary;
  registrations: InfluencerRegistrationRow[];
}

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function formatDt(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatMoney(amount: number) {
  return `${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
}

function formulaLabel(formule: string, isEn: boolean) {
  const map: Record<string, { en: string; fr: string }> = {
    essentielle: { en: 'Essential', fr: 'Essentielle' },
    pro: { en: 'Pro', fr: 'Pro' },
    premium: { en: 'Premium', fr: 'Premium' },
  };
  const row = map[formule];
  return row ? (isEn ? row.en : row.fr) : formule;
}

function paymentLabel(method: string, isEn: boolean) {
  const map: Record<string, { en: string; fr: string }> = {
    card: { en: 'Card', fr: 'Carte' },
    rib: { en: 'RIB', fr: 'RIB' },
    d17: { en: 'D17', fr: 'D17' },
  };
  const row = map[method];
  return row ? (isEn ? row.en : row.fr) : method;
}

function statusLabel(status: string, isEn: boolean) {
  const map: Record<string, { en: string; fr: string }> = {
    approved: { en: 'Approved', fr: 'Approuvé' },
    rejected: { en: 'Rejected', fr: 'Refusé' },
    proof_received: { en: 'Proof received', fr: 'Preuve reçue' },
    pending_payment: { en: 'Pending payment', fr: 'Paiement en attente' },
    pending_online: { en: 'Online pending', fr: 'En ligne en cours' },
    paid_online: { en: 'Paid online', fr: 'Payé en ligne' },
    failed: { en: 'Failed', fr: 'Échoué' },
    cancelled: { en: 'Cancelled', fr: 'Annulé' },
  };
  const row = map[status];
  return row ? (isEn ? row.en : row.fr) : status;
}

function statusDotClass(status: string) {
  if (status === 'approved') return 'bg-green-500';
  if (status === 'rejected' || status === 'failed') return 'bg-red-500';
  if (status === 'proof_received') return 'bg-sky-500';
  if (status === 'pending_payment' || status === 'pending_online') return 'bg-amber-500';
  if (status === 'paid_online') return 'bg-blue-500';
  return 'bg-gray-500';
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

interface AcademyInfluencersSectionProps {
  language: AcademyLanguage;
  promoCodes: PromoCodeOption[];
  onPromoCodesChanged: () => void;
}

export function AcademyInfluencersSection({
  language,
  promoCodes,
  onPromoCodesChanged,
}: AcademyInfluencersSectionProps) {
  const isEn = language === 'en';
  const { toast } = useToast();
  const [influencers, setInfluencers] = useState<AcademyInfluencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademyInfluencer | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReport, setDetailReport] = useState<InfluencerSalesReport | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    is_active: true,
    promo_code_ids: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCERS);
      setInfluencers(data.influencers || []);
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const unassignedPromos = useMemo(
    () => promoCodes.filter((p) => !p.influencer_id || p.influencer_id === editing?.id),
    [promoCodes, editing]
  );

  const openDetail = async (inf: AcademyInfluencer) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailReport(null);
    try {
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCER_SALES(inf.id));
      setDetailReport(data);
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        description: e instanceof Error ? e.message : undefined,
      });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detailReport?.influencer?.id) return;
    setDetailLoading(true);
    try {
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCER_SALES(detailReport.influencer.id));
      setDetailReport(data);
      await load();
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      full_name: '',
      email: '',
      is_active: true,
      promo_code_ids: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (inf: AcademyInfluencer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(inf);
    setForm({
      full_name: inf.full_name,
      email: inf.email,
      is_active: inf.is_active,
      promo_code_ids: (inf.promo_codes || []).map((p) => p.id),
    });
    setDialogOpen(true);
  };

  const togglePromo = (id: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      promo_code_ids: checked
        ? [...f.promo_code_ids, id]
        : f.promo_code_ids.filter((x) => x !== id),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCER(editing.id), {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email,
            is_active: form.is_active,
            promo_code_ids: form.promo_code_ids,
          }),
        });
        toast({ title: isEn ? 'Influencer updated' : 'Influenceur mis à jour' });
      } else {
        const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCERS, {
          method: 'POST',
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email,
            is_active: form.is_active,
            promo_code_ids: form.promo_code_ids,
          }),
        });
        toast({
          title: isEn ? 'Influencer created' : 'Influenceur créé',
          description:
            data.emailSendStatus === 'sent'
              ? isEn
                ? 'Invitation email sent.'
                : 'E-mail d’invitation envoyé.'
              : undefined,
        });
      }
      setDialogOpen(false);
      await load();
      onPromoCodesChanged();
      if (detailReport?.influencer?.id === editing?.id) {
        await refreshDetail();
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCER_RESET_PASSWORD(id), {
        method: 'POST',
      });
      toast({
        title: isEn ? 'Password reset' : 'Mot de passe réinitialisé',
        description:
          data.emailSendStatus === 'sent'
            ? isEn
              ? 'New temporary password emailed.'
              : 'Nouveau mot de passe temporaire envoyé.'
            : undefined,
      });
      load();
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  const resendInvite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCER_RESEND_INVITE(id), {
        method: 'POST',
      });
      toast({
        title: isEn ? 'Invite resent' : 'Invitation renvoyée',
        description:
          data.emailSendStatus === 'sent'
            ? isEn
              ? 'New temporary password emailed.'
              : 'Nouveau mot de passe temporaire envoyé.'
            : undefined,
      });
      load();
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  const summary = detailReport?.summary;
  const influencer = detailReport?.influencer;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {isEn ? 'Refresh' : 'Actualiser'}
          </Button>
          <Button size="sm" onClick={openCreate}>
            {isEn ? 'Create influencer' : 'Créer un influenceur'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size="md" />
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isEn ? 'Name' : 'Nom'}</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>{isEn ? 'Promo codes' : 'Codes promo'}</TableHead>
                <TableHead>{isEn ? 'Last invite' : 'Dernière invitation'}</TableHead>
                <TableHead>{isEn ? 'Last login' : 'Dernière connexion'}</TableHead>
                <TableHead>{isEn ? 'Active' : 'Actif'}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {influencers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    {isEn ? 'No influencers yet.' : 'Aucun influenceur pour le moment.'}
                  </TableCell>
                </TableRow>
              ) : (
                influencers.map((inf) => (
                  <TableRow
                    key={inf.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openDetail(inf)}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1 group">
                        {inf.full_name}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </TableCell>
                    <TableCell>{inf.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(inf.promo_codes || []).map((p) => (
                          <Badge key={p.id} variant="secondary" className="font-mono text-xs">
                            {p.code}
                          </Badge>
                        ))}
                        {!inf.promo_codes?.length && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{formatDt(inf.last_invite_sent_at)}</TableCell>
                    <TableCell className="text-xs">{formatDt(inf.last_login)}</TableCell>
                    <TableCell>
                      <Badge variant={inf.is_active ? 'default' : 'outline'}>
                        {inf.is_active ? (isEn ? 'Yes' : 'Oui') : isEn ? 'No' : 'Non'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={(e) => openEdit(inf, e)}>
                          {isEn ? 'Edit' : 'Modifier'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={(e) => resetPassword(inf.id, e)}>
                          <KeyRound className="h-3 w-3 mr-1" />
                          {isEn ? 'Reset' : 'Réinit.'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={(e) => resendInvite(inf.id, e)}>
                          <Mail className="h-3 w-3 mr-1" />
                          {isEn ? 'Resend' : 'Renvoyer'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {detailLoading && !detailReport ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader size="md" />
              <p className="text-sm text-muted-foreground">
                {isEn ? 'Loading sales report…' : 'Chargement du rapport…'}
              </p>
            </div>
          ) : influencer && summary ? (
            <>
              <SheetHeader className="text-left space-y-1 pr-8">
                <SheetTitle>{influencer.full_name}</SheetTitle>
                <SheetDescription>{influencer.email}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={influencer.is_active ? 'default' : 'outline'}>
                    {influencer.is_active ? (isEn ? 'Active' : 'Actif') : isEn ? 'Inactive' : 'Inactif'}
                  </Badge>
                  {influencer.must_change_password && (
                    <Badge variant="outline">
                      {isEn ? 'Must change password' : 'Doit changer le mot de passe'}
                    </Badge>
                  )}
                  {(influencer.promo_codes || []).map((p) => (
                    <Badge key={p.id} variant="secondary" className="font-mono">
                      {p.code}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{isEn ? 'Created' : 'Créé le'}</p>
                    <p>{formatDt(influencer.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{isEn ? 'Last invite' : 'Dernière invitation'}</p>
                    <p>{formatDt(influencer.last_invite_sent_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{isEn ? 'Last login' : 'Dernière connexion'}</p>
                    <p>{formatDt(influencer.last_login)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{isEn ? 'Password changed' : 'Mot de passe changé'}</p>
                    <p>{formatDt(influencer.password_changed_at)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={refreshDetail} disabled={detailLoading}>
                    <RefreshCw className={cn('h-4 w-4 mr-1', detailLoading && 'animate-spin')} />
                    {isEn ? 'Refresh' : 'Actualiser'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(influencer)}>
                    {isEn ? 'Edit account' : 'Modifier le compte'}
                  </Button>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold mb-3">{isEn ? 'Sales summary' : 'Résumé des ventes'}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <DetailStat
                      label={isEn ? 'Total registrations' : 'Total inscriptions'}
                      value={String(summary.total_registrations)}
                    />
                    <DetailStat
                      label={isEn ? 'Approved sales' : 'Ventes approuvées'}
                      value={String(summary.approved_count)}
                    />
                    <DetailStat
                      label={isEn ? 'Approved revenue' : 'Revenus approuvés'}
                      value={formatMoney(summary.approved_revenue_dt)}
                    />
                    <DetailStat
                      label={isEn ? 'Pending' : 'En attente'}
                      value={String(summary.pending_count)}
                    />
                    <DetailStat
                      label={isEn ? 'Rejected' : 'Refusées'}
                      value={String(summary.rejected_count)}
                    />
                    <DetailStat
                      label={isEn ? 'Failed / cancelled' : 'Échouées / annulées'}
                      value={String(summary.failed_count - summary.rejected_count)}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{isEn ? 'By formula' : 'Par formule'}</h3>
                  <div className="flex flex-wrap gap-2">
                    {(['essentielle', 'pro', 'premium'] as const).map((f) => (
                      <Badge key={f} variant="outline" className="tabular-nums">
                        {formulaLabel(f, isEn)}: {summary.by_formule[f] ?? 0}
                      </Badge>
                    ))}
                  </div>
                </div>

                {summary.promo_codes.length > 0 && (
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isEn ? 'Promo code' : 'Code promo'}</TableHead>
                          <TableHead>{isEn ? 'Uses' : 'Utilisations'}</TableHead>
                          <TableHead>{isEn ? 'Registrations' : 'Inscriptions'}</TableHead>
                          <TableHead>{isEn ? 'Approved' : 'Approuvées'}</TableHead>
                          <TableHead>{isEn ? 'Revenue' : 'Revenus'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.promo_codes.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.code}</TableCell>
                            <TableCell className="text-sm tabular-nums">
                              {p.used_count}/{p.max_uses}
                            </TableCell>
                            <TableCell className="tabular-nums">{p.registrations_count}</TableCell>
                            <TableCell className="tabular-nums">{p.approved_count}</TableCell>
                            <TableCell className="tabular-nums">{formatMoney(p.approved_revenue_dt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    {isEn ? 'All registrations' : 'Toutes les inscriptions'}
                    <span className="text-muted-foreground font-normal ml-2">
                      ({detailReport.registrations.length})
                    </span>
                  </h3>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isEn ? 'Ref' : 'Réf.'}</TableHead>
                          <TableHead>{isEn ? 'Name' : 'Nom'}</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>{isEn ? 'Phone' : 'Tél.'}</TableHead>
                          <TableHead>{isEn ? 'Formula' : 'Formule'}</TableHead>
                          <TableHead>{isEn ? 'Payment' : 'Paiement'}</TableHead>
                          <TableHead>{isEn ? 'Promo' : 'Code'}</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>{isEn ? 'Total' : 'Total'}</TableHead>
                          <TableHead>{isEn ? 'Date' : 'Date'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailReport.registrations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                              {isEn ? 'No registrations for this influencer yet.' : 'Aucune inscription pour cet influenceur.'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          detailReport.registrations.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-mono text-xs">{r.registration_number}</TableCell>
                              <TableCell className="text-sm">{r.full_name}</TableCell>
                              <TableCell className="text-xs">{r.email}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{r.phone}</TableCell>
                              <TableCell className="text-sm">{formulaLabel(r.formule, isEn)}</TableCell>
                              <TableCell className="text-xs">{paymentLabel(r.payment_method, isEn)}</TableCell>
                              <TableCell className="font-mono text-xs">{r.promo_code || '—'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', statusDotClass(r.status))} />
                                  <span className="text-xs whitespace-nowrap">{statusLabel(r.status, isEn)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="tabular-nums text-sm whitespace-nowrap">
                                {formatMoney(r.total_amount_dt)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDt(r.created_at)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? isEn
                  ? 'Edit influencer'
                  : 'Modifier l’influenceur'
                : isEn
                  ? 'Create influencer'
                  : 'Créer un influenceur'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{isEn ? 'Full name' : 'Nom complet'}</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>{isEn ? 'Active account' : 'Compte actif'}</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Assign promo codes' : 'Assigner des codes promo'}</Label>
              <div className="rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto">
                {unassignedPromos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isEn ? 'No promo codes available.' : 'Aucun code promo disponible.'}
                  </p>
                ) : (
                  unassignedPromos.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.promo_code_ids.includes(p.id)}
                        onCheckedChange={(c) => togglePromo(p.id, c === true)}
                      />
                      <span className="font-mono">{p.code}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving
                ? isEn
                  ? 'Saving…'
                  : 'Enregistrement…'
                : editing
                  ? isEn
                    ? 'Save changes'
                    : 'Enregistrer'
                  : isEn
                    ? 'Create & send invite'
                    : 'Créer et envoyer l’invitation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { cn } from '@/lib/utils';
import Loader from '@/components/ui/Loader';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronRight, Copy, Mail, Pencil, RefreshCw, User } from 'lucide-react';
import { AcademyInfluencerResendInviteConfirm } from './AcademyInfluencerResendInviteConfirm';

function maskEmail(email: string) {
  if (!email || !email.includes('@')) return email;
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) {
    return `${localPart}***@${domain}`;
  }
  const visibleStart = localPart.substring(0, 3);
  const visibleEnd = domain.substring(domain.length - 4);
  return `${visibleStart}***@${visibleEnd}`;
}

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

function DetailStat({
  label,
  value,
  highlight,
  compact,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        highlight ? 'border-primary/25 bg-primary/5' : 'border-border/50 bg-card/30',
        compact && 'p-2.5'
      )}
    >
      <p className={cn('text-muted-foreground mb-1', compact ? 'text-[11px]' : 'text-xs')}>
        {label}
      </p>
      <p
        className={cn(
          'font-semibold tabular-nums',
          compact ? 'text-base' : 'text-lg',
          highlight && 'text-primary'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RegistrationMobileCard({
  row,
  isEn,
}: {
  row: InfluencerRegistrationRow;
  isEn: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.full_name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {row.registration_number}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', statusDotClass(row.status))} />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {statusLabel(row.status, isEn)}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <div>
          <p className="text-muted-foreground">{isEn ? 'Formula' : 'Formule'}</p>
          <p className="mt-0.5">{formulaLabel(row.formule, isEn)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{isEn ? 'Payment' : 'Paiement'}</p>
          <p className="mt-0.5">{paymentLabel(row.payment_method, isEn)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Promo</p>
          <p className="mt-0.5 font-mono">{row.promo_code || '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{isEn ? 'Total' : 'Total'}</p>
          <p className="mt-0.5 font-medium tabular-nums">{formatMoney(row.total_amount_dt)}</p>
        </div>
      </div>
      <p className="mt-2.5 truncate text-[11px] text-muted-foreground">{row.email}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDt(row.created_at)}</p>
    </div>
  );
}

const INFLUENCER_SHEET_CLASS =
  'z-[60] flex max-h-[92dvh] flex-col rounded-t-[1.25rem] border-border/50 shadow-[0_-12px_48px_rgba(0,0,0,0.45)]';

interface AcademyInfluencersSectionProps {
  language: AcademyLanguage;
  promoCodes: PromoCodeOption[];
  onPromoCodesChanged: () => void;
}

const influencerListCache: { data: AcademyInfluencer[] | null } = { data: null };
const influencerReportCache = new Map<string, InfluencerSalesReport>();

export function AcademyInfluencersSection({
  language,
  promoCodes,
  onPromoCodesChanged,
}: AcademyInfluencersSectionProps) {
  const isEn = language === 'en';
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [influencers, setInfluencers] = useState<AcademyInfluencer[]>(
    () => influencerListCache.data ?? []
  );
  const [loading, setLoading] = useState(!influencerListCache.data);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademyInfluencer | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReport, setDetailReport] = useState<InfluencerSalesReport | null>(null);
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [resendTarget, setResendTarget] = useState<AcademyInfluencer | null>(null);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const listLoadedRef = useRef(!!influencerListCache.data);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    is_active: true,
    promo_code_ids: [] as string[],
  });

  const load = useCallback(async (options?: { invalidateReports?: boolean; silent?: boolean }) => {
    if (options?.invalidateReports) {
      influencerReportCache.clear();
    }
    if (!options?.silent && !options?.invalidateReports && influencerListCache.data) {
      setInfluencers(influencerListCache.data);
      listLoadedRef.current = true;
      setLoading(false);
      return;
    }
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCERS);
      const list = data.influencers || [];
      influencerListCache.data = list;
      setInfluencers(list);
      listLoadedRef.current = true;
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    if (!listLoadedRef.current) {
      load();
    }
  }, [load]);

  const unassignedPromos = useMemo(
    () => promoCodes.filter((p) => !p.influencer_id || p.influencer_id === editing?.id),
    [promoCodes, editing]
  );

  const cacheReport = (id: string, report: InfluencerSalesReport) => {
    influencerReportCache.set(id, report);
    setDetailReport(report);
  };

  const invalidateReport = (id: string) => {
    influencerReportCache.delete(id);
    setDetailReport((current) => (current?.influencer?.id === id ? null : current));
  };

  const openDetail = async (inf: AcademyInfluencer) => {
    setDetailOpen(true);
    const cached = influencerReportCache.get(inf.id);
    if (cached) {
      setDetailReport(cached);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setDetailReport(null);
    try {
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCER_SALES(inf.id));
      cacheReport(inf.id, data);
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
      const id = detailReport.influencer.id;
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_INFLUENCER_SALES(id));
      cacheReport(id, data);
      await load({ silent: true });
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
      if (editing?.id) {
        invalidateReport(editing.id);
      }
      await load({ silent: !!listLoadedRef.current });
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

  const openResendConfirm = (inf: AcademyInfluencer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setResendTarget(inf);
    setResendConfirmOpen(true);
  };

  const confirmResendInvite = async () => {
    if (!resendTarget) return;
    setResendSubmitting(true);
    try {
      const id = resendTarget.id;
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
      invalidateReport(id);
      await load({ silent: true });
      setResendConfirmOpen(false);
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally {
      setResendSubmitting(false);
    }
  };

  const summary = detailReport?.summary;
  const influencer = detailReport?.influencer;

  const copyEmail = async (email: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
      toast({
        title: isEn ? 'Copied' : 'Copié',
        description: isEn ? 'Email copied to clipboard' : 'Email copié dans le presse-papiers',
      });
    } catch {
      toast({
        variant: 'destructive',
        description: isEn ? 'Failed to copy email' : "Échec de la copie de l'email",
      });
    }
  };

  const editDialogTitle = editing
    ? isEn
      ? 'Edit influencer'
      : 'Modifier l’influenceur'
    : isEn
      ? 'Create influencer'
      : 'Créer un influenceur';

  const saveButtonLabel = saving
    ? isEn
      ? 'Saving…'
      : 'Enregistrement…'
    : editing
      ? isEn
        ? 'Save changes'
        : 'Enregistrer'
      : isEn
        ? 'Create & send invite'
        : 'Créer et envoyer l’invitation';

  const influencerFormFields = (
    <div className="space-y-4">
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
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/20 px-3 py-3">
        <Label>{isEn ? 'Active account' : 'Compte actif'}</Label>
        <Switch
          checked={form.is_active}
          onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c }))}
        />
      </div>
      <div className="space-y-2">
        <Label>{isEn ? 'Assign promo codes' : 'Assigner des codes promo'}</Label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/50 bg-card/10 p-3">
          {unassignedPromos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isEn ? 'No promo codes available.' : 'Aucun code promo disponible.'}
            </p>
          ) : (
            unassignedPromos.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
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
    </div>
  );

  const influencerSaveButton = (
    <Button className="w-full" onClick={save} disabled={saving}>
      {saveButtonLabel}
    </Button>
  );

  const renderDetailMetaGrid = (compact?: boolean) => (
    <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4 gap-3')}>
      <div className="rounded-xl border border-border/50 bg-card/20 px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground sm:text-xs">{isEn ? 'Created' : 'Créé le'}</p>
        <p className="mt-0.5 text-xs sm:text-sm">{formatDt(influencer?.created_at)}</p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card/20 px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground sm:text-xs">
          {isEn ? 'Last invite' : 'Dernière invitation'}
        </p>
        <p className="mt-0.5 text-xs sm:text-sm">{formatDt(influencer?.last_invite_sent_at)}</p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card/20 px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground sm:text-xs">
          {isEn ? 'Last login' : 'Dernière connexion'}
        </p>
        <p className="mt-0.5 text-xs sm:text-sm">{formatDt(influencer?.last_login)}</p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card/20 px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground sm:text-xs">
          {isEn ? 'Password changed' : 'Mot de passe changé'}
        </p>
        <p className="mt-0.5 text-xs sm:text-sm">{formatDt(influencer?.password_changed_at)}</p>
      </div>
    </div>
  );

  const renderDetailBadges = () => (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant={influencer?.is_active ? 'default' : 'outline'}>
        {influencer?.is_active ? (isEn ? 'Active' : 'Actif') : isEn ? 'Inactive' : 'Inactif'}
      </Badge>
      {influencer?.must_change_password && (
        <Badge variant="outline">{isEn ? 'Must change password' : 'Doit changer le mot de passe'}</Badge>
      )}
      {(influencer?.promo_codes || []).map((p) => (
        <Badge key={p.id} variant="secondary" className="font-mono">
          {p.code}
        </Badge>
      ))}
    </div>
  );

  const renderDetailActions = (fullWidth?: boolean) => (
    <div className={cn('flex gap-2', fullWidth && 'w-full')}>
      <Button
        size="sm"
        variant="outline"
        onClick={refreshDetail}
        disabled={detailLoading}
        className={fullWidth ? 'flex-1' : undefined}
      >
        <RefreshCw className={cn('h-4 w-4 mr-1', detailLoading && 'animate-spin')} />
        {isEn ? 'Refresh' : 'Actualiser'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDetailOpen(false);
          if (influencer) openEdit(influencer);
        }}
        className={fullWidth ? 'flex-1' : undefined}
      >
        <Pencil className="h-4 w-4 mr-1" />
        {isEn ? 'Edit account' : 'Modifier le compte'}
      </Button>
    </div>
  );

  const renderSalesSummary = (compact?: boolean) => {
    if (!summary) return null;
    const stats = (
      <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 gap-3')}>
        <DetailStat
          compact={compact}
          label={isEn ? 'Total registrations' : 'Total inscriptions'}
          value={String(summary.total_registrations)}
        />
        <DetailStat
          compact={compact}
          label={isEn ? 'Approved sales' : 'Ventes approuvées'}
          value={String(summary.approved_count)}
        />
        <DetailStat
          compact={compact}
          label={isEn ? 'Approved revenue' : 'Revenus approuvés'}
          value={formatMoney(summary.approved_revenue_dt)}
          highlight
        />
        <DetailStat
          compact={compact}
          label={isEn ? 'Pending' : 'En attente'}
          value={String(summary.pending_count)}
        />
        <DetailStat
          compact={compact}
          label={isEn ? 'Rejected' : 'Refusées'}
          value={String(summary.rejected_count)}
        />
        <DetailStat
          compact={compact}
          label={isEn ? 'Failed / cancelled' : 'Échouées / annulées'}
          value={String(summary.failed_count - summary.rejected_count)}
        />
      </div>
    );

    if (compact) {
      return (
        <div className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isEn ? 'Sales summary' : 'Résumé des ventes'}
          </h3>
          {stats}
        </div>
      );
    }

    return (
      <Card className="border-muted/60 bg-muted/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isEn ? 'Sales summary' : 'Résumé des ventes'}</CardTitle>
        </CardHeader>
        <CardContent>{stats}</CardContent>
      </Card>
    );
  };

  const renderDetailBody = (compact?: boolean) => {
    if (!influencer || !summary || !detailReport) return null;

    return (
      <>
        {renderSalesSummary(compact)}

        <div className={compact ? 'space-y-2' : undefined}>
          <h3 className={cn('font-semibold mb-3', compact ? 'text-xs uppercase tracking-wide text-muted-foreground mb-2' : 'text-sm')}>
            {isEn ? 'By formula' : 'Par formule'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(['essentielle', 'pro', 'premium'] as const).map((f) => (
              <Badge key={f} variant="outline" className="tabular-nums px-3 py-1">
                {formulaLabel(f, isEn)}: {summary.by_formule[f] ?? 0}
              </Badge>
            ))}
          </div>
        </div>

        {summary.promo_codes.length > 0 && (
          <div>
            <h3 className={cn('font-semibold mb-3', compact ? 'text-xs uppercase tracking-wide text-muted-foreground' : 'text-sm')}>
              {isEn ? 'Promo codes' : 'Codes promo'}
            </h3>
            {compact ? (
              <div className="space-y-2">
                {summary.promo_codes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-card/20 px-3 py-2.5 text-sm"
                  >
                    <span className="font-mono text-xs">{p.code}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {p.approved_count} · {formatMoney(p.approved_revenue_dt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
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
          </div>
        )}

        <div>
          <h3 className={cn('font-semibold mb-3', compact ? 'text-xs uppercase tracking-wide text-muted-foreground' : 'text-sm')}>
            {isEn ? 'All registrations' : 'Toutes les inscriptions'}
            <span className="font-normal text-muted-foreground ml-2">
              ({detailReport.registrations.length})
            </span>
          </h3>
          {compact ? (
            <div className="space-y-2">
              {detailReport.registrations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
                  {isEn ? 'No registrations for this influencer yet.' : 'Aucune inscription pour cet influenceur.'}
                </p>
              ) : (
                detailReport.registrations.map((r) => (
                  <RegistrationMobileCard key={r.id} row={r} isEn={isEn} />
                ))
              )}
            </div>
          ) : (
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
          )}
        </div>
      </>
    );
  };

  const detailLoadingState = (
    <div className="flex flex-col items-center justify-center gap-3 py-20 px-6">
      <Loader size="md" />
      <p className="text-sm text-muted-foreground">
        {isEn ? 'Loading sales report…' : 'Chargement du rapport…'}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load({ invalidateReports: true })} disabled={loading}>
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
          <TooltipProvider delayDuration={300}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isEn ? 'Name' : 'Nom'}</TableHead>
                <TableHead className="w-[140px]">Email</TableHead>
                <TableHead>{isEn ? 'Promo codes' : 'Codes promo'}</TableHead>
                <TableHead className="whitespace-nowrap">{isEn ? 'Last invite' : 'Dernière invitation'}</TableHead>
                <TableHead className="whitespace-nowrap">{isEn ? 'Last login' : 'Dernière connexion'}</TableHead>
                <TableHead>{isEn ? 'Active' : 'Actif'}</TableHead>
                <TableHead className="w-[1%]" />
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
                    <TableCell className="max-w-[140px]" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => copyEmail(inf.email, e)}
                        className="group inline-flex max-w-full items-center gap-1.5 rounded px-1 -mx-1 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title={isEn ? 'Click to copy full email' : "Cliquer pour copier l'email"}
                      >
                        <span className="truncate font-mono">{maskEmail(inf.email)}</span>
                        <Copy className="h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                      </button>
                    </TableCell>
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
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-nowrap items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0"
                                onClick={(e) => openEdit(inf, e)}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">{isEn ? 'Edit' : 'Modifier'}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isEn ? 'Edit' : 'Modifier'}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0"
                                onClick={(e) => openResendConfirm(inf, e)}
                              >
                                <Mail className="h-4 w-4" />
                                <span className="sr-only">{isEn ? 'Resend invite' : "Renvoyer l'invitation"}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isEn ? 'Resend invite' : "Renvoyer l'invitation"}</TooltipContent>
                          </Tooltip>
                        </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </TooltipProvider>
        </div>
      )}

      {isMobile ? (
        <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
          <DrawerContent className={INFLUENCER_SHEET_CLASS}>
            {detailLoading && !detailReport ? (
              detailLoadingState
            ) : influencer && summary ? (
              <>
                <DrawerHeader className="space-y-3 px-5 pb-4 pt-1 text-left">
                  <div>
                    <DrawerTitle className="text-lg font-semibold tracking-tight">
                      {influencer.full_name}
                    </DrawerTitle>
                    <DrawerDescription className="mt-1 truncate text-sm">
                      {influencer.email}
                    </DrawerDescription>
                  </div>
                  {renderDetailBadges()}
                  {renderDetailMetaGrid(true)}
                  {renderDetailActions(true)}
                </DrawerHeader>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  {renderDetailBody(true)}
                </div>
              </>
            ) : null}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="w-[min(100%,calc(100vw-1.5rem))] max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
            {detailLoading && !detailReport ? (
              detailLoadingState
            ) : influencer && summary ? (
              <>
                <div className="shrink-0 border-b bg-muted/20 px-6 py-5 pr-12">
                  <DialogHeader className="text-left space-y-2">
                    <DialogTitle className="text-xl flex items-center gap-2">
                      <User className="h-5 w-5 text-primary shrink-0" />
                      {influencer.full_name}
                    </DialogTitle>
                    <DialogDescription className="text-sm">{influencer.email}</DialogDescription>
                  </DialogHeader>

                  <div className="mt-4">{renderDetailBadges()}</div>
                  <div className="mt-4">{renderDetailMetaGrid()}</div>
                  <div className="mt-4">{renderDetailActions()}</div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                  {renderDetailBody()}
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
          <DrawerContent className={INFLUENCER_SHEET_CLASS}>
            <DrawerHeader className="px-5 pb-2 pt-1 text-left">
              <DrawerTitle className="text-base font-semibold tracking-tight">
                {editDialogTitle}
              </DrawerTitle>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
              {influencerFormFields}
            </div>

            <DrawerFooter className="border-t border-border/40 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {influencerSaveButton}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editDialogTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {influencerFormFields}
              {influencerSaveButton}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AcademyInfluencerResendInviteConfirm
        open={resendConfirmOpen}
        onOpenChange={setResendConfirmOpen}
        language={language}
        influencer={resendTarget}
        onConfirm={confirmResendInvite}
        isSubmitting={resendSubmitting}
      />
    </div>
  );
}

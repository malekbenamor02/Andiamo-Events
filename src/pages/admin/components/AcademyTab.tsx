import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { normalizeAcademyPromoCodeInput } from '@/lib/academy/promoCode';
import Loader from '@/components/ui/Loader';
import { ExternalLink, GraduationCap, Mail, RefreshCw } from 'lucide-react';

type AcademyLanguage = 'en' | 'fr';

interface AcademyTabProps {
  language: AcademyLanguage;
}

interface AcademyRegistration {
  id: string;
  registration_number: string;
  full_name: string;
  email: string;
  phone: string;
  formule: string;
  payment_method: string;
  status: string;
  total_amount_dt: number;
  base_amount_dt: number;
  created_at: string;
  rejection_reason?: string | null;
  academy_promo_codes?: { code: string } | null;
}

interface AcademySettings {
  id: string;
  max_approved_total: number;
  page_enabled: boolean;
  disabled_message_en: string | null;
  disabled_message_fr: string | null;
  online_payment_fee_rate?: number;
  approved_count?: number;
  remaining_approved?: number;
}

interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number;
  used_count: number;
  remaining?: number;
  active: boolean;
}

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'default',
  rejected: 'destructive',
  proof_received: 'secondary',
  pending_payment: 'outline',
  pending_online: 'outline',
  paid_online: 'secondary',
  failed: 'destructive',
  cancelled: 'outline',
};

/** Same dot style as Online Orders table (w-3 h-3 rounded-full + tooltip). */
function academyStatusDotClass(status: string): string {
  if (status === 'approved') return 'bg-green-500';
  if (status === 'rejected' || status === 'failed') return 'bg-red-500';
  if (status === 'proof_received') return 'bg-sky-500';
  if (status === 'pending_payment' || status === 'pending_online') return 'bg-amber-500';
  if (status === 'paid_online') return 'bg-blue-500';
  if (status === 'cancelled') return 'bg-gray-500';
  return 'bg-gray-500';
}

function AcademyStatusDot({ status, isEn }: { status: string; isEn: boolean }) {
  const label = academyStatusLabel(status, isEn);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="img"
          aria-label={label}
          className={cn('w-3 h-3 rounded-full cursor-help', academyStatusDotClass(status))}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function academyStatusLabel(status: string, isEn: boolean): string {
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

function academyFormulaLabel(formule: string, isEn: boolean): string {
  const labels: Record<string, { en: string; fr: string }> = {
    essentielle: { en: 'Essential', fr: 'Essentielle' },
    pro: { en: 'Pro', fr: 'Pro' },
    premium: { en: 'Premium', fr: 'Premium' },
  };
  const row = labels[formule];
  return row ? (isEn ? row.en : row.fr) : formule;
}

function academyPaymentLabel(method: string, isEn: boolean): string {
  const labels: Record<string, { en: string; fr: string }> = {
    card: { en: 'Card', fr: 'Carte bancaire' },
    rib: { en: 'Bank transfer (RIB)', fr: 'Virement (RIB)' },
    d17: { en: 'D17', fr: 'D17' },
  };
  const row = labels[method];
  return row ? (isEn ? row.en : row.fr) : method;
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function AcademyTabLoadingPanel({
  message,
  className,
  compact = false,
}: {
  message: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border',
        compact ? 'py-12' : 'py-16',
        className
      )}
    >
      <Loader size="md" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function AcademyTab({ language }: AcademyTabProps) {
  const { toast } = useToast();
  const isEn = language === 'en';
  const [subTab, setSubTab] = useState('registrations');
  const [registrations, setRegistrations] = useState<AcademyRegistration[]>([]);
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [reports, setReports] = useState<{
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    revenue_dt: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AcademyRegistration | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editEmail, setEditEmail] = useState('');
  const [newPromo, setNewPromo] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    max_uses: '',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [regs, sett, promos, rep] = await Promise.all([
        adminFetch(API_ROUTES.ADMIN_ACADEMY_REGISTRATIONS),
        adminFetch(API_ROUTES.ADMIN_ACADEMY_SETTINGS),
        adminFetch(API_ROUTES.ADMIN_ACADEMY_PROMO_CODES),
        adminFetch(API_ROUTES.ADMIN_ACADEMY_REPORTS),
      ]);
      setRegistrations(regs.registrations || []);
      setSettings(sett);
      setPromoCodes(promos.promoCodes || []);
      setReports(rep);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : isEn ? 'Unknown error' : 'Erreur inconnue';
      setLoadError(message);
      toast({
        variant: 'destructive',
        title: isEn ? 'Failed to load Academy data' : 'Échec du chargement Academy',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [isEn, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    let list = registrations;
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.registration_number.toLowerCase().includes(q)
      );
    }
    return list;
  }, [registrations, search, statusFilter]);

  const openDetail = async (reg: AcademyRegistration) => {
    setSelected(reg);
    setEditEmail(reg.email);
    try {
      const data = await adminFetch(API_ROUTES.ADMIN_ACADEMY_REGISTRATION(reg.id));
      setDetail(data.registration);
    } catch {
      setDetail(null);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await adminFetch(API_ROUTES.ADMIN_ACADEMY_REGISTRATION_APPROVE(id), { method: 'POST' });
      toast({ title: isEn ? 'Approved' : 'Approuvé' });
      loadAll();
      setSelected(null);
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await adminFetch(API_ROUTES.ADMIN_ACADEMY_REGISTRATION_REJECT(id), {
        method: 'POST',
        body: JSON.stringify({ reason: '' }),
      });
      toast({ title: isEn ? 'Rejected' : 'Refusé' });
      loadAll();
      setSelected(null);
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      await adminFetch(API_ROUTES.ADMIN_ACADEMY_SETTINGS, {
        method: 'PATCH',
        body: JSON.stringify({
          max_approved_total: settings.max_approved_total,
          page_enabled: settings.page_enabled,
          disabled_message_en: settings.disabled_message_en,
          disabled_message_fr: settings.disabled_message_fr,
          online_payment_fee_rate:
            (Number(settings.online_payment_fee_rate) || 0.05),
        }),
      });
      toast({ title: isEn ? 'Settings saved' : 'Paramètres enregistrés' });
      loadAll();
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  const createPromo = async () => {
    try {
      await adminFetch(API_ROUTES.ADMIN_ACADEMY_PROMO_CODES, {
        method: 'POST',
        body: JSON.stringify({
          code: newPromo.code,
          discount_type: newPromo.discount_type,
          discount_value: Number(newPromo.discount_value),
          max_uses: Number(newPromo.max_uses),
        }),
      });
      setNewPromo({ code: '', discount_type: 'percent', discount_value: '', max_uses: '' });
      loadAll();
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <GraduationCap className="h-7 w-7" />
          Academy
        </h2>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {isEn ? 'Refresh' : 'Actualiser'}
        </Button>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>{isEn ? 'Could not load Academy data' : 'Impossible de charger les données Academy'}</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="registrations">{isEn ? 'Registrations' : 'Inscriptions'}</TabsTrigger>
          <TabsTrigger value="promo">{isEn ? 'Promo codes' : 'Codes promo'}</TabsTrigger>
          <TabsTrigger value="reports">{isEn ? 'Reports' : 'Rapports'}</TabsTrigger>
          <TabsTrigger value="settings">{isEn ? 'Settings' : 'Paramètres'}</TabsTrigger>
        </TabsList>

        <TabsContent value="registrations" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder={isEn ? 'Search name, email, ref…' : 'Rechercher…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
              disabled={loading}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isEn ? 'All statuses' : 'Tous les statuts'}</SelectItem>
                <SelectItem value="proof_received">proof_received</SelectItem>
                <SelectItem value="pending_payment">pending_payment</SelectItem>
                <SelectItem value="pending_online">pending_online</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
                <SelectItem value="paid_online">paid_online</SelectItem>
                <SelectItem value="approved">approved</SelectItem>
                <SelectItem value="rejected">rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border">
            {loading ? (
              <AcademyTabLoadingPanel
                message={isEn ? 'Loading registrations…' : 'Chargement des inscriptions…'}
                className="border-0"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEn ? 'Ref' : 'Réf.'}</TableHead>
                    <TableHead>{isEn ? 'Name' : 'Nom'}</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>{isEn ? 'Formula' : 'Formule'}</TableHead>
                    <TableHead>{isEn ? 'Payment' : 'Paiement'}</TableHead>
                    <TableHead className="text-center w-16">Status</TableHead>
                    <TableHead>{isEn ? 'Total' : 'Total'}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                        {isEn ? 'No registrations found' : 'Aucune inscription trouvée'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.registration_number}</TableCell>
                        <TableCell>{r.full_name}</TableCell>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{academyFormulaLabel(r.formule, isEn)}</TableCell>
                        <TableCell>{academyPaymentLabel(r.payment_method, isEn)}</TableCell>
                        <TableCell className="py-2 text-center">
                          <AcademyStatusDot status={r.status} isEn={isEn} />
                        </TableCell>
                        <TableCell>{Number(r.total_amount_dt).toFixed(2)} DT</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                            {isEn ? 'View' : 'Voir'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="promo" className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl">
            <div className="space-y-1.5">
              <Label htmlFor="academy-promo-code">{isEn ? 'Promo code' : 'Code promo'}</Label>
              <Input
                id="academy-promo-code"
                placeholder={isEn ? 'e.g. SUMMER20' : 'ex. ETE2026'}
                value={newPromo.code}
                onChange={(e) =>
                  setNewPromo((p) => ({ ...p, code: normalizeAcademyPromoCodeInput(e.target.value) }))
                }
                className="uppercase font-mono tracking-wider"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="academy-promo-type">{isEn ? 'Discount type' : 'Type de remise'}</Label>
              <Select
                value={newPromo.discount_type}
                onValueChange={(v) => setNewPromo((p) => ({ ...p, discount_type: v }))}
              >
                <SelectTrigger id="academy-promo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">{isEn ? '% off price' : '% sur le prix'}</SelectItem>
                  <SelectItem value="fixed">{isEn ? 'Fixed DT off' : 'Montant fixe (DT)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="academy-promo-discount">
                {newPromo.discount_type === 'percent'
                  ? isEn
                    ? 'Discount (%)'
                    : 'Remise (%)'
                  : isEn
                    ? 'Discount (DT)'
                    : 'Remise (DT)'}
              </Label>
              <Input
                id="academy-promo-discount"
                type="number"
                min={0}
                step={newPromo.discount_type === 'percent' ? 1 : 0.01}
                placeholder={
                  newPromo.discount_type === 'percent'
                    ? isEn
                      ? 'e.g. 15'
                      : 'ex. 15'
                    : isEn
                      ? 'e.g. 100'
                      : 'ex. 100'
                }
                value={newPromo.discount_value}
                onChange={(e) => setNewPromo((p) => ({ ...p, discount_value: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="academy-promo-max-uses">{isEn ? 'Max redemptions' : 'Utilisations max'}</Label>
              <Input
                id="academy-promo-max-uses"
                type="number"
                min={1}
                step={1}
                placeholder={isEn ? 'e.g. 50' : 'ex. 50'}
                value={newPromo.max_uses}
                onChange={(e) => setNewPromo((p) => ({ ...p, max_uses: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={createPromo} disabled={loading}>
            {isEn ? 'Create code' : 'Créer le code'}
          </Button>
          {loading ? (
            <AcademyTabLoadingPanel
              compact
              message={isEn ? 'Loading promo codes…' : 'Chargement des codes promo…'}
            />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>{isEn ? 'Discount' : 'Remise'}</TableHead>
                <TableHead>{isEn ? 'Used' : 'Utilisé'}</TableHead>
                <TableHead>{isEn ? 'Remaining' : 'Restant'}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoCodes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.code}</TableCell>
                  <TableCell>
                    {p.discount_type === 'percent' ? `${p.discount_value}%` : `${p.discount_value} DT`}
                  </TableCell>
                  <TableCell>
                    {p.used_count} / {p.max_uses}
                  </TableCell>
                  <TableCell>{p.remaining ?? p.max_uses - p.used_count}</TableCell>
                  <TableCell>
                    {p.used_count === 0 ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          await adminFetch(API_ROUTES.ADMIN_ACADEMY_PROMO_CODE(p.id), {
                            method: 'DELETE',
                          });
                          loadAll();
                        }}
                      >
                        {isEn ? 'Delete' : 'Supprimer'}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {isEn ? 'Revoke only' : 'Révoquer seulement'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </TabsContent>

        <TabsContent value="reports">
          {loading ? (
            <AcademyTabLoadingPanel
              message={isEn ? 'Loading reports…' : 'Chargement des rapports…'}
            />
          ) : reports ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{isEn ? 'Total registrations' : 'Total inscriptions'}</p>
                <p className="text-3xl font-bold">{reports.total}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{isEn ? 'Approved' : 'Approuvées'}</p>
                <p className="text-3xl font-bold text-green-600">{reports.approved}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{isEn ? 'Pending' : 'En attente'}</p>
                <p className="text-3xl font-bold">{reports.pending}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{isEn ? 'Revenue (approved)' : 'Revenus (approuvés)'}</p>
                <p className="text-3xl font-bold">{reports.revenue_dt} DT</p>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 max-w-xl">
          {loading ? (
            <AcademyTabLoadingPanel
              message={isEn ? 'Loading settings…' : 'Chargement des paramètres…'}
              className="max-w-xl"
            />
          ) : settings ? (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="academy-page-enabled">
                  {isEn ? 'Academy page open' : 'Page Academy ouverte'}
                </Label>
                <Switch
                  id="academy-page-enabled"
                  checked={settings.page_enabled}
                  onCheckedChange={(c) => setSettings((s) => (s ? { ...s, page_enabled: c } : s))}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEn ? 'Disabled message (EN)' : 'Message fermé (EN)'}</Label>
                <Textarea
                  value={settings.disabled_message_en || ''}
                  onChange={(e) =>
                    setSettings((s) => (s ? { ...s, disabled_message_en: e.target.value } : s))
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEn ? 'Disabled message (FR)' : 'Message fermé (FR)'}</Label>
                <Textarea
                  value={settings.disabled_message_fr || ''}
                  onChange={(e) =>
                    setSettings((s) => (s ? { ...s, disabled_message_fr: e.target.value } : s))
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEn ? 'Max approved registrations' : 'Max inscriptions approuvées'}</Label>
                <Input
                  type="number"
                  value={settings.max_approved_total}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, max_approved_total: parseInt(e.target.value, 10) || 0 } : s
                    )
                  }
                />
                <p className="text-sm text-muted-foreground">
                  {isEn ? 'Approved' : 'Approuvées'}: {settings.approved_count ?? 0} —{' '}
                  {isEn ? 'Remaining' : 'Restantes'}: {settings.remaining_approved ?? 0}
                </p>
              </div>
              <div className="space-y-2">
                <Label>
                  {isEn ? 'Online card processing fee (%)' : 'Frais carte en ligne (%)'}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  step={0.1}
                  value={((settings.online_payment_fee_rate ?? 0.05) * 100).toFixed(2)}
                  onChange={(e) => {
                    const pct = parseFloat(e.target.value);
                    setSettings((s) =>
                      s
                        ? {
                            ...s,
                            online_payment_fee_rate: Number.isFinite(pct)
                              ? Math.min(50, Math.max(0, pct)) / 100
                              : 0.05,
                          }
                        : s
                    );
                  }}
                />
              </div>
              <Button onClick={saveSettings}>{isEn ? 'Save settings' : 'Enregistrer'}</Button>
            </>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hidden">
          {selected && (() => {
            const d = (detail || selected) as AcademyRegistration & {
              discount_amount_dt?: number;
              fee_amount_dt?: number;
              proof_signed_url?: string;
              rejection_reason?: string | null;
              academy_promo_codes?: { code: string } | null;
            };
            const promo = d.academy_promo_codes;
            const createdAt = d.created_at
              ? new Date(d.created_at).toLocaleString(isEn ? 'en-GB' : 'fr-FR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : null;

            return (
              <>
                <DialogHeader className="space-y-3 pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                    <DialogTitle className="font-mono text-lg tracking-tight">
                      {selected.registration_number}
                    </DialogTitle>
                    <Badge variant={(STATUS_COLORS[selected.status] as 'default') || 'outline'}>
                      {academyStatusLabel(selected.status, isEn)}
                    </Badge>
                  </div>
                  {createdAt && (
                    <p className="text-xs text-muted-foreground">
                      {isEn ? 'Registered' : 'Inscrit le'} {createdAt}
                    </p>
                  )}
                </DialogHeader>

                <div className="space-y-5 text-sm pt-2">
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isEn ? 'Participant' : 'Participant'}
                    </h3>
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                      <DetailField label={isEn ? 'Full name' : 'Nom complet'}>
                        <span className="font-medium text-base">{selected.full_name}</span>
                      </DetailField>
                      <DetailField label={isEn ? 'Phone' : 'Téléphone'}>
                        <span className="font-mono">{selected.phone}</span>
                      </DetailField>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isEn ? 'Contact' : 'Contact'}
                    </h3>
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                      <DetailField label="Email">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={async () => {
                              await adminFetch(API_ROUTES.ADMIN_ACADEMY_REGISTRATION(selected.id), {
                                method: 'PATCH',
                                body: JSON.stringify({ email: editEmail }),
                              });
                              toast({ title: isEn ? 'Email updated' : 'E-mail mis à jour' });
                              loadAll();
                            }}
                          >
                            {isEn ? 'Save email' : 'Enregistrer'}
                          </Button>
                        </div>
                      </DetailField>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isEn ? 'Registration' : 'Inscription'}
                    </h3>
                    <div className="rounded-lg border bg-muted/20 p-4 grid grid-cols-2 gap-4">
                      <DetailField label={isEn ? 'Formula' : 'Formule'}>
                        {academyFormulaLabel(selected.formule, isEn)}
                      </DetailField>
                      <DetailField label={isEn ? 'Payment' : 'Paiement'}>
                        {academyPaymentLabel(selected.payment_method, isEn)}
                      </DetailField>
                      {promo?.code && (
                        <DetailField label={isEn ? 'Promo code' : 'Code promo'} className="col-span-2">
                          <span className="font-mono">{promo.code}</span>
                        </DetailField>
                      )}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isEn ? 'Amount' : 'Montant'}
                    </h3>
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{isEn ? 'Base' : 'Base'}</span>
                        <span>{Number(d.base_amount_dt ?? selected.base_amount_dt).toFixed(2)} DT</span>
                      </div>
                      {Number(d.discount_amount_dt ?? 0) > 0 && (
                        <div className="flex justify-between gap-4 text-green-600 dark:text-green-400">
                          <span>{isEn ? 'Discount' : 'Remise'}</span>
                          <span>-{Number(d.discount_amount_dt).toFixed(2)} DT</span>
                        </div>
                      )}
                      {Number(d.fee_amount_dt ?? 0) > 0 && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            {isEn ? 'Online fee' : 'Frais en ligne'}
                          </span>
                          <span>{Number(d.fee_amount_dt).toFixed(2)} DT</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between gap-4 font-semibold text-base">
                        <span>{isEn ? 'Total' : 'Total'}</span>
                        <span>{Number(selected.total_amount_dt).toFixed(2)} DT</span>
                      </div>
                    </div>
                  </section>

                  {d.proof_signed_url && (
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                      <a href={d.proof_signed_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {isEn ? 'View payment proof' : 'Voir la preuve de paiement'}
                      </a>
                    </Button>
                  )}

                  {d.rejection_reason && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                      <p className="text-xs font-medium text-destructive mb-1">
                        {isEn ? 'Rejection reason' : 'Motif de refus'}
                      </p>
                      <p>{d.rejection_reason}</p>
                    </div>
                  )}

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    {['proof_received', 'paid_online', 'pending_payment'].includes(selected.status) && (
                      <Button size="sm" onClick={() => handleApprove(selected.id)}>
                        {isEn ? 'Approve' : 'Approuver'}
                      </Button>
                    )}
                    {selected.status !== 'rejected' && selected.status !== 'approved' && (
                      <Button size="sm" variant="destructive" onClick={() => handleReject(selected.id)}>
                        {isEn ? 'Reject' : 'Refuser'}
                      </Button>
                    )}
                    {selected.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await adminFetch(API_ROUTES.ADMIN_ACADEMY_REGISTRATION_RESEND(selected.id), {
                            method: 'POST',
                            body: JSON.stringify({ template: 'approved' }),
                          });
                          toast({ title: isEn ? 'Email sent' : 'E-mail envoyé' });
                        }}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        {isEn ? 'Resend email' : 'Renvoyer'}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}

export default AcademyTab;

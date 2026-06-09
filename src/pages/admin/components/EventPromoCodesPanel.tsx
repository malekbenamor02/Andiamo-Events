/**
 * Edit Event — Promo codes (UI + drafts aligned with Presale codes in EventsTab).
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl, API_ROUTES } from '@/lib/api-routes';
import { normalizeEventPromoCodeInput } from '@/lib/eventPromo/promoCode';
import type { EventPass } from '../types';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { resolvePromoBadgeColor } from '@/lib/eventPromo/promoOrder';
import { PromoCodeColorBadge } from '@/components/admin/PromoCodeColorBadge';
import { formatEventPromoCodeDiscountSummary } from '@/lib/eventPromo/discountPolicy';
import {
  buildPassDiscountPayload,
  discountEditDraftFromCode,
  emptyPerPassDrafts,
  type EventPromoCodeAdminRow,
  type PromoDiscountEditDraft,
} from '@/lib/eventPromo/discountDraft';
import { AdminPassDiscountFields } from '@/components/admin/AdminPassDiscountFields';
import {
  clearEventPromoCodesPanelCache,
  getEventPromoCodesPanelCache,
  setEventPromoCodesPanelCache,
} from '@/lib/eventPromo/promoCodesPanelCache';
import { ChevronRight, Loader2 } from 'lucide-react';

export type EventPromoCodeRow = EventPromoCodeAdminRow;

export interface EventPromoCodesPanelProps {
  eventId: string;
  language: 'en' | 'fr';
  presaleEnabled?: boolean;
  /** Pass types already loaded for this event (e.g. from Pass stock tab). */
  eventPasses?: EventPass[];
}

export { clearEventPromoCodesPanelCache };

async function adminEventPromoFetch(path: string, init?: RequestInit) {
  const apiBase = getApiBaseUrl();
  const r = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((j as { error?: string }).error || `Request failed (${r.status})`);
  }
  return j;
}

function promoUsagePercent(used: number, max: number): number {
  if (!max) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export function EventPromoCodesPanel({
  eventId,
  language,
  presaleEnabled,
  eventPasses,
}: EventPromoCodesPanelProps) {
  const isEn = language === 'en';
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [codes, setCodes] = React.useState<EventPromoCodeRow[]>([]);
  const [passes, setPasses] = React.useState<EventPass[]>([]);
  const [maxUseDrafts, setMaxUseDrafts] = React.useState<Record<string, string>>({});
  const [expandedPromoCodeId, setExpandedPromoCodeId] = React.useState<string | null>(null);
  const [codeDiscountEditDrafts, setCodeDiscountEditDrafts] = React.useState<
    Record<string, PromoDiscountEditDraft>
  >({});

  const [newPromo, setNewPromo] = React.useState({
    code: '',
    max_uses: '',
    discount_mode: 'uniform' as 'uniform' | 'per_pass',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: '',
    per_pass_discounts: {} as Record<string, { discount_type: 'percent' | 'fixed'; discount_value: string }>,
  });

  const applyCache = React.useCallback((cached: ReturnType<typeof getEventPromoCodesPanelCache>) => {
    if (!cached) return;
    setCodes(cached.codes);
    setPasses(cached.passes);
    setMaxUseDrafts(cached.maxUseDrafts);
    setCodeDiscountEditDrafts(cached.codeDiscountEditDrafts);
  }, []);

  const loadAll = React.useCallback(
    async (options?: { force?: boolean }) => {
      if (!eventId) return;
      if (!options?.force) {
        const cached = getEventPromoCodesPanelCache(eventId);
        if (cached) {
          applyCache(cached);
          return;
        }
      }
      setLoading(true);
      try {
        const codesPromise = adminEventPromoFetch(API_ROUTES.ADMIN_EVENT_PROMO_CODES(eventId));
        let passesPromise: Promise<EventPass[]>;
        if (eventPasses?.length) {
          passesPromise = Promise.resolve(eventPasses);
        } else {
          passesPromise = fetch(`${getApiBaseUrl()}${API_ROUTES.ADMIN_PASSES_FOR_EVENT(eventId)}`, {
            credentials: 'include',
          }).then(async (passesRes) => {
            if (!passesRes.ok) return [];
            const pj = await passesRes.json();
            return (pj.passes || []) as EventPass[];
          });
        }
        const [codesRes, loadedPasses] = await Promise.all([codesPromise, passesPromise]);
        const list = (codesRes.codes || []) as EventPromoCodeRow[];
        const maxDrafts = Object.fromEntries(list.map((c) => [c.id, String(c.max_uses)]));
        const discountDrafts = Object.fromEntries(
          list.map((c) => [c.id, discountEditDraftFromCode(c, loadedPasses)])
        );
        setCodes(list);
        setPasses(loadedPasses);
        setMaxUseDrafts(maxDrafts);
        setCodeDiscountEditDrafts(discountDrafts);
        setEventPromoCodesPanelCache(eventId, {
          codes: list,
          passes: loadedPasses,
          maxUseDrafts: maxDrafts,
          codeDiscountEditDrafts: discountDrafts,
        });
      } catch (e: unknown) {
        toast({
          variant: 'destructive',
          description: e instanceof Error ? e.message : undefined,
        });
      } finally {
        setLoading(false);
      }
    },
    [eventId, eventPasses, toast, applyCache]
  );

  React.useEffect(() => {
    if (!eventId || presaleEnabled) {
      setCodes([]);
      setPasses([]);
      return;
    }
    void loadAll();
  }, [eventId, presaleEnabled, loadAll]);

  React.useEffect(() => {
    if (!passes.length) return;
    setNewPromo((s) => {
      if (Object.keys(s.per_pass_discounts || {}).length > 0) return s;
      return { ...s, per_pass_discounts: emptyPerPassDrafts(passes) };
    });
    setCodeDiscountEditDrafts((prev) => {
      const next = { ...prev };
      for (const c of codes) {
        if (!next[c.id] || Object.keys(next[c.id].per_pass).length === 0) {
          next[c.id] = discountEditDraftFromCode(c, passes);
        }
      }
      return next;
    });
  }, [passes, codes]);

  const createPromo = async () => {
    const code = normalizeEventPromoCodeInput(newPromo.code);
    if (!code) {
      toast({
        variant: 'destructive',
        description: isEn ? 'Enter a valid code (A-Z, 0-9)' : 'Code invalide (A-Z, 0-9)',
      });
      return;
    }
    const maxN = parseInt(String(newPromo.max_uses).trim(), 10);
    if (!Number.isFinite(maxN) || maxN < 1) {
      toast({
        variant: 'destructive',
        description: isEn
          ? 'Max uses is required (integer ≥ 1).'
          : 'Utilisations max obligatoires (entier ≥ 1).',
      });
      return;
    }

    const body: Record<string, unknown> = {
      eventId,
      code,
      discount_mode: newPromo.discount_mode,
      max_uses: maxN,
    };

    if (newPromo.discount_mode === 'per_pass') {
      const pass_discounts = buildPassDiscountPayload(
        'per_pass',
        newPromo.per_pass_discounts
      );
      if (!pass_discounts.length) {
        toast({
          variant: 'destructive',
          description: isEn
            ? 'Set a discount on at least one pass.'
            : 'Définissez une remise sur au moins un pass.',
        });
        return;
      }
      body.pass_discounts = pass_discounts;
    } else {
      const dv = parseFloat(String(newPromo.discount_value).trim());
      if (!Number.isFinite(dv) || dv <= 0) {
        toast({
          variant: 'destructive',
          description: isEn
            ? 'Discount must be greater than 0.'
            : 'La remise doit être > 0.',
        });
        return;
      }
      body.discount_type = newPromo.discount_type;
      body.discount_value = dv;
    }

    try {
      await adminEventPromoFetch(API_ROUTES.ADMIN_EVENT_PROMO_CODES(eventId), {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setNewPromo({
        code: '',
        max_uses: '',
        discount_mode: 'uniform',
        discount_type: 'percent',
        discount_value: '',
        per_pass_discounts: emptyPerPassDrafts(passes),
      });
      toast({ title: isEn ? 'Promo code created' : 'Code promo créé' });
      void loadAll({ force: true });
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  const patchPromo = async (id: string, body: Record<string, unknown>) => {
    await adminEventPromoFetch(API_ROUTES.ADMIN_EVENT_PROMO_CODE(id), {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    void loadAll({ force: true });
  };

  const savePromoDiscountsForCode = async (c: EventPromoCodeRow) => {
    const draft = codeDiscountEditDrafts[c.id];
    if (!draft) return;
    const body: Record<string, unknown> = { discount_mode: draft.discount_mode };
    if (draft.discount_mode === 'per_pass') {
      body.pass_discounts = buildPassDiscountPayload('per_pass', draft.per_pass);
      if (!(body.pass_discounts as unknown[]).length) {
        toast({
          variant: 'destructive',
          description: isEn
            ? 'Set a discount on at least one pass.'
            : 'Définissez une remise sur au moins un pass.',
        });
        return;
      }
    } else {
      const dv = parseFloat(String(draft.discount_value).trim());
      if (!Number.isFinite(dv) || dv <= 0) {
        toast({
          variant: 'destructive',
          description: isEn ? 'Discount must be greater than 0.' : 'La remise doit être > 0.',
        });
        return;
      }
      body.discount_type = draft.discount_type;
      body.discount_value = dv;
    }
    try {
      await adminEventPromoFetch(API_ROUTES.ADMIN_EVENT_PROMO_CODE_DISCOUNTS(c.id), {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast({ title: isEn ? 'Discounts saved' : 'Remises enregistrées' });
      void loadAll({ force: true });
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  const revokePromo = async (id: string) => {
    try {
      await adminEventPromoFetch(API_ROUTES.ADMIN_EVENT_PROMO_CODE(id), { method: 'DELETE' });
      toast({ title: isEn ? 'Code removed' : 'Code supprimé' });
      void loadAll({ force: true });
    } catch (e: unknown) {
      toast({ variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  if (presaleEnabled) {
    return (
      <Card className="border-amber-500/30 bg-muted/20">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {isEn
            ? 'Promo codes are disabled while presale is enabled for this event.'
            : 'Les codes promo sont désactivés tant que la prévente est active pour cet événement.'}
        </CardContent>
      </Card>
    );
  }

  if (!eventId) {
    return (
      <p className="text-sm text-muted-foreground">
        {isEn
          ? 'Save the event first to manage promo codes.'
          : 'Enregistrez l’événement pour gérer les codes promo.'}
      </p>
    );
  }

  return (
    <Card className="border-primary/30 bg-muted/20">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-3 pt-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {isEn ? 'Promo codes' : 'Codes promo'}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void loadAll({ force: true })}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isEn ? (
                'Refresh'
              ) : (
                'Actualiser'
              )}
            </Button>
          </div>

          {loading && codes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {isEn ? 'Loading…' : 'Chargement…'}
            </p>
          ) : codes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {isEn ? 'No promo codes yet.' : 'Aucun code promo.'}
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {codes.map((c) => {
                const isOpen = expandedPromoCodeId === c.id;
                const exhausted = c.used_count >= c.max_uses;
                const pct = promoUsagePercent(c.used_count, c.max_uses);
                const codeColor = resolvePromoBadgeColor({ badge_color: c.badge_color });
                const editDraft = codeDiscountEditDrafts[c.id];
                const canEditDiscounts = c.used_count === 0;

                return (
                  <Collapsible
                    key={c.id}
                    open={isOpen}
                    onOpenChange={(open) =>
                      setExpandedPromoCodeId((prev) => {
                        if (open) return c.id;
                        return prev === c.id ? null : prev;
                      })
                    }
                    className="rounded border border-border/50 bg-background/40 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 p-2 min-h-[2.5rem]">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex flex-1 min-w-0 items-center gap-2 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -m-0.5 p-0.5"
                        >
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                              isOpen && 'rotate-90'
                            )}
                            aria-hidden
                          />
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: codeColor }}
                            aria-hidden
                          />
                          <span className="truncate text-sm font-semibold text-foreground break-all min-w-0 font-mono tracking-wide">
                            {c.code}
                          </span>
                          {!c.is_active ? (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {isEn ? 'Inactive' : 'Inactif'}
                            </Badge>
                          ) : null}
                          {exhausted ? (
                            <Badge variant="destructive" className="text-[10px] shrink-0">
                              {isEn ? 'Exhausted' : 'Épuisé'}
                            </Badge>
                          ) : null}
                        </button>
                      </CollapsibleTrigger>
                      <div
                        className="flex shrink-0 items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          id={`promo-active-${c.id}`}
                          checked={c.is_active}
                          onCheckedChange={(active) => void patchPromo(c.id, { is_active: active })}
                        />
                      </div>
                    </div>

                    <CollapsibleContent className="border-t border-border/50 bg-muted/20 px-3 py-3">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <PromoCodeColorBadge color={codeColor} className="text-[10px] shrink-0">
                            {formatEventPromoCodeDiscountSummary(c, language)}
                          </PromoCodeColorBadge>
                          <span className="text-[10px] text-muted-foreground">
                            {isEn
                              ? 'Discount applied at checkout'
                              : 'Remise appliquée au paiement'}
                          </span>
                        </div>

                        {c.discount_mode === 'per_pass' &&
                          (c.pass_discounts?.length ?? 0) > 0 && (
                            <ul className="space-y-1 rounded-md border border-border/40 bg-background/50 px-2.5 py-2">
                              {c.pass_discounts!.map((pd) => (
                                <li
                                  key={pd.event_pass_id}
                                  className="flex items-center justify-between gap-2 text-[10px]"
                                >
                                  <span className="truncate text-foreground">
                                    {pd.pass_name || pd.event_pass_id}
                                  </span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {pd.discount_type === 'fixed'
                                      ? `${pd.discount_value} TND`
                                      : `${pd.discount_value}%`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                        <div className="rounded-md border border-border/50 bg-background/60 p-2.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {isEn ? 'Redemptions' : 'Utilisations'}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {isEn
                                  ? 'Completed purchases with this code'
                                  : 'Achats finalisés avec ce code'}
                              </p>
                            </div>
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {c.used_count}
                              <span className="text-muted-foreground font-normal">
                                {' / '}
                                {c.max_uses}
                              </span>
                            </p>
                          </div>
                          <div
                            className="h-1.5 rounded-full bg-muted overflow-hidden"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="h-full rounded-full bg-primary/80 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {isEn ? 'Remaining' : 'Reste'}:{' '}
                            {Math.max(0, c.max_uses - c.used_count)}
                          </p>
                        </div>

                        <div className="rounded-md border border-border/50 bg-background/40 p-2.5 space-y-3">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {isEn ? 'Edit caps' : 'Modifier les plafonds'}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto] sm:items-center">
                            <Label
                              htmlFor={`promo-max-${c.id}`}
                              className="text-xs font-normal text-foreground"
                            >
                              {isEn ? 'Max uses' : 'Utilisations max'}
                            </Label>
                            <Input
                              id={`promo-max-${c.id}`}
                              className="h-8 text-xs px-2 sm:col-start-2"
                              inputMode="numeric"
                              min={c.used_count}
                              value={maxUseDrafts[c.id] ?? String(c.max_uses)}
                              onChange={(e) =>
                                setMaxUseDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                              }
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 px-3 text-xs sm:col-start-3"
                              onClick={() => {
                                const n = parseInt(maxUseDrafts[c.id] ?? '', 10);
                                if (!Number.isFinite(n) || n < c.used_count) {
                                  toast({
                                    variant: 'destructive',
                                    description: isEn
                                      ? `Max uses must be ≥ ${c.used_count}`
                                      : `Max ≥ ${c.used_count}`,
                                  });
                                  return;
                                }
                                void patchPromo(c.id, { max_uses: n });
                              }}
                            >
                              {isEn ? 'Save' : 'Enreg.'}
                            </Button>
                          </div>
                        </div>

                        {canEditDiscounts && editDraft ? (
                          <div className="rounded-md border border-border/50 bg-background/40 p-2.5 space-y-3">
                            <AdminPassDiscountFields
                              language={language}
                              passes={passes}
                              passesLoading={loading && !passes.length}
                              discountMode={editDraft.discount_mode}
                              onDiscountModeChange={(mode) =>
                                setCodeDiscountEditDrafts((prev) => ({
                                  ...prev,
                                  [c.id]: {
                                    ...prev[c.id],
                                    discount_mode: mode,
                                    per_pass:
                                      mode === 'per_pass'
                                        ? emptyPerPassDrafts(passes)
                                        : prev[c.id].per_pass,
                                  },
                                }))
                              }
                              uniformType={editDraft.discount_type}
                              uniformValue={editDraft.discount_value}
                              onUniformTypeChange={(t) =>
                                setCodeDiscountEditDrafts((prev) => ({
                                  ...prev,
                                  [c.id]: { ...prev[c.id], discount_type: t },
                                }))
                              }
                              onUniformValueChange={(v) =>
                                setCodeDiscountEditDrafts((prev) => ({
                                  ...prev,
                                  [c.id]: { ...prev[c.id], discount_value: v },
                                }))
                              }
                              perPass={editDraft.per_pass}
                              onPerPassChange={(passId, patch) =>
                                setCodeDiscountEditDrafts((prev) => ({
                                  ...prev,
                                  [c.id]: {
                                    ...prev[c.id],
                                    per_pass: {
                                      ...prev[c.id].per_pass,
                                      [passId]: {
                                        ...prev[c.id].per_pass[passId],
                                        ...patch,
                                      },
                                    },
                                  },
                                }))
                              }
                              variant="edit"
                              idPrefix={`promo-edit-${c.id}`}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 px-3 text-xs"
                              onClick={() => void savePromoDiscountsForCode(c)}
                            >
                              {isEn ? 'Save discounts' : 'Enreg. remises'}
                            </Button>
                          </div>
                        ) : null}

                        {c.used_count === 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => void revokePromo(c.id)}
                          >
                            {isEn ? 'Remove code' : 'Supprimer le code'}
                          </Button>
                        ) : null}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-border/60">
            <Input
              placeholder={isEn ? 'Code name' : 'Nom du code'}
              className="uppercase font-mono tracking-wide"
              value={newPromo.code}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) =>
                setNewPromo((p) => ({ ...p, code: normalizeEventPromoCodeInput(e.target.value) }))
              }
            />
            <Input
              inputMode="numeric"
              placeholder={
                isEn ? 'Max uses (required)' : 'Utilisations max (obligatoire)'
              }
              value={newPromo.max_uses}
              onChange={(e) => setNewPromo((p) => ({ ...p, max_uses: e.target.value }))}
            />

            <AdminPassDiscountFields
              language={language}
              passes={passes}
              passesLoading={loading && !passes.length}
              discountMode={newPromo.discount_mode}
              onDiscountModeChange={(mode) =>
                setNewPromo((p) => ({
                  ...p,
                  discount_mode: mode,
                  per_pass_discounts:
                    mode === 'per_pass' ? emptyPerPassDrafts(passes) : p.per_pass_discounts,
                }))
              }
              uniformType={newPromo.discount_type}
              uniformValue={newPromo.discount_value}
              onUniformTypeChange={(t) =>
                setNewPromo((p) => ({ ...p, discount_type: t }))
              }
              onUniformValueChange={(v) =>
                setNewPromo((p) => ({ ...p, discount_value: v }))
              }
              perPass={newPromo.per_pass_discounts}
              onPerPassChange={(passId, patch) =>
                setNewPromo((p) => ({
                  ...p,
                  per_pass_discounts: {
                    ...p.per_pass_discounts,
                    [passId]: { ...p.per_pass_discounts[passId], ...patch },
                  },
                }))
              }
              variant="create"
              idPrefix="promo-new"
            />

            <Button
              type="button"
              size="sm"
              disabled={!newPromo.code.trim() || loading}
              onClick={() => void createPromo()}
            >
              {isEn ? 'Add code' : 'Ajouter code'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Admin Dashboard — Events tab (event list, add/edit dialog, pass management).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/ui/file-upload";
import { Plus, Edit, Trash2, Save, X, Image, Video, Upload, Package, Calendar as CalendarIcon, MapPin, DollarSign, ArrowLeft, Loader2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getApiBaseUrl, API_ROUTES } from "@/lib/api-routes";
import type { Event, EventPass } from "../types";
import { formatDateDMY, toDatetimeLocalValue } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface EventsTabProps {
  language: "en" | "fr";
  t: Record<string, string>;
  events: Event[];
  editingEvent: Event | null;
  setEditingEvent: (e: Event | null | ((prev: Event | null) => Event | null)) => void;
  isEventDialogOpen: boolean;
  setIsEventDialogOpen: (v: boolean) => void;
  /** True while poster / gallery / presale video uploads run on save */
  eventSaveBusy?: boolean;
  pendingGalleryImages: File[];
  setPendingGalleryImages: (f: File[]) => void;
  pendingGalleryVideos: File[];
  setPendingGalleryVideos: (f: File[]) => void;
  passValidationErrors: Record<number, { name?: string; price?: string; description?: string }>;
  setPassValidationErrors: (v: Record<number, { name?: string; price?: string; description?: string }>) => void;
  handleSaveEvent: (event: Event, uploadedFile?: File | null) => Promise<boolean>;
  handleGalleryFileSelect: (files: File[], type: 'images' | 'videos') => void;
  removeGalleryFile: (index: number, type: 'images' | 'videos') => void;
  removePendingGalleryFile: (index: number, type: 'images' | 'videos') => void;
  isPassManagementDialogOpen: boolean;
  setIsPassManagementDialogOpen: (v: boolean) => void;
  eventForPassManagement: Event | null;
  setEventForPassManagement: (e: Event | null) => void;
  passesForManagement: EventPass[];
  setPassesForManagement: (p: EventPass[]) => void;
  selectedPassForSettings: EventPass | null;
  setSelectedPassForSettings: (p: EventPass | null) => void;
  newPassForm: { name: string; price: number; description: string; is_primary: boolean; max_quantity: number; allowed_payment_methods: string[] } | null;
  setNewPassForm: (f: { name: string; price: number; description: string; is_primary: boolean; max_quantity: number; allowed_payment_methods: string[] } | null) => void;
  setConfirmDelete: (t: { kind: 'delete-pass'; passId: string; passName: string; eventId: string } | null) => void;
  isPassManagementLoading: boolean;
  setIsPassManagementLoading: (v: boolean) => void;
  handleDeleteEvent: (eventId: string) => void;
}

type PresaleCodeRow = {
  id: string;
  label: string | null;
  usage_mode: string;
  discount_type: string;
  discount_value: number;
  max_total_redemptions: number | null;
  paused_at: string | null;
  revoked_at: string | null;
  successful_order_count: number | null;
};

function parsePresaleLabelFromApiRow(row: Record<string, unknown>): string | null {
  const v = row.label ?? row.Label;
  if (v == null) return null;
  const s = String(v).trim();
  return s !== "" ? s : null;
}

function mergePresaleCodeRows(
  prev: PresaleCodeRow[],
  raw: Record<string, unknown>[],
  labelHints: Record<string, string>
): PresaleCodeRow[] {
  const prevById = new Map(prev.map((c) => [c.id, c]));
  return raw.map((row) => {
    const id = String(row.id ?? "");
    let label = parsePresaleLabelFromApiRow(row);
    if (!label) {
      const hint = (labelHints[id] ?? "").trim();
      if (hint) label = hint;
    }
    if (!label) {
      const keep = (prevById.get(id)?.label ?? "").trim();
      if (keep) label = keep;
    }
    return {
      id,
      label,
      usage_mode: String(row.usage_mode ?? ""),
      discount_type: String(row.discount_type ?? ""),
      discount_value: Number(row.discount_value) || 0,
      max_total_redemptions:
        row.max_total_redemptions != null ? Number(row.max_total_redemptions) : null,
      paused_at: row.paused_at != null ? String(row.paused_at) : null,
      revoked_at: row.revoked_at != null ? String(row.revoked_at) : null,
      successful_order_count:
        row.successful_order_count != null ? Number(row.successful_order_count) : null,
    };
  });
}

function presaleApiErrorMessage(body: Record<string, unknown>, fallback: string): string {
  const m = typeof body.message === "string" ? body.message.trim() : "";
  const e = typeof body.error === "string" ? body.error.trim() : "";
  return m || e || fallback;
}

/** Buyer-facing presale string stored in `label` (set when the code is created). */
function presaleCodeDisplayName(c: PresaleCodeRow, language: "en" | "fr"): string {
  const t = (c.label ?? "").trim();
  if (t) return t;
  return language === "en" ? "—" : "—";
}

async function postPresaleMaxRedemptions(codeId: string, max: number) {
  const apiBase = getApiBaseUrl();
  const r = await fetch(`${apiBase}${API_ROUTES.ADMIN_PRESALE_CODE_MAX_REDEMPTIONS(codeId)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_total_redemptions: max }),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(presaleApiErrorMessage(j, "Update failed"));
}

export function EventsTab(p: EventsTabProps) {
  const { toast } = useToast();
  const [editEventTab, setEditEventTab] = React.useState<"details" | "presale" | "pass-stock" | "promo-codes">("details");
  const [presaleCodes, setPresaleCodes] = React.useState<PresaleCodeRow[]>([]);
  const [presaleCodesLoading, setPresaleCodesLoading] = React.useState(false);
  const [expandedPresaleCodeId, setExpandedPresaleCodeId] = React.useState<string | null>(null);
  const [codeMaxDrafts, setCodeMaxDrafts] = React.useState<Record<string, string>>({});
  const [openingEditEventId, setOpeningEditEventId] = React.useState<string | null>(null);
  /** Only the latest `loadPresaleCodes` result may update state (avoids stale responses wiping a freshly added row). */
  const presaleCodesFetchGenRef = React.useRef(0);
  /** Plaintext label for a row we just created, until GET returns it from the DB. */
  const presaleLabelHintByIdRef = React.useRef<Record<string, string>>({});
  const newPassFormScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [newPresale, setNewPresale] = React.useState({
    code: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: "",
    max_total_redemptions: "",
  });

  const EVENT_TIME_MINUTE_STEP = 5;
  const EVENT_TIME_MINUTES = Array.from({ length: 60 / EVENT_TIME_MINUTE_STEP }, (_, i) =>
    String(i * EVENT_TIME_MINUTE_STEP).padStart(2, "0")
  );
  const EVENT_TIME_HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, "0"));

  function parseEditingEventLocalDate(value: string | null | undefined): Date | null {
    const s = (value ?? "").trim();
    if (!s) return null;
    // Accept datetime-local and ISO strings.
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatLocalDateTimeLabel(d: Date | null, language: "en" | "fr"): string {
    if (!d) return language === "en" ? "Pick date & time" : "Choisir date & heure";
    const dd = formatDateDMY(d, language);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${dd} ${hh}:${mm}`;
  }

  function applyLocalDateParts(prev: Date | null, nextDay: Date, hour24: number, minute: number): Date {
    const base = prev && !isNaN(prev.getTime()) ? prev : new Date();
    return new Date(
      nextDay.getFullYear(),
      nextDay.getMonth(),
      nextDay.getDate(),
      hour24,
      minute,
      0,
      0
    );
  }

  const loadPresaleCodes = React.useCallback(
    async (eventId: string) => {
      const gen = ++presaleCodesFetchGenRef.current;
      setPresaleCodesLoading(true);
      try {
        const apiBase = getApiBaseUrl();
        const r = await fetch(`${apiBase}${API_ROUTES.ADMIN_PRESALE_CODES(eventId)}`, {
          credentials: "include",
        });
        const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        if (!r.ok) throw new Error(presaleApiErrorMessage(j, "Failed to load codes"));
        if (gen !== presaleCodesFetchGenRef.current) {
          return;
        }
        const raw = j.codes || [];
        setPresaleCodes((prev) => {
          if (gen !== presaleCodesFetchGenRef.current) {
            return prev;
          }
          const hintSnap = { ...presaleLabelHintByIdRef.current };
          const merged = mergePresaleCodeRows(prev, raw, hintSnap);
          for (const c of merged) {
            if ((c.label ?? "").trim() && presaleLabelHintByIdRef.current[c.id]) {
              delete presaleLabelHintByIdRef.current[c.id];
            }
          }
          setCodeMaxDrafts(
            Object.fromEntries(merged.map((c) => [c.id, String(c.max_total_redemptions ?? "")]))
          );
          return merged;
        });
      } catch (e: unknown) {
        console.error(e);
        toast({
          title: p.t.error,
          description: e instanceof Error ? e.message : "Failed to load presale codes",
          variant: "destructive",
        });
      } finally {
        if (gen === presaleCodesFetchGenRef.current) {
          setPresaleCodesLoading(false);
        }
      }
    },
    [p.t.error, toast]
  );

  React.useEffect(() => {
    if (!p.isEventDialogOpen || !p.editingEvent?.id || !p.editingEvent.presale_enabled) {
      setPresaleCodes([]);
      setCodeMaxDrafts({});
      setExpandedPresaleCodeId(null);
      presaleLabelHintByIdRef.current = {};
      return;
    }
    void loadPresaleCodes(p.editingEvent.id);
  }, [p.isEventDialogOpen, p.editingEvent?.id, p.editingEvent?.presale_enabled, loadPresaleCodes]);

  React.useEffect(() => {
    if (p.isEventDialogOpen) setOpeningEditEventId(null);
  }, [p.isEventDialogOpen]);

  const loadPassStockForEvent = React.useCallback(
    async (eventId: string) => {
      p.setIsPassManagementLoading(true);
      try {
        const apiBase = getApiBaseUrl();
        const passesResponse = await fetch(`${apiBase}/api/admin/passes/${eventId}`, {
          credentials: "include",
        });
        if (passesResponse.ok) {
          const passesResult = await passesResponse.json();
          const passesWithStock = (passesResult.passes || []).map((pp: any) => ({
            id: pp.id,
            name: pp.name || "",
            price: typeof pp.price === "number" ? pp.price : (pp.price ? parseFloat(pp.price) : 0),
            description: pp.description || "",
            is_primary: pp.is_primary || false,
            max_quantity: pp.max_quantity,
            sold_quantity: pp.sold_quantity || 0,
            remaining_quantity: pp.remaining_quantity,
            is_unlimited: pp.is_unlimited || false,
            is_active: pp.is_active !== undefined ? pp.is_active : true,
            is_sold_out: pp.is_sold_out || false,
            allowed_payment_methods: pp.allowed_payment_methods || null,
            sold_by_payment_method: pp.sold_by_payment_method || null,
          }));
          p.setPassesForManagement(passesWithStock);
        } else {
          toast({
            title: p.t.error,
            description: p.language === "en" ? "Failed to load passes" : "Échec du chargement des passes",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        toast({
          title: p.t.error,
          description:
            error?.message || (p.language === "en" ? "Failed to load passes" : "Échec du chargement des passes"),
          variant: "destructive",
        });
      } finally {
        p.setIsPassManagementLoading(false);
      }
    },
    [p, toast]
  );

  React.useEffect(() => {
    if (!p.isEventDialogOpen) return;
    if (editEventTab !== "pass-stock") return;
    if (!p.editingEvent?.id) return;
    p.setEventForPassManagement(p.editingEvent);
    void loadPassStockForEvent(p.editingEvent.id);
  }, [p.isEventDialogOpen, editEventTab, p.editingEvent?.id]);

  return (
    <TabsContent value="events" className="space-y-6">
      <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gradient-neon">Events Management</h2>
                  <Dialog open={p.isEventDialogOpen} onOpenChange={p.setIsEventDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          // Initialize with empty passes and default event_type - admin must add at least one pass
                          p.setEditingEvent({
                            passes: [],
                            event_type: 'upcoming',
                            event_status: 'active',
                            presale_enabled: false,
                            presale_active_from: null,
                            presale_active_until: null,
                            presale_hide_from_public_list: false,
                          } as Event);
                          // Clear pending files and validation errors when opening dialog
                          p.setPendingGalleryImages([]);
                          p.setPendingGalleryVideos([]);
                          p.setPassValidationErrors({});
                          p.setIsEventDialogOpen(true);
                          setEditEventTab("details");
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {p.t.add}
                      </Button>
                    </DialogTrigger>
                    <DialogContent
                      className={cn(
                        "max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-hidden event-edit-dialog rounded-2xl",
                        "[&_input]:transition-none [&_textarea]:transition-none [&_[role=combobox]]:transition-none"
                      )}
                      translate="no"
                    >
                      <DialogHeader>
                        <DialogTitle>
                          {p.editingEvent?.id ? 'Edit Event' : 'Add New Event'}
                        </DialogTitle>
                      </DialogHeader>
                      <Tabs value={editEventTab} onValueChange={(v) => setEditEventTab(v as any)} className="w-full">
                        <TabsList
                          className={cn(
                            "w-full justify-start bg-muted/50 border border-border/30",
                            // Mobile: horizontally scrollable pills (hide scrollbar but keep scrolling)
                            "overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hidden",
                            "gap-1 h-auto p-1 flex flex-nowrap",
                            // Desktop: full-width, evenly spaced tabs
                            "sm:overflow-x-visible sm:whitespace-normal sm:grid sm:grid-cols-4 sm:justify-stretch"
                          )}
                        >
                          <TabsTrigger value="details" className="shrink-0 px-2.5 py-1.5 text-xs sm:text-sm sm:w-full">
                            {p.language === "en" ? "Details" : "Détails"}
                          </TabsTrigger>
                          <TabsTrigger value="presale" className="shrink-0 px-2.5 py-1.5 text-xs sm:text-sm sm:w-full">
                            {p.language === "en" ? "Presale" : "Prévente"}
                          </TabsTrigger>
                          <TabsTrigger value="pass-stock" className="shrink-0 px-2.5 py-1.5 text-xs sm:text-sm sm:w-full">
                            {p.language === "en" ? "Pass stock" : "Stock passes"}
                          </TabsTrigger>
                          <TabsTrigger value="promo-codes" className="shrink-0 px-2.5 py-1.5 text-xs sm:text-sm sm:w-full">
                            {p.language === "en" ? "Promo codes" : "Codes promo"}
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="space-y-6 mt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="eventName">{p.t.eventName}</Label>
                            <Input
                              id="eventName"
                              value={p.editingEvent?.name || ''}
                              onChange={(e) => p.setEditingEvent(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="eventDate">{p.t.eventDate}</Label>
                            {(() => {
                              const local = parseEditingEventLocalDate(p.editingEvent?.date);
                              const initialHours24 = local ? local.getHours() : 21;
                              const initialMinutes = local ? local.getMinutes() : 0;
                              const initialIsPm = initialHours24 >= 12;
                              const initialHour12 = ((initialHours24 + 11) % 12) + 1; // 1..12

                              const hour12Str = String(initialHour12).padStart(2, "0");
                              const minuteStr = String(Math.round(initialMinutes / EVENT_TIME_MINUTE_STEP) * EVENT_TIME_MINUTE_STEP)
                                .padStart(2, "0")
                                .replace("60", "55");
                              const ampmStr = initialIsPm ? "PM" : "AM";

                              const [open, setOpen] = React.useState(false);
                              const [hour12, setHour12] = React.useState(hour12Str);
                              const [minute, setMinute] = React.useState(minuteStr);
                              const [ampm, setAmpm] = React.useState<"AM" | "PM">(ampmStr as "AM" | "PM");

                              const currentLocal = parseEditingEventLocalDate(p.editingEvent?.date);
                              const selectedDay = currentLocal ?? undefined;

                              const toHour24 = (h12: string, mer: "AM" | "PM") => {
                                const h = Math.min(12, Math.max(1, parseInt(h12, 10) || 12));
                                if (mer === "AM") return h === 12 ? 0 : h;
                                return h === 12 ? 12 : h + 12;
                              };

                              const push = (nextDay: Date) => {
                                const h24 = toHour24(hour12, ampm);
                                const min = Math.min(59, Math.max(0, parseInt(minute, 10) || 0));
                                const next = applyLocalDateParts(currentLocal, nextDay, h24, min);
                                p.setEditingEvent((prev) => ({ ...prev, date: toDatetimeLocalValue(next) }));
                              };

                              return (
                                <div className="space-y-2">
                                  <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(
                                          "w-full justify-between font-normal",
                                          !currentLocal && "text-muted-foreground"
                                        )}
                                      >
                                        <span className="truncate">{formatLocalDateTimeLabel(currentLocal, p.language)}</span>
                                        <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-3" align="start">
                                      <div className="space-y-3">
                                        <Calendar
                                          mode="single"
                                          selected={selectedDay}
                                          onSelect={(day) => {
                                            if (!day) return;
                                            push(day);
                                          }}
                                          initialFocus
                                        />
                                        <div className="grid grid-cols-3 gap-2">
                                          <Select
                                            value={hour12}
                                            onValueChange={(v) => {
                                              setHour12(v);
                                              if (!currentLocal) return;
                                              push(currentLocal);
                                            }}
                                          >
                                            <SelectTrigger className="h-9">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {EVENT_TIME_HOURS_12.map((h) => (
                                                <SelectItem key={h} value={h}>
                                                  {h}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>

                                          <Select
                                            value={minute}
                                            onValueChange={(v) => {
                                              setMinute(v);
                                              if (!currentLocal) return;
                                              push(currentLocal);
                                            }}
                                          >
                                            <SelectTrigger className="h-9">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {EVENT_TIME_MINUTES.map((m) => (
                                                <SelectItem key={m} value={m}>
                                                  {m}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>

                                          <Select
                                            value={ampm}
                                            onValueChange={(v) => {
                                              const next = (v === "PM" ? "PM" : "AM") as "AM" | "PM";
                                              setAmpm(next);
                                              if (!currentLocal) return;
                                              push(currentLocal);
                                            }}
                                          >
                                            <SelectTrigger className="h-9">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="AM">AM</SelectItem>
                                              <SelectItem value="PM">PM</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              p.setEditingEvent((prev) => ({ ...prev, date: "" }));
                                              setOpen(false);
                                            }}
                                          >
                                            {p.language === "en" ? "Clear" : "Vider"}
                                          </Button>
                                          <Button type="button" size="sm" onClick={() => setOpen(false)}>
                                            {p.language === "en" ? "Done" : "OK"}
                                          </Button>
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="eventVenue">{p.t.eventVenue}</Label>
                            <Input
                              id="eventVenue"
                              value={p.editingEvent?.venue || ''}
                              onChange={(e) => p.setEditingEvent(prev => ({ ...prev, venue: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="eventCity">{p.t.eventCity}</Label>
                            <Input
                              id="eventCity"
                              value={p.editingEvent?.city || ''}
                              onChange={(e) => p.setEditingEvent(prev => ({ ...prev, city: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="eventDescription">{p.t.eventDescription}</Label>
                          <Textarea
                            id="eventDescription"
                            value={p.editingEvent?.description || ''}
                            onChange={(e) => p.setEditingEvent(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="eventLifecycle">{p.t.eventStatus}</Label>
                          <Select
                            value={
                              p.editingEvent?.event_status === "cancelled"
                                ? "cancelled"
                                : p.editingEvent?.event_status === "completed"
                                  ? "completed"
                                  : "active"
                            }
                            onValueChange={(value: "active" | "completed" | "cancelled") => {
                              p.setEditingEvent((prev) => {
                                if (!prev) return prev;
                                if (value === "completed") {
                                  return { ...prev, event_status: "completed", event_type: "gallery" };
                                }
                                if (value === "active") {
                                  return {
                                    ...prev,
                                    event_status: "active",
                                    event_type:
                                      prev.event_type === "gallery"
                                        ? "upcoming"
                                        : prev.event_type || "upcoming",
                                  };
                                }
                                return { ...prev, event_status: "cancelled" };
                              });
                            }}
                          >
                            <SelectTrigger id="eventLifecycle">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">{p.t.eventStatusActive}</SelectItem>
                              <SelectItem value="completed">{p.t.eventStatusCompleted}</SelectItem>
                              <SelectItem value="cancelled">{p.t.eventStatusCancelled}</SelectItem>
                            </SelectContent>
                          </Select>
                          {p.editingEvent?.event_status === "completed" && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {p.t.eventStatusCompletedHint}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="eventType">{p.t.eventType}</Label>
                          <Select
                            value={
                              p.editingEvent?.event_status === "completed"
                                ? "gallery"
                                : p.editingEvent?.event_type || "upcoming"
                            }
                            disabled={p.editingEvent?.event_status === "completed"}
                            onValueChange={(value: "upcoming" | "gallery") =>
                              p.setEditingEvent((prev) => (prev ? { ...prev, event_type: value } : prev))
                            }
                          >
                            <SelectTrigger id="eventType">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upcoming">{p.t.eventTypeUpcoming}</SelectItem>
                              <SelectItem value="gallery">{p.t.eventTypeGallery}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{p.t.eventPoster}</Label>
                          <FileUpload
                            onFileSelect={(file) => p.setEditingEvent(prev => ({ ...prev, _uploadFile: file }))}
                            onUrlChange={(url) => p.setEditingEvent(prev => ({ ...prev, poster_url: url }))}
                            currentUrl={p.editingEvent?.poster_url}
                            accept="image/*"
                          />
                        </div>
                        {/* Gallery Images & Videos — gallery type or completed (recap) */}
                        {(p.editingEvent?.event_type === "gallery" ||
                          p.editingEvent?.event_status === "completed") && (
                          <div className="space-y-6 border-t pt-6">
                            {/* Gallery Images Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-lg font-semibold flex items-center gap-2">
                                  <Image className="w-5 h-5" />
                                  {p.t.galleryImages}
                                </Label>
                                <div className="relative">
                                  <input
                                    type="file"
                                    id="gallery-images-upload"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (files.length > 0) {
                                        p.handleGalleryFileSelect(files, 'images');
                                      }
                                      // Reset input
                                      e.target.value = '';
                                    }}
                                    className="hidden"
                                  />
                                  <Label
                                    htmlFor="gallery-images-upload"
                                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                  >
                                    <Upload className="w-4 h-4" />
                                    {p.t.addGalleryFile}
                                  </Label>
                                </div>
                              </div>
                              {/* Existing uploaded images */}
                              {p.editingEvent?.gallery_images && p.editingEvent.gallery_images.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {p.language === 'en' ? 'Uploaded Images' : 'Images téléversées'}
                                  </Label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {p.editingEvent.gallery_images.map((url, index) => (
                                      <div key={`uploaded-${index}`} className="relative group">
                                        <img
                                          src={url}
                                          alt={`Gallery image ${index + 1}`}
                                          className="w-full h-32 object-cover rounded-lg border border-border"
                                        />
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => p.removeGalleryFile(index, 'images')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Pending images (to be uploaded on save) */}
                              {p.pendingGalleryImages.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {p.language === 'en' ? `Pending Images (${p.pendingGalleryImages.length}) - Will upload on save` : `Images en attente (${p.pendingGalleryImages.length}) - Téléversées lors de l'enregistrement`}
                                  </Label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {p.pendingGalleryImages.map((file, index) => (
                                      <div key={`pending-${index}`} className="relative group">
                                        <img
                                          src={URL.createObjectURL(file)}
                                          alt={`Pending image ${index + 1}`}
                                          className="w-full h-32 object-cover rounded-lg border border-dashed border-primary"
                                        />
                                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Badge variant="secondary" className="text-xs">
                                            {p.language === 'en' ? 'Pending' : 'En Attente'}
                                          </Badge>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => p.removePendingGalleryFile(index, 'images')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(!p.editingEvent?.gallery_images || p.editingEvent.gallery_images.length === 0) && p.pendingGalleryImages.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  {p.language === 'en' 
                                    ? 'No gallery images. Select images to upload when you save.' 
                                    : "Aucune image de galerie. Sélectionnez des images à téléverser lors de l'enregistrement."}
                                </p>
                              )}
                            </div>

                            {/* Gallery Videos Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-lg font-semibold flex items-center gap-2">
                                  <Video className="w-5 h-5" />
                                  {p.t.galleryVideos}
                                </Label>
                                <div className="relative">
                                  <input
                                    type="file"
                                    id="gallery-videos-upload"
                                    multiple
                                    accept="video/*"
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (files.length > 0) {
                                        p.handleGalleryFileSelect(files, 'videos');
                                      }
                                      // Reset input
                                      e.target.value = '';
                                    }}
                                    className="hidden"
                                  />
                                  <Label
                                    htmlFor="gallery-videos-upload"
                                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                  >
                                    <Upload className="w-4 h-4" />
                                    {p.t.addGalleryFile}
                                  </Label>
                                </div>
                              </div>
                              {/* Existing uploaded videos */}
                              {p.editingEvent?.gallery_videos && p.editingEvent.gallery_videos.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {p.language === 'en' ? 'Uploaded Videos' : 'Vidéos téléversées'}
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {p.editingEvent.gallery_videos.map((url, index) => (
                                      <div key={`uploaded-video-${index}`} className="relative group">
                                        <video
                                          src={url}
                                          controls
                                          className="w-full h-48 object-cover rounded-lg border border-border"
                                        />
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => p.removeGalleryFile(index, 'videos')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Pending videos (to be uploaded on save) */}
                              {p.pendingGalleryVideos.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {p.language === 'en' ? `Pending Videos (${p.pendingGalleryVideos.length}) - Will upload on save` : `Vidéos en attente (${p.pendingGalleryVideos.length}) - Téléversées lors de l'enregistrement`}
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {p.pendingGalleryVideos.map((file, index) => (
                                      <div key={`pending-video-${index}`} className="relative group">
                                        <video
                                          src={URL.createObjectURL(file)}
                                          controls
                                          className="w-full h-48 object-cover rounded-lg border border-dashed border-primary"
                                        />
                                        <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded text-xs">
                                          <Badge variant="secondary">
                                            {p.language === 'en' ? 'Pending' : 'En Attente'}
                                          </Badge>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => p.removePendingGalleryFile(index, 'videos')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(!p.editingEvent?.gallery_videos || p.editingEvent.gallery_videos.length === 0) && p.pendingGalleryVideos.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  {p.language === 'en' 
                                    ? 'No gallery videos. Select videos to upload when you save.' 
                                    : "Aucune vidéo de galerie. Sélectionnez des vidéos à téléverser lors de l'enregistrement."}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        </TabsContent>
                        <TabsContent value="presale" className="space-y-6 mt-6">
                          {p.editingEvent?.event_type !== "gallery" &&
                            p.editingEvent?.event_status !== "completed" && (
                            <Card className="border-primary/30 bg-muted/20">
                              <CardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <Label htmlFor="presale-enabled" className="text-sm font-medium">
                                    {p.language === "en" ? "Presale" : "Prévente"}
                                  </Label>
                                  <Switch
                                    id="presale-enabled"
                                    checked={!!p.editingEvent?.presale_enabled}
                                    onCheckedChange={(checked) =>
                                      p.setEditingEvent((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              presale_enabled: checked,
                                              presale_hide_from_public_list: checked,
                                              presale_active_from: null,
                                              presale_active_until: null,
                                            }
                                          : prev
                                      )
                                    }
                                  />
                                </div>
                                {p.editingEvent?.presale_enabled && (
                                  <>
                                    {p.editingEvent.id && (
                                      <div className="space-y-3 pt-2 border-t border-border/60">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium">
                                            {p.language === "en" ? "Presale codes" : "Codes prévente"}
                                          </span>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={presaleCodesLoading}
                                            onClick={() => void loadPresaleCodes(p.editingEvent!.id)}
                                          >
                                            {presaleCodesLoading ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              p.language === "en" ? "Refresh" : "Actualiser"
                                            )}
                                          </Button>
                                        </div>
                                        {presaleCodesLoading ? (
                                          <p className="text-xs text-muted-foreground">
                                            {p.language === "en" ? "Loading…" : "Chargement…"}
                                          </p>
                                        ) : (
                                          <div className="space-y-2 max-h-52 overflow-y-auto text-xs">
                                            {presaleCodes.map((c) => {
                                              const isOpen = expandedPresaleCodeId === c.id;
                                              return (
                                              <div
                                                key={c.id}
                                                className="rounded border border-border/50 bg-background/40 overflow-hidden"
                                              >
                                                <div className="flex items-center gap-2 p-2 min-h-[2.5rem]">
                                                  <button
                                                    type="button"
                                                    className="flex flex-1 min-w-0 items-center gap-2 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -m-0.5 p-0.5"
                                                    aria-expanded={isOpen}
                                                    onClick={() =>
                                                      setExpandedPresaleCodeId((prev) => (prev === c.id ? null : c.id))
                                                    }
                                                  >
                                                    <ChevronRight
                                                      className={cn(
                                                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                                        isOpen && "rotate-90"
                                                      )}
                                                      aria-hidden
                                                    />
                                                    <span className="truncate text-sm font-medium text-foreground break-all">
                                                      {presaleCodeDisplayName(c, p.language)}
                                                    </span>
                                                    {c.revoked_at ? (
                                                      <Badge variant="destructive" className="text-[10px] shrink-0">
                                                        {p.language === "en" ? "Revoked" : "Révoqué"}
                                                      </Badge>
                                                    ) : c.paused_at ? (
                                                      <Badge variant="outline" className="text-[10px] shrink-0">
                                                        {p.language === "en" ? "Paused" : "En pause"}
                                                      </Badge>
                                                    ) : null}
                                                  </button>
                                                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                    {!c.revoked_at && !c.paused_at && (
                                                      <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 px-2 text-[10px]"
                                                        onClick={async () => {
                                                          const apiBase = getApiBaseUrl();
                                                          const r = await fetch(`${apiBase}${API_ROUTES.ADMIN_PRESALE_CODE_PAUSE(c.id)}`, {
                                                            method: "POST",
                                                            credentials: "include",
                                                          });
                                                          if (!r.ok) {
                                                            toast({ title: p.t.error, variant: "destructive" });
                                                            return;
                                                          }
                                                          void loadPresaleCodes(p.editingEvent!.id);
                                                        }}
                                                      >
                                                        Pause
                                                      </Button>
                                                    )}
                                                    {!c.revoked_at && c.paused_at && (
                                                      <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 px-2 text-[10px]"
                                                        onClick={async () => {
                                                          const apiBase = getApiBaseUrl();
                                                          const r = await fetch(`${apiBase}${API_ROUTES.ADMIN_PRESALE_CODE_UNPAUSE(c.id)}`, {
                                                            method: "POST",
                                                            credentials: "include",
                                                          });
                                                          if (!r.ok) {
                                                            toast({ title: p.t.error, variant: "destructive" });
                                                            return;
                                                          }
                                                          void loadPresaleCodes(p.editingEvent!.id);
                                                        }}
                                                      >
                                                        Unpause
                                                      </Button>
                                                    )}
                                                  </div>
                                                </div>
                                                {isOpen && (
                                                  <div className="border-t border-border/50 bg-muted/20 px-3 py-2.5">
                                                    <div className="flex flex-col gap-3">
                                                      <div className="min-w-0">
                                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                                          {p.language === "en" ? "Code name" : "Nom du code"}
                                                        </p>
                                                        <p className="mt-0.5 text-sm font-medium text-foreground break-all">
                                                          {presaleCodeDisplayName(c, p.language)}
                                                        </p>
                                                      </div>
                                                      <div className="flex flex-col gap-2.5 border-t border-border/40 pt-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                                                          <Badge variant="secondary" className="text-[10px] shrink-0">
                                                            {c.discount_type === "fixed"
                                                              ? `${c.discount_value} TND`
                                                              : `${c.discount_value}%`}
                                                          </Badge>
                                                          <span className="text-[10px] text-muted-foreground leading-snug">
                                                            {p.language === "en"
                                                              ? "Successful orders"
                                                              : "Commandes réussies"}
                                                            {": "}
                                                            <span className="font-medium text-foreground">
                                                              {c.successful_order_count ?? 0}
                                                            </span>
                                                            {" / "}
                                                            <span className="font-medium text-foreground">
                                                              {c.max_total_redemptions ?? "—"}
                                                            </span>
                                                          </span>
                                                        </div>
                                                        {!c.revoked_at && (
                                                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto sm:justify-end">
                                                            <Input
                                                              className="h-9 flex-1 min-w-0 sm:flex-initial sm:w-[5.5rem] text-xs px-2"
                                                              inputMode="numeric"
                                                              placeholder={
                                                                p.language === "en" ? "New max" : "Nouveau max"
                                                              }
                                                              title={
                                                                p.language === "en"
                                                                  ? "Raise the cap (cannot go below orders already completed)."
                                                                  : "Augmenter le plafond (pas en dessous des commandes déjà faites)."
                                                              }
                                                              value={codeMaxDrafts[c.id] ?? ""}
                                                              onChange={(e) =>
                                                                setCodeMaxDrafts((prev) => ({
                                                                  ...prev,
                                                                  [c.id]: e.target.value,
                                                                }))
                                                              }
                                                            />
                                                            <Button
                                                              type="button"
                                                              size="sm"
                                                              variant="secondary"
                                                              className="h-9 px-3 text-xs shrink-0"
                                                              onClick={async () => {
                                                                const raw = (codeMaxDrafts[c.id] ?? "").trim();
                                                                const n = parseInt(raw, 10);
                                                                if (!Number.isFinite(n) || n < 1) {
                                                                  toast({
                                                                    title: p.t.error,
                                                                    description:
                                                                      p.language === "en"
                                                                        ? "Enter a valid max (integer ≥ 1)."
                                                                        : "Entrez un max valide (entier ≥ 1).",
                                                                    variant: "destructive",
                                                                  });
                                                                  return;
                                                                }
                                                                try {
                                                                  await postPresaleMaxRedemptions(c.id, n);
                                                                  toast({
                                                                    title:
                                                                      p.language === "en" ? "Updated" : "Mis à jour",
                                                                    variant: "default",
                                                                  });
                                                                  void loadPresaleCodes(p.editingEvent!.id);
                                                                } catch (err) {
                                                                  toast({
                                                                    title: p.t.error,
                                                                    description:
                                                                      err instanceof Error ? err.message : "Failed",
                                                                    variant: "destructive",
                                                                  });
                                                                }
                                                              }}
                                                            >
                                                              {p.language === "en" ? "Save max" : "Enreg. max"}
                                                            </Button>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                        <div className="space-y-3 pt-2">
                                          <Input
                                            required
                                            placeholder={
                                              p.language === "en" ? "Code name" : "Nom du code"
                                            }
                                            title={
                                              p.language === "en"
                                                ? "Buyers enter this on the pass page. Same code can be used for many orders until the max below is reached."
                                                : "Saisi sur la page d’achat. Réutilisable jusqu’au maximum ci-dessous."
                                            }
                                            value={newPresale.code}
                                            autoCapitalize="characters"
                                            spellCheck={false}
                                            onChange={(e) =>
                                              setNewPresale((s) => ({ ...s, code: e.target.value.toUpperCase() }))
                                            }
                                          />
                                          <Input
                                            required
                                            inputMode="numeric"
                                            placeholder={p.language === "en" ? "Quantity" : "Quantité"}
                                            title={
                                              p.language === "en"
                                                ? "Total successful checkouts allowed with this code. After each successful order the remaining count drops (e.g. 200 → 199). You can raise the max later."
                                                : "Nombre total de commandes réussies avec ce code. Chaque commande payée diminue le reste. Vous pouvez augmenter le max plus tard."
                                            }
                                            value={newPresale.max_total_redemptions}
                                            onChange={(e) =>
                                              setNewPresale((s) => ({ ...s, max_total_redemptions: e.target.value }))
                                            }
                                          />
                                          <div
                                            className="flex rounded-md border border-input bg-background shadow-sm overflow-hidden"
                                            title={
                                              p.language === "en"
                                                ? "Left: % or TND per unit. Right: number (e.g. 10 = 10% off list, or 10 TND off each pass)."
                                                : "Gauche : % ou TND par unité. Droite : nombre (ex. 10 = 10 % sur le prix, ou 10 TND par pass)."
                                            }
                                          >
                                            <Select
                                              value={newPresale.discount_type}
                                              onValueChange={(v: "percent" | "fixed") =>
                                                setNewPresale((s) => ({ ...s, discount_type: v }))
                                              }
                                            >
                                              <SelectTrigger className="h-10 w-[42%] min-w-[7.5rem] shrink-0 rounded-none border-0 border-r border-input bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="percent">% </SelectItem>
                                                <SelectItem value="fixed">TND</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <Input
                                              type="number"
                                              required
                                              min={0.01}
                                              step="0.01"
                                              className="h-10 flex-1 min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                              placeholder={
                                                newPresale.discount_type === "percent"
                                                  ? p.language === "en"
                                                    ? "Amount e.g. 10 (= 10% off)"
                                                    : "Montant ex. 10 (= 10 %)"
                                                  : p.language === "en"
                                                    ? "Amount e.g. 10 (= 10 TND off each pass)"
                                                    : "Montant ex. 10 (= 10 TND par pass)"
                                              }
                                              value={newPresale.discount_value}
                                              onChange={(e) =>
                                                setNewPresale((s) => ({
                                                  ...s,
                                                  discount_value: e.target.value,
                                                }))
                                              }
                                            />
                                          </div>
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={!newPresale.code.trim()}
                                          onClick={async () => {
                                            const apiBase = getApiBaseUrl();
                                            const maxRaw = newPresale.max_total_redemptions.trim();
                                            const dv = parseFloat(String(newPresale.discount_value).trim());
                                            if (!newPresale.code.trim()) {
                                              toast({
                                                title: p.t.error,
                                                description:
                                                  p.language === "en"
                                                    ? "Code is required."
                                                    : "Le code est obligatoire.",
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            if (!Number.isFinite(dv) || dv < 0) {
                                              toast({
                                                title: p.t.error,
                                                description:
                                                  p.language === "en"
                                                    ? "Discount must be a number ≥ 0 (use 0 for no discount)."
                                                    : "La remise doit être un nombre ≥ 0 (0 = pas de remise).",
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            const maxN = parseInt(maxRaw, 10);
                                            if (!Number.isFinite(maxN) || maxN < 1) {
                                              toast({
                                                title: p.t.error,
                                                description:
                                                  p.language === "en"
                                                    ? "Max successful orders is required (integer ≥ 1)."
                                                    : "Le max de commandes est obligatoire (entier ≥ 1).",
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            const addedCode = newPresale.code.trim();
                                            const discountType = newPresale.discount_type;
                                            const body: Record<string, unknown> = {
                                              eventId: p.editingEvent!.id,
                                              code: addedCode,
                                              discount_type: discountType,
                                              discount_value: dv,
                                              max_total_redemptions: maxN,
                                            };
                                            const r = await fetch(`${apiBase}/api/admin/presale/codes`, {
                                              method: "POST",
                                              credentials: "include",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify(body),
                                            });
                                            const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
                                            if (!r.ok) {
                                              toast({
                                                title: p.t.error,
                                                description: presaleApiErrorMessage(j, `Request failed (${r.status})`),
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            const createdId =
                                              typeof j.id === "string" ? j.id : String(j.id ?? "");
                                            const createdLabel =
                                              j.label != null && String(j.label).trim() !== ""
                                                ? String(j.label).trim()
                                                : addedCode;
                                            if (createdId && createdLabel) {
                                              presaleLabelHintByIdRef.current[createdId] = createdLabel;
                                            }
                                            if (createdId) {
                                              const optimistic: PresaleCodeRow = {
                                                id: createdId,
                                                label: createdLabel,
                                                usage_mode: "multi_use",
                                                discount_type: discountType,
                                                discount_value: dv,
                                                max_total_redemptions: maxN,
                                                paused_at: null,
                                                revoked_at: null,
                                                successful_order_count: 0,
                                              };
                                              setPresaleCodes((prev) => [
                                                optimistic,
                                                ...prev.filter((c) => c.id !== createdId),
                                              ]);
                                              setCodeMaxDrafts((d) => ({
                                                ...d,
                                                [createdId]: String(maxN),
                                              }));
                                            }
                                            setNewPresale({
                                              code: "",
                                              discount_type: "percent",
                                              discount_value: "",
                                              max_total_redemptions: "",
                                            });
                                            await loadPresaleCodes(p.editingEvent!.id);
                                          }}
                                        >
                                          {p.language === "en" ? "Add code" : "Ajouter code"}
                                        </Button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          )}
                          {p.editingEvent?.event_type === "gallery" ||
                          p.editingEvent?.event_status === "completed" ? (
                            <p className="text-sm text-muted-foreground">
                              {p.language === "en"
                                ? "Presale is not available for completed/gallery events."
                                : "La prévente n’est pas disponible pour les événements terminés / galerie."}
                            </p>
                          ) : null}
                        </TabsContent>
                        <TabsContent value="pass-stock" className="space-y-4 mt-6">
                          {!p.editingEvent?.id ? (
                            <p className="text-sm text-muted-foreground">
                              {p.language === "en"
                                ? "Save the event first to manage pass stock."
                                : "Enregistrez l’événement d’abord pour gérer le stock des passes."}
                            </p>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0" />
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="default"
                                    disabled={p.isPassManagementLoading}
                                    onClick={() => {
                                      if (!p.editingEvent?.id) return;
                                      p.setEventForPassManagement(p.editingEvent);
                                      p.setSelectedPassForSettings(null);
                                      p.setNewPassForm({
                                        name: "",
                                        price: 0,
                                        description: "",
                                        is_primary:
                                          p.passesForManagement.length === 0 ||
                                          !p.passesForManagement.some((pp) => pp.is_primary),
                                        max_quantity: 100,
                                        allowed_payment_methods: [],
                                      });
                                      requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                          newPassFormScrollRef.current?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                          });
                                        });
                                      });
                                    }}
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {p.language === "en" ? "Add pass" : "Ajouter pass"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={p.isPassManagementLoading}
                                    onClick={() => void loadPassStockForEvent(p.editingEvent!.id)}
                                  >
                                    {p.isPassManagementLoading ? (
                                      <span className="inline-flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span className="text-xs">
                                          {p.language === "en" ? "Loading…" : "Chargement…"}
                                        </span>
                                      </span>
                                    ) : (
                                      p.language === "en" ? "Refresh" : "Actualiser"
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-4 mt-1">
                                {/* New Pass Form */}
                                {p.newPassForm !== null && (
                                  <>
                                    <div ref={newPassFormScrollRef} />
                                    <Card className="border-primary/50 bg-primary/5">
                                      <CardContent className="p-5 space-y-4">
                                      <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-semibold">
                                          {p.language === "en" ? "Add New Pass" : "Ajouter un Nouveau Pass"}
                                        </h4>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => p.setNewPassForm(null)}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <Label>{p.language === "en" ? "Pass Name" : "Nom du Pass"} *</Label>
                                          <Input
                                            value={p.newPassForm.name}
                                            onChange={(e) =>
                                              p.setNewPassForm({ ...p.newPassForm, name: e.target.value })
                                            }
                                            placeholder={
                                              p.language === "en" ? "e.g., VIP, Standard" : "ex: VIP, Standard"
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label>{p.language === "en" ? "Price (TND)" : "Prix (TND)"} *</Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={p.newPassForm.price || ""}
                                            onChange={(e) =>
                                              p.setNewPassForm({
                                                ...p.newPassForm,
                                                price: parseFloat(e.target.value) || 0,
                                              })
                                            }
                                            placeholder="0.00"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <Label>{p.language === "en" ? "Description" : "Description"}</Label>
                                        <Textarea
                                          value={p.newPassForm.description}
                                          onChange={(e) =>
                                            p.setNewPassForm({
                                              ...p.newPassForm,
                                              description: e.target.value,
                                            })
                                          }
                                          placeholder={
                                            p.language === "en" ? "Optional description" : "Description optionnelle"
                                          }
                                          rows={2}
                                        />
                                      </div>
                                      <div>
                                        <Label>{p.language === "en" ? "Stock quantity" : "Quantité en stock"} *</Label>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={p.newPassForm.max_quantity ?? ""}
                                          onChange={(e) =>
                                            p.setNewPassForm({
                                              ...p.newPassForm,
                                              max_quantity: parseInt(e.target.value, 10) || 0,
                                            })
                                          }
                                          placeholder={p.language === "en" ? "e.g. 100" : "ex. 100"}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {p.language === "en"
                                            ? "Total number of passes available for sale."
                                            : "Nombre total de passes disponibles à la vente."}
                                        </p>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={p.newPassForm.is_primary}
                                          onChange={(e) => {
                                            const isPrimary = e.target.checked;
                                            p.setNewPassForm({ ...p.newPassForm, is_primary: isPrimary });
                                          }}
                                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <Label className="text-sm font-medium cursor-pointer">
                                          {p.language === "en"
                                            ? "Mark as primary pass"
                                            : "Marquer comme pass principal"}
                                        </Label>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>
                                          {p.language === "en"
                                            ? "Allowed Payment Methods"
                                            : "Méthodes de Paiement Autorisées"}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                          {p.language === "en"
                                            ? "If none selected, all payment methods are allowed. Select specific methods to restrict this pass."
                                            : "Si aucune n'est sélectionnée, toutes les méthodes de paiement sont autorisées. Sélectionnez des méthodes spécifiques pour restreindre ce pass."}
                                        </p>
                                        <div className="space-y-2">
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              id="pm-online-inline"
                                              checked={p.newPassForm.allowed_payment_methods.includes("online")}
                                              onCheckedChange={(checked) => {
                                                const methods = checked
                                                  ? [...p.newPassForm.allowed_payment_methods, "online"]
                                                  : p.newPassForm.allowed_payment_methods.filter((m) => m !== "online");
                                                p.setNewPassForm({
                                                  ...p.newPassForm,
                                                  allowed_payment_methods: methods,
                                                });
                                              }}
                                            />
                                            <Label htmlFor="pm-online-inline" className="text-sm font-normal cursor-pointer">
                                              {p.language === "en" ? "Online Payment" : "Paiement en ligne"}
                                            </Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              id="pm-external-app-inline"
                                              checked={p.newPassForm.allowed_payment_methods.includes("external_app")}
                                              onCheckedChange={(checked) => {
                                                const methods = checked
                                                  ? [...p.newPassForm.allowed_payment_methods, "external_app"]
                                                  : p.newPassForm.allowed_payment_methods.filter(
                                                      (m) => m !== "external_app"
                                                    );
                                                p.setNewPassForm({
                                                  ...p.newPassForm,
                                                  allowed_payment_methods: methods,
                                                });
                                              }}
                                            />
                                            <Label
                                              htmlFor="pm-external-app-inline"
                                              className="text-sm font-normal cursor-pointer"
                                            >
                                              {p.language === "en" ? "External App" : "Application externe"}
                                            </Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              id="pm-ambassador-cash-inline"
                                              checked={p.newPassForm.allowed_payment_methods.includes("ambassador_cash")}
                                              onCheckedChange={(checked) => {
                                                const methods = checked
                                                  ? [...p.newPassForm.allowed_payment_methods, "ambassador_cash"]
                                                  : p.newPassForm.allowed_payment_methods.filter(
                                                      (m) => m !== "ambassador_cash"
                                                    );
                                                p.setNewPassForm({
                                                  ...p.newPassForm,
                                                  allowed_payment_methods: methods,
                                                });
                                              }}
                                            />
                                            <Label
                                              htmlFor="pm-ambassador-cash-inline"
                                              className="text-sm font-normal cursor-pointer"
                                            >
                                              {p.language === "en"
                                                ? "Cash on Delivery (Ambassador)"
                                                : "Paiement à la livraison (Ambassadeur)"}
                                            </Label>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => p.setNewPassForm(null)}>
                                          {p.language === "en" ? "Cancel" : "Annuler"}
                                        </Button>
                                        <Button
                                          onClick={async () => {
                                            if (!p.eventForPassManagement?.id) return;
                                            if (!p.newPassForm.name.trim()) {
                                              toast({
                                                title: p.t.error,
                                                description:
                                                  p.language === "en"
                                                    ? "Pass name is required"
                                                    : "Le nom du pass est requis",
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            if (!p.newPassForm.price || p.newPassForm.price <= 0) {
                                              toast({
                                                title: p.t.error,
                                                description:
                                                  p.language === "en"
                                                    ? "Price must be greater than 0"
                                                    : "Le prix doit être supérieur à 0",
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            const maxQty = Number(p.newPassForm.max_quantity);
                                            if (!Number.isInteger(maxQty) || maxQty < 1) {
                                              toast({
                                                title: p.t.error,
                                                description:
                                                  p.language === "en"
                                                    ? "Stock quantity is required and must be at least 1"
                                                    : "La quantité en stock est requise et doit être au moins 1",
                                                variant: "destructive",
                                              });
                                              return;
                                            }

                                            try {
                                              const allowedPaymentMethods =
                                                p.newPassForm.allowed_payment_methods.length > 0
                                                  ? p.newPassForm.allowed_payment_methods
                                                  : null;

                                              const apiBase = getApiBaseUrl();
                                              const createRes = await fetch(
                                                `${apiBase}${API_ROUTES.ADMIN_PASS_CREATE}`,
                                                {
                                                  method: "POST",
                                                  credentials: "include",
                                                  headers: { "Content-Type": "application/json" },
                                                  body: JSON.stringify({
                                                    event_id: p.eventForPassManagement.id,
                                                    name: p.newPassForm.name.trim(),
                                                    price: Number(p.newPassForm.price.toFixed(2)),
                                                    description: p.newPassForm.description || "",
                                                    is_primary: p.newPassForm.is_primary,
                                                    max_quantity: maxQty,
                                                    allowed_payment_methods: allowedPaymentMethods,
                                                  }),
                                                }
                                              );
                                              const createJson = await createRes.json().catch(() => ({}));
                                              if (!createRes.ok) {
                                                throw new Error(
                                                  typeof createJson.error === "string"
                                                    ? createJson.error
                                                    : "Failed to create pass"
                                                );
                                              }

                                              await loadPassStockForEvent(p.eventForPassManagement.id);
                                              p.setNewPassForm(null);
                                              toast({
                                                title:
                                                  p.t.success || (p.language === "en" ? "Success" : "Succès"),
                                                description:
                                                  p.language === "en"
                                                    ? "Pass created successfully"
                                                    : "Pass créé avec succès",
                                              });
                                            } catch (error: any) {
                                              toast({
                                                title: p.t.error,
                                                description:
                                                  error.message ||
                                                  (p.language === "en"
                                                    ? "Failed to create pass"
                                                    : "Échec de la création du pass"),
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                        >
                                          <Save className="w-4 h-4 mr-2" />
                                          {p.language === "en" ? "Create Pass" : "Créer Pass"}
                                        </Button>
                                      </div>
                                      </CardContent>
                                    </Card>
                                  </>
                                )}
                                {p.isPassManagementLoading ? (
                                  <div className="text-center py-8">
                                    <Loader size="lg" className="mx-auto mb-4" />
                                    <p className="text-muted-foreground">
                                      {p.language === "en" ? "Loading passes..." : "Chargement des passes..."}
                                    </p>
                                  </div>
                                ) : p.selectedPassForSettings ? (
                                  /* Detail view: pass settings */
                                  (() => {
                                    const pass = p.selectedPassForSettings;
                                    return (
                                      <Card className="border-border">
                                        <CardContent className="p-5 space-y-6">
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                                {pass.is_primary && (
                                                  <Badge variant="default" className="text-xs shrink-0">
                                                    {p.language === "en" ? "PRIMARY" : "PRINCIPAL"}
                                                  </Badge>
                                                )}
                                                <span className="text-base sm:text-lg font-semibold break-words">
                                                  {pass.name}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-3 mb-1">
                                                <span className="text-lg font-bold text-primary">
                                                  {pass.price.toFixed(2)} TND
                                                </span>
                                              </div>
                                              {pass.description && (
                                                <p className="text-sm text-muted-foreground break-words">
                                                  {pass.description}
                                                </p>
                                              )}
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="shrink-0"
                                              onClick={() => p.setSelectedPassForSettings(null)}
                                            >
                                              <ArrowLeft className="w-4 h-4 mr-1" />
                                              {p.language === "en" ? "Back" : "Retour"}
                                            </Button>
                                          </div>

                                          {/* Allowed Payment Methods */}
                                          {pass.id && (
                                            <div className="space-y-2 p-3 bg-muted/20 rounded-lg border">
                                              <Label className="text-sm font-semibold">
                                                {p.language === "en"
                                                  ? "Allowed Payment Methods"
                                                  : "Méthodes de Paiement Autorisées"}
                                              </Label>
                                              <p className="text-xs text-muted-foreground mb-2">
                                                {p.language === "en"
                                                  ? "If none selected, all payment methods are allowed."
                                                  : "Si aucune n'est sélectionnée, toutes les méthodes de paiement sont autorisées."}
                                              </p>
                                              <div className="space-y-2">
                                                {["online", "external_app", "ambassador_cash"].map((method) => (
                                                  <div key={method} className="flex items-center space-x-2">
                                                    <Checkbox
                                                      id={`pm-${method}-${pass.id}`}
                                                      checked={(pass.allowed_payment_methods || []).includes(method)}
                                                      onCheckedChange={async (checked) => {
                                                        if (!pass.id) return;
                                                        const currentMethods = pass.allowed_payment_methods || [];
                                                        const newMethods = checked
                                                          ? [...currentMethods, method]
                                                          : currentMethods.filter((m) => m !== method);
                                                        try {
                                                          const apiBase = getApiBaseUrl();
                                                          const response = await fetch(
                                                            `${apiBase}/api/admin/passes/${pass.id}/payment-methods`,
                                                            {
                                                              method: "PUT",
                                                              headers: { "Content-Type": "application/json" },
                                                              credentials: "include",
                                                              body: JSON.stringify({
                                                                allowed_payment_methods:
                                                                  newMethods.length > 0 ? newMethods : null,
                                                              }),
                                                            }
                                                          );
                                                          if (!response.ok) {
                                                            const err = await response.json();
                                                            toast({
                                                              title: p.t.error,
                                                              description:
                                                                err.error ||
                                                                err.details ||
                                                                (p.language === "en" ? "Failed" : "Échec"),
                                                              variant: "destructive",
                                                            });
                                                            return;
                                                          }
                                                          const result = await response.json();
                                                          const updatedPasses = [...p.passesForManagement];
                                                          const idx = updatedPasses.findIndex((pp) => pp.id === pass.id);
                                                          if (idx >= 0)
                                                            updatedPasses[idx] = {
                                                              ...pass,
                                                              allowed_payment_methods: result.pass.allowed_payment_methods || null,
                                                            };
                                                          p.setPassesForManagement(updatedPasses);
                                                          p.setSelectedPassForSettings(updatedPasses[idx] || pass);
                                                          toast({
                                                            title: p.t.success || "Success",
                                                            description:
                                                              p.language === "en"
                                                                ? "Payment methods updated"
                                                                : "Méthodes de paiement mises à jour",
                                                          });
                                                        } catch (e: any) {
                                                          toast({
                                                            title: p.t.error,
                                                            description: e.message || (p.language === "en" ? "Failed" : "Échec"),
                                                            variant: "destructive",
                                                          });
                                                        }
                                                      }}
                                                    />
                                                    <Label
                                                      htmlFor={`pm-${method}-${pass.id}`}
                                                      className="text-sm font-normal cursor-pointer"
                                                    >
                                                      {method === "online"
                                                        ? p.language === "en"
                                                          ? "Online Payment"
                                                          : "Paiement en ligne"
                                                        : method === "external_app"
                                                          ? p.language === "en"
                                                            ? "External App"
                                                            : "Application externe"
                                                          : p.language === "en"
                                                            ? "Cash on Delivery (Ambassador)"
                                                            : "Paiement à la livraison (Ambassadeur)"}
                                                    </Label>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Max Stock */}
                                          {pass.id && (
                                            <div className="space-y-2">
                                              <Label>{p.language === "en" ? "Max Stock" : "Stock Maximum"}</Label>
                                              <div className="flex gap-2">
                                                <Input
                                                  type="number"
                                                  min={pass.sold_quantity || 0}
                                                  value={pass.max_quantity != null ? pass.max_quantity : ""}
                                                  onChange={(e) => {
                                                    const numValue =
                                                      e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                                                    const updatedPasses = [...p.passesForManagement];
                                                    const idx = updatedPasses.findIndex((pp) => pp.id === pass.id);
                                                    if (idx >= 0)
                                                      updatedPasses[idx] = {
                                                        ...pass,
                                                        max_quantity: numValue ?? pass.max_quantity ?? 0,
                                                      };
                                                    p.setPassesForManagement(updatedPasses);
                                                    p.setSelectedPassForSettings(updatedPasses[idx] || pass);
                                                  }}
                                                  placeholder={p.language === "en" ? "Enter max stock" : "Entrez le stock max"}
                                                  className="flex-1"
                                                />
                                                <Button
                                                  size="sm"
                                                  onClick={async () => {
                                                    if (!pass.id) return;
                                                    const maxQty = pass.max_quantity;
                                                    if (maxQty == null || maxQty < (pass.sold_quantity || 0)) {
                                                      toast({
                                                        title: p.t.error,
                                                        description:
                                                          p.language === "en"
                                                            ? `Cannot set max stock below sold quantity (${pass.sold_quantity})`
                                                            : `Impossible de définir le stock max en dessous de la quantité vendue (${pass.sold_quantity})`,
                                                        variant: "destructive",
                                                      });
                                                      return;
                                                    }
                                                    try {
                                                      const apiBase = getApiBaseUrl();
                                                      const response = await fetch(
                                                        `${apiBase}/api/admin/passes/${pass.id}/stock`,
                                                        {
                                                          method: "POST",
                                                          headers: { "Content-Type": "application/json" },
                                                          credentials: "include",
                                                          body: JSON.stringify({ max_quantity: maxQty }),
                                                        }
                                                      );
                                                      if (!response.ok) {
                                                        const err = await response.json();
                                                        toast({
                                                          title: p.t.error,
                                                          description:
                                                            err.error ||
                                                            err.details ||
                                                            (p.language === "en" ? "Failed to update stock" : "Échec"),
                                                          variant: "destructive",
                                                        });
                                                        return;
                                                      }
                                                      const result = await response.json();
                                                      const updatedPasses = [...p.passesForManagement];
                                                      const idx = updatedPasses.findIndex((pp) => pp.id === pass.id);
                                                      if (idx >= 0)
                                                        updatedPasses[idx] = {
                                                          ...pass,
                                                          max_quantity: result.pass.max_quantity,
                                                          remaining_quantity: result.pass.remaining_quantity,
                                                          is_unlimited: result.pass.is_unlimited,
                                                        };
                                                      p.setPassesForManagement(updatedPasses);
                                                      p.setSelectedPassForSettings(updatedPasses[idx] || pass);
                                                      toast({
                                                        title: p.t.success || "Success",
                                                        description: p.language === "en" ? "Stock updated" : "Stock mis à jour",
                                                      });
                                                    } catch (e: any) {
                                                      toast({
                                                        title: p.t.error,
                                                        description: e.message || (p.language === "en" ? "Failed" : "Échec"),
                                                        variant: "destructive",
                                                      });
                                                    }
                                                  }}
                                                >
                                                  <Save className="w-4 h-4 mr-2" />
                                                  {p.language === "en" ? "Save" : "Enregistrer"}
                                                </Button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Status */}
                                          {pass.id && (
                                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                              <div>
                                                <Label className="text-sm font-medium">
                                                  {p.language === "en" ? "Pass Status" : "Statut du Pass"}
                                                </Label>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                  {pass.is_active
                                                    ? p.language === "en"
                                                      ? "Active - visible to customers"
                                                      : "Actif - visible par les clients"
                                                    : p.language === "en"
                                                      ? "Inactive - hidden from customers"
                                                      : "Inactif - caché aux clients"}
                                                </p>
                                              </div>
                                              <Switch
                                                checked={pass.is_active !== false}
                                                onCheckedChange={async (checked) => {
                                                  if (!pass.id) return;
                                                  try {
                                                    const apiBase = getApiBaseUrl();
                                                    const response = await fetch(
                                                      `${apiBase}/api/admin/passes/${pass.id}/activate`,
                                                      {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        credentials: "include",
                                                        body: JSON.stringify({ is_active: checked }),
                                                      }
                                                    );
                                                    if (!response.ok) {
                                                      const err = await response.json();
                                                      toast({
                                                        title: p.t.error,
                                                        description:
                                                          err.error ||
                                                          err.details ||
                                                          (p.language === "en" ? "Failed" : "Échec"),
                                                        variant: "destructive",
                                                      });
                                                      return;
                                                    }
                                                    const updatedPasses = [...p.passesForManagement];
                                                    const idx = updatedPasses.findIndex((pp) => pp.id === pass.id);
                                                    if (idx >= 0) updatedPasses[idx] = { ...pass, is_active: checked };
                                                    p.setPassesForManagement(updatedPasses);
                                                    p.setSelectedPassForSettings(updatedPasses[idx] || pass);
                                                    toast({
                                                      title: p.t.success || "Success",
                                                      description:
                                                        p.language === "en"
                                                          ? `Pass ${checked ? "activated" : "deactivated"}`
                                                          : `Pass ${checked ? "activé" : "désactivé"}`,
                                                    });
                                                  } catch (e: any) {
                                                    toast({
                                                      title: p.t.error,
                                                      description: e.message || (p.language === "en" ? "Failed" : "Échec"),
                                                      variant: "destructive",
                                                    });
                                                  }
                                                }}
                                              />
                                            </div>
                                          )}
                                        </CardContent>
                                      </Card>
                                    );
                                  })()
                                ) : p.passesForManagement.length === 0 ? (
                                  <div className="text-center py-8 text-muted-foreground">
                                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>
                                      {p.language === "en"
                                        ? "No passes found for this event"
                                        : "Aucun pass trouvé pour cet événement"}
                                    </p>
                                  </div>
                                ) : (
                                  /* List view */
                                  <>
                                    <div className="md:hidden space-y-3">
                                      {p.passesForManagement.map((pass, index) => {
                                        const remaining =
                                          pass.remaining_quantity ??
                                          (pass.max_quantity != null
                                            ? Math.max(0, pass.max_quantity - (pass.sold_quantity || 0))
                                            : 0);
                                        return (
                                          <button
                                            key={pass.id || index}
                                            type="button"
                                            onClick={() => {
                                              // If the "Add pass" form is open, close it when selecting an existing pass.
                                              p.setNewPassForm(null);
                                              p.setSelectedPassForSettings(pass);
                                            }}
                                            className="w-full text-left rounded-lg border border-border bg-card/30 p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          >
                                            <div className="flex flex-wrap items-center gap-2 gap-y-1 mb-3">
                                              {pass.is_primary ? (
                                                <Badge variant="default" className="text-xs shrink-0">
                                                  {p.language === "en" ? "PRIMARY" : "PRINCIPAL"}
                                                </Badge>
                                              ) : null}
                                              <span className="font-semibold text-base break-words">
                                                {pass.name}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 text-sm">
                                              <div>
                                                <span className="text-muted-foreground text-xs block mb-0.5">
                                                  {p.language === "en" ? "Price" : "Prix"}
                                                </span>
                                                <span className="font-semibold text-primary tabular-nums">
                                                  {pass.price.toFixed(2)} TND
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground text-xs block mb-0.5">
                                                  {p.language === "en" ? "Sold" : "Vendus"}
                                                </span>
                                                <span className="font-medium tabular-nums">
                                                  {pass.sold_quantity || 0}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground text-xs block mb-0.5">
                                                  {p.language === "en" ? "Remaining" : "Restants"}
                                                </span>
                                                <span className="font-medium tabular-nums">{remaining}</span>
                                              </div>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="hidden md:block rounded-lg border overflow-x-auto">
                                      <table className="w-full min-w-[640px] text-sm">
                                        <thead className="bg-muted/50">
                                          <tr>
                                            <th className="text-left p-3 font-medium">
                                              {p.language === "en" ? "Pass" : "Pass"}
                                            </th>
                                            <th className="text-left p-3 font-medium">
                                              {p.language === "en" ? "Price" : "Prix"}
                                            </th>
                                            <th className="text-left p-3 font-medium">
                                              {p.language === "en" ? "Sold" : "Vendus"}
                                            </th>
                                            <th className="text-left p-3 font-medium">
                                              {p.language === "en" ? "Remaining" : "Restants"}
                                            </th>
                                            <th className="text-left p-3 font-medium">
                                              {p.language === "en" ? "Status" : "Statut"}
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {p.passesForManagement.map((pass, index) => {
                                            const remaining =
                                              pass.remaining_quantity ??
                                              (pass.max_quantity != null
                                                ? Math.max(0, pass.max_quantity - (pass.sold_quantity || 0))
                                                : 0);
                                            return (
                                              <tr
                                                key={pass.id || index}
                                                className="border-t cursor-pointer hover:bg-muted/30 transition-colors"
                                                onClick={() => {
                                                  // If the "Add pass" form is open, close it when selecting an existing pass.
                                                  p.setNewPassForm(null);
                                                  p.setSelectedPassForSettings(pass);
                                                }}
                                              >
                                                <td className="p-3">
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    {pass.is_primary && (
                                                      <Badge variant="default" className="text-xs shrink-0">
                                                        {p.language === "en" ? "PRIMARY" : "PRINCIPAL"}
                                                      </Badge>
                                                    )}
                                                    <span className="font-medium break-words">{pass.name}</span>
                                                  </div>
                                                </td>
                                                <td className="p-3 font-semibold text-primary tabular-nums">
                                                  {pass.price.toFixed(2)} TND
                                                </td>
                                                <td className="p-3 tabular-nums">{pass.sold_quantity || 0}</td>
                                                <td className="p-3 tabular-nums">{remaining}</td>
                                                <td className="p-3">
                                                  <div className="flex items-center gap-2">
                                                    {!pass.is_active ? (
                                                      <Badge variant="secondary" className="text-xs">
                                                        {p.language === "en" ? "Inactive" : "Inactif"}
                                                      </Badge>
                                                    ) : pass.is_sold_out ? (
                                                      <Badge variant="destructive" className="text-xs">
                                                        {p.language === "en" ? "Sold out" : "Épuisé"}
                                                      </Badge>
                                                    ) : (
                                                      <Badge variant="outline" className="text-xs text-green-600 border-green-600/40">
                                                        {p.language === "en" ? "Active" : "Actif"}
                                                      </Badge>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="promo-codes" className="space-y-4 mt-6">
                          <Card className="border-primary/30 bg-muted/20">
                            <CardContent className="p-4">
                              <p className="text-sm text-muted-foreground">
                                {p.language === "en" ? "Coming soon." : "Bientôt disponible."}
                              </p>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>
                      <div className="flex justify-end gap-2 mt-6">
                        <DialogClose asChild>
                          <Button 
                            variant="outline"
                          >
                            {p.t.cancel}
                          </Button>
                        </DialogClose>
                        <Button 
                          disabled={!!p.eventSaveBusy}
                          onClick={async () => {
                            if (!p.editingEvent) return;
                            await p.handleSaveEvent(p.editingEvent, p.editingEvent._uploadFile);
                          }}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {p.t.save}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Pass Management Dialog */}
                  <Dialog open={p.isPassManagementDialogOpen} onOpenChange={(open) => {
                    p.setIsPassManagementDialogOpen(open);
                    if (!open) p.setSelectedPassForSettings(null);
                  }}>
                    <DialogContent className="w-[min(100%,calc(100vw-1.25rem))] max-w-4xl max-h-[90dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 gap-3">
                      <DialogHeader className="space-y-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 pr-10 sm:pr-12">
                          <div className="min-w-0 flex-1 text-left">
                            <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                              {p.selectedPassForSettings ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mr-0 sm:mr-2 -ml-2 shrink-0"
                                  onClick={() => p.setSelectedPassForSettings(null)}
                                >
                                  <ArrowLeft className="w-4 h-4 mr-1" />
                                  {p.language === 'en' ? 'Back' : 'Retour'}
                                </Button>
                              ) : null}
                              <Package className="w-5 h-5 shrink-0" />
                              <span className="min-w-0 break-words">
                                {p.selectedPassForSettings
                                  ? p.selectedPassForSettings.name
                                  : (p.language === 'en' ? 'Pass Stock Management' : 'Gestion des Stocks de Passes')}
                              </span>
                            </DialogTitle>
                            {p.eventForPassManagement && !p.selectedPassForSettings && (
                              <p className="text-sm text-muted-foreground mt-2 break-words">
                                {p.eventForPassManagement.name}
                                <span aria-hidden className="mx-1.5">
                                  ·
                                </span>
                                {formatDateDMY(p.eventForPassManagement.date, p.language)}
                              </p>
                            )}
                          </div>
                          {!p.selectedPassForSettings && (
                            <Button
                              size="sm"
                              variant="default"
                              className="shrink-0 w-full sm:w-auto"
                              onClick={() => {
                                p.setNewPassForm({
                                  name: '',
                                  price: 0,
                                  description: '',
                                  is_primary: p.passesForManagement.length === 0 || !p.passesForManagement.some(pp => pp.is_primary),
                                  max_quantity: 100,
                                  allowed_payment_methods: [] // Empty = all methods allowed (NULL in DB)
                                });
                              }}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              {p.language === 'en' ? 'Add Pass' : 'Ajouter Pass'}
                            </Button>
                          )}
                        </div>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        {/* New Pass Form */}
                        {p.newPassForm !== null && (
                          <Card className="border-primary/50 bg-primary/5">
                            <CardContent className="p-5 space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-semibold">{p.language === 'en' ? 'Add New Pass' : 'Ajouter un Nouveau Pass'}</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => p.setNewPassForm(null)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label>{p.language === 'en' ? 'Pass Name' : 'Nom du Pass'} *</Label>
                                  <Input
                                    value={p.newPassForm.name}
                                    onChange={(e) => p.setNewPassForm({ ...p.newPassForm, name: e.target.value })}
                                    placeholder={p.language === 'en' ? 'e.g., VIP, Standard' : 'ex: VIP, Standard'}
                                  />
                                </div>
                                <div>
                                  <Label>{p.language === 'en' ? 'Price (TND)' : 'Prix (TND)'} *</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={p.newPassForm.price || ''}
                                    onChange={(e) => p.setNewPassForm({ ...p.newPassForm, price: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                                <div>
                                  <Label>{p.language === 'en' ? 'Description' : 'Description'}</Label>
                                  <Textarea
                                    value={p.newPassForm.description}
                                    onChange={(e) => p.setNewPassForm({ ...p.newPassForm, description: e.target.value })}
                                    placeholder={p.language === 'en' ? 'Optional description' : 'Description optionnelle'}
                                    rows={2}
                                  />
                                </div>
                                <div>
                                  <Label>{p.language === 'en' ? 'Stock quantity' : 'Quantité en stock'} *</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={p.newPassForm.max_quantity ?? ''}
                                    onChange={(e) => p.setNewPassForm({ ...p.newPassForm, max_quantity: parseInt(e.target.value, 10) || 0 })}
                                    placeholder={p.language === 'en' ? 'e.g. 100' : 'ex. 100'}
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {p.language === 'en' ? 'Total number of passes available for sale.' : 'Nombre total de passes disponibles à la vente.'}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={p.newPassForm.is_primary}
                                  onChange={(e) => {
                                    const isPrimary = e.target.checked;
                                    p.setNewPassForm({ ...p.newPassForm, is_primary: isPrimary });
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label className="text-sm font-medium cursor-pointer">
                                  {p.language === 'en' ? 'Mark as primary pass' : 'Marquer comme pass principal'}
                                </Label>
                              </div>
                              <div className="space-y-2">
                                <Label>{p.language === 'en' ? 'Allowed Payment Methods' : 'Méthodes de paiement autorisées'}</Label>
                                <p className="text-xs text-muted-foreground">
                                  {p.language === 'en' 
                                    ? 'If none selected, all payment methods are allowed. Select specific methods to restrict this pass.'
                                    : "Si aucune n'est sélectionnée, toutes les méthodes de paiement sont autorisées. Sélectionnez des méthodes spécifiques pour restreindre ce pass."}
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="pm-online"
                                      checked={p.newPassForm.allowed_payment_methods.includes('online')}
                                      onCheckedChange={(checked) => {
                                        const methods = checked
                                          ? [...p.newPassForm.allowed_payment_methods, 'online']
                                          : p.newPassForm.allowed_payment_methods.filter(m => m !== 'online');
                                        p.setNewPassForm({ ...p.newPassForm, allowed_payment_methods: methods });
                                      }}
                                    />
                                    <Label htmlFor="pm-online" className="text-sm font-normal cursor-pointer">
                                      {p.language === 'en' ? 'Online Payment' : 'Paiement en ligne'}
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="pm-external-app"
                                      checked={p.newPassForm.allowed_payment_methods.includes('external_app')}
                                      onCheckedChange={(checked) => {
                                        const methods = checked
                                          ? [...p.newPassForm.allowed_payment_methods, 'external_app']
                                          : p.newPassForm.allowed_payment_methods.filter(m => m !== 'external_app');
                                        p.setNewPassForm({ ...p.newPassForm, allowed_payment_methods: methods });
                                      }}
                                    />
                                    <Label htmlFor="pm-external-app" className="text-sm font-normal cursor-pointer">
                                      {p.language === 'en' ? 'External App' : 'Application externe'}
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="pm-ambassador-cash"
                                      checked={p.newPassForm.allowed_payment_methods.includes('ambassador_cash')}
                                      onCheckedChange={(checked) => {
                                        const methods = checked
                                          ? [...p.newPassForm.allowed_payment_methods, 'ambassador_cash']
                                          : p.newPassForm.allowed_payment_methods.filter(m => m !== 'ambassador_cash');
                                        p.setNewPassForm({ ...p.newPassForm, allowed_payment_methods: methods });
                                      }}
                                    />
                                    <Label htmlFor="pm-ambassador-cash" className="text-sm font-normal cursor-pointer">
                                      {p.language === 'en' ? 'Cash on Delivery (Ambassador)' : 'Paiement à la livraison (Ambassadeur)'}
                                    </Label>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => p.setNewPassForm(null)}
                                >
                                  {p.language === 'en' ? 'Cancel' : 'Annuler'}
                                </Button>
                                <Button
                                  onClick={async () => {
                                    if (!p.eventForPassManagement?.id) return;
                                    if (!p.newPassForm.name.trim()) {
                                      toast({
                                        title: p.t.error,
                                        description: p.language === 'en' ? 'Pass name is required' : 'Le nom du pass est requis',
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    if (!p.newPassForm.price || p.newPassForm.price <= 0) {
                                      toast({
                                        title: p.t.error,
                                        description: p.language === 'en' ? 'Price must be greater than 0' : 'Le prix doit être supérieur à 0',
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    const maxQty = Number(p.newPassForm.max_quantity);
                                    if (!Number.isInteger(maxQty) || maxQty < 1) {
                                      toast({
                                        title: p.t.error,
                                        description: p.language === 'en' ? 'Stock quantity is required and must be at least 1' : 'La quantité en stock est requise et doit être au moins 1',
                                        variant: "destructive",
                                      });
                                      return;
                                    }

                                    try {
                                      // Primary exclusivity: handled server-side in POST /api/admin/passes/create

                                      // Normalize allowed_payment_methods: empty array = NULL (all methods allowed)
                                      const allowedPaymentMethods = p.newPassForm.allowed_payment_methods.length > 0
                                        ? p.newPassForm.allowed_payment_methods
                                        : null;

                                      const apiBase = getApiBaseUrl();
                                      const createRes = await fetch(`${apiBase}${API_ROUTES.ADMIN_PASS_CREATE}`, {
                                        method: 'POST',
                                        credentials: 'include',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          event_id: p.eventForPassManagement.id,
                                          name: p.newPassForm.name.trim(),
                                          price: Number(p.newPassForm.price.toFixed(2)),
                                          description: p.newPassForm.description || '',
                                          is_primary: p.newPassForm.is_primary,
                                          max_quantity: maxQty,
                                          allowed_payment_methods: allowedPaymentMethods,
                                        }),
                                      });
                                      const createJson = await createRes.json().catch(() => ({}));
                                      if (!createRes.ok) {
                                        throw new Error(
                                          typeof createJson.error === 'string'
                                            ? createJson.error
                                            : 'Failed to create pass'
                                        );
                                      }

                                      // Refresh passes list
                                      const passesResponse = await fetch(`${apiBase}/api/admin/passes/${p.eventForPassManagement.id}`, {
                                        credentials: 'include'
                                      });
                                      
                                      if (passesResponse.ok) {
                                        const passesResult = await passesResponse.json();
                                        const passesWithStock = (passesResult.passes || []).map((p: any) => ({
                                          id: p.id,
                                          name: p.name || '',
                                          price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
                                          description: p.description || '',
                                          is_primary: p.is_primary || false,
                                          max_quantity: p.max_quantity,
                                          sold_quantity: p.sold_quantity || 0,
                                          remaining_quantity: p.remaining_quantity,
                                          is_unlimited: p.is_unlimited || false,
                                          is_active: p.is_active !== undefined ? p.is_active : true,
                                          is_sold_out: p.is_sold_out || false,
                                          allowed_payment_methods: p.allowed_payment_methods || null,
                                          sold_by_payment_method: p.sold_by_payment_method || null
                                        }));
                                        p.setPassesForManagement(passesWithStock);
                                      }

                                      p.setNewPassForm(null);
                                      toast({
                                        title: p.t.success || (p.language === 'en' ? 'Success' : 'Succès'),
                                        description: p.language === 'en' ? 'Pass created successfully' : 'Pass créé avec succès',
                                      });
                                    } catch (error: any) {
                                      toast({
                                        title: p.t.error,
                                        description: error.message || (p.language === 'en' ? 'Failed to create pass' : 'Échec de la création du pass'),
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  <Save className="w-4 h-4 mr-2" />
                                  {p.language === 'en' ? 'Create Pass' : 'Créer un pass'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {p.isPassManagementLoading ? (
                          <div className="text-center py-8">
                            <Loader size="lg" className="mx-auto mb-4" />
                            <p className="text-muted-foreground">{p.language === 'en' ? 'Loading passes...' : 'Chargement des passes...'}</p>
                          </div>
                        ) : p.selectedPassForSettings ? (
                          /* Detail view: pass settings */
                          (() => {
                            const pass = p.selectedPassForSettings;
                            return (
                              <Card className="border-border">
                                <CardContent className="p-5 space-y-6">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-3 mb-1">
                                        {pass.is_primary && (
                                          <Badge variant="default" className="text-xs">
                                            {p.language === 'en' ? 'PRIMARY' : 'PRINCIPAL'}
                                          </Badge>
                                        )}
                                        <span className="text-lg font-bold text-primary">{pass.price.toFixed(2)} TND</span>
                                      </div>
                                      {pass.description && (
                                        <p className="text-sm text-muted-foreground">{pass.description}</p>
                                      )}
                                    </div>
                                    {pass.id && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                          if (!pass.id || !p.eventForPassManagement?.id) return;
                                          if (pass.sold_quantity && pass.sold_quantity > 0) {
                                            toast({
                                              title: p.t.error,
                                              description: p.language === 'en'
                                                ? `Cannot delete pass "${pass.name}" - ${pass.sold_quantity} ticket(s) already sold. Deactivate it instead.`
                                                : `Impossible de supprimer le pass "${pass.name}" - ${pass.sold_quantity} billet(s) déjà vendu(s). Désactivez-le plutôt.`,
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          p.setConfirmDelete({ kind: 'delete-pass', passId: pass.id, passName: pass.name, eventId: p.eventForPassManagement.id });
                                        }}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        {p.language === 'en' ? 'Delete' : 'Supprimer'}
                                      </Button>
                                    )}
                                  </div>

                                  {/* Allowed Payment Methods */}
                                  {pass.id && (
                                    <div className="space-y-2 p-3 bg-muted/20 rounded-lg border">
                                      <Label className="text-sm font-semibold">
                                        {p.language === 'en' ? 'Allowed Payment Methods' : 'Méthodes de Paiement Autorisées'}
                                      </Label>
                                      <p className="text-xs text-muted-foreground mb-2">
                                        {p.language === 'en'
                                          ? 'If none selected, all payment methods are allowed.'
                                          : 'Si aucune n\'est sélectionnée, toutes les méthodes de paiement sont autorisées.'}
                                      </p>
                                      <div className="space-y-2">
                                        {['online', 'external_app', 'ambassador_cash'].map((method) => (
                                          <div key={method} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`pm-${method}-${pass.id}`}
                                              checked={(pass.allowed_payment_methods || []).includes(method)}
                                              onCheckedChange={async (checked) => {
                                                if (!pass.id) return;
                                                const currentMethods = pass.allowed_payment_methods || [];
                                                const newMethods = checked
                                                  ? [...currentMethods, method]
                                                  : currentMethods.filter(m => m !== method);
                                                try {
                                                  const apiBase = getApiBaseUrl();
                                                  const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/payment-methods`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    credentials: 'include',
                                                    body: JSON.stringify({ allowed_payment_methods: newMethods.length > 0 ? newMethods : null })
                                                  });
                                                  if (!response.ok) {
                                                    const err = await response.json();
                                                    toast({ title: p.t.error, description: err.error || err.details || (p.language === 'en' ? 'Failed to update' : 'Échec'), variant: "destructive" });
                                                    return;
                                                  }
                                                  const result = await response.json();
                                                  const updatedPasses = [...p.passesForManagement];
                                                  const idx = updatedPasses.findIndex(pp => pp.id === pass.id);
                                                  if (idx >= 0) updatedPasses[idx] = { ...pass, allowed_payment_methods: result.pass.allowed_payment_methods || null };
                                                  p.setPassesForManagement(updatedPasses);
                                                  p.setSelectedPassForSettings(updatedPasses[idx] || pass);
                                                  toast({ title: p.t.success || 'Success', description: p.language === 'en' ? 'Payment methods updated' : 'Méthodes mises à jour' });
                                                } catch (e: any) {
                                                  toast({ title: p.t.error, description: e.message || (p.language === 'en' ? 'Failed' : 'Échec'), variant: "destructive" });
                                                }
                                              }}
                                            />
                                            <Label htmlFor={`pm-${method}-${pass.id}`} className="text-sm font-normal cursor-pointer">
                                              {method === 'online' ? (p.language === 'en' ? 'Online Payment' : 'Paiement en ligne')
                                                : method === 'external_app' ? (p.language === 'en' ? 'External App' : 'Application externe')
                                                : (p.language === 'en' ? 'Cash on Delivery (Ambassador)' : 'Paiement à la livraison (Ambassadeur)')}
                                            </Label>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Sales by payment method */}
                                  {pass.id && (
                                    <div className="space-y-2 p-3 bg-muted/20 rounded-lg border">
                                      <Label className="text-sm font-semibold">
                                        {p.language === 'en' ? 'Sales by payment method' : 'Ventes par type de paiement'}
                                      </Label>
                                      <p className="text-xs text-muted-foreground mb-2">
                                        {p.language === 'en'
                                          ? 'Number of passes sold per payment method for this pass.'
                                          : 'Nombre de passes vendus par méthode de paiement pour ce pass.'}
                                      </p>
                                      <ul className="space-y-1.5 text-sm">
                                        <li className="flex justify-between">
                                          <span>{p.language === 'en' ? 'Online Payment' : 'Paiement en ligne'}</span>
                                          <span className="font-medium">{pass.sold_by_payment_method?.online ?? 0}</span>
                                        </li>
                                        <li className="flex justify-between">
                                          <span>{p.language === 'en' ? 'Cash on Delivery (Ambassador)' : 'Paiement à la livraison (Ambassadeur)'}</span>
                                          <span className="font-medium">{pass.sold_by_payment_method?.ambassador_cash ?? 0}</span>
                                        </li>
                                        <li className="flex justify-between">
                                          <span>{p.language === 'en' ? 'Point de Vente (POS)' : 'Point de vente (POS)'}</span>
                                          <span className="font-medium">{pass.sold_by_payment_method?.pos ?? 0}</span>
                                        </li>
                                        <li className="flex justify-between">
                                          <span>{p.language === 'en' ? 'External App' : 'Application externe'}</span>
                                          <span className="font-medium">{pass.sold_by_payment_method?.external_app ?? 0}</span>
                                        </li>
                                      </ul>
                                    </div>
                                  )}

                                  {/* Max Stock */}
                                  {pass.id && (
                                    <div className="space-y-2">
                                      <Label>{p.language === 'en' ? 'Max Stock' : 'Stock Maximum'}</Label>
                                      <div className="flex gap-2">
                                        <Input
                                          type="number"
                                          min={pass.sold_quantity || 0}
                                          value={pass.max_quantity != null ? pass.max_quantity : ''}
                                          onChange={(e) => {
                                            const numValue = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                            const updatedPasses = [...p.passesForManagement];
                                            const idx = updatedPasses.findIndex(pp => pp.id === pass.id);
                                            if (idx >= 0) updatedPasses[idx] = { ...pass, max_quantity: numValue ?? pass.max_quantity ?? 0 };
                                            p.setPassesForManagement(updatedPasses);
                                            p.setSelectedPassForSettings(updatedPasses[idx] || pass);
                                          }}
                                          placeholder={p.language === 'en' ? 'Enter max stock' : 'Entrez le stock max'}
                                          className="flex-1"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            if (!pass.id) return;
                                            const maxQty = pass.max_quantity;
                                            if (maxQty == null || maxQty < (pass.sold_quantity || 0)) {
                                              toast({
                                                title: p.t.error,
                                                description: p.language === 'en'
                                                  ? `Cannot set max stock below sold quantity (${pass.sold_quantity})`
                                                  : `Impossible de définir le stock max en dessous de la quantité vendue (${pass.sold_quantity})`,
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            try {
                                              const apiBase = getApiBaseUrl();
                                              const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/stock`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ max_quantity: maxQty })
                                              });
                                              if (!response.ok) {
                                                const err = await response.json();
                                                toast({ title: p.t.error, description: err.error || err.details || (p.language === 'en' ? 'Failed to update stock' : 'Échec'), variant: "destructive" });
                                                return;
                                              }
                                              const result = await response.json();
                                              const updatedPasses = [...p.passesForManagement];
                                              const idx = updatedPasses.findIndex(pp => pp.id === pass.id);
                                              if (idx >= 0) updatedPasses[idx] = {
                                                ...pass,
                                                max_quantity: result.pass.max_quantity,
                                                remaining_quantity: result.pass.remaining_quantity,
                                                is_unlimited: result.pass.is_unlimited
                                              };
                                              p.setPassesForManagement(updatedPasses);
                                              p.setSelectedPassForSettings(updatedPasses[idx] || pass);
                                              toast({ title: p.t.success || 'Success', description: p.language === 'en' ? 'Stock updated' : 'Stock mis à jour' });
                                            } catch (e: any) {
                                              toast({ title: p.t.error, description: e.message || (p.language === 'en' ? 'Failed' : 'Échec'), variant: "destructive" });
                                            }
                                          }}
                                        >
                                          <Save className="w-4 h-4 mr-2" />
                                          {p.language === 'en' ? 'Save' : 'Enregistrer'}
                                        </Button>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {p.language === 'en' ? `Minimum: ${pass.sold_quantity || 0}` : `Minimum: ${pass.sold_quantity || 0}`}
                                      </p>
                                    </div>
                                  )}

                                  {/* Status */}
                                  {pass.id && (
                                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                      <div>
                                        <Label className="text-sm font-medium">{p.language === 'en' ? 'Pass Status' : 'Statut du Pass'}</Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {pass.is_active
                                            ? (p.language === 'en' ? 'Active - visible to customers' : 'Actif - visible par les clients')
                                            : (p.language === 'en' ? 'Inactive - hidden from customers' : 'Inactif - caché aux clients')}
                                        </p>
                                      </div>
                                      <Switch
                                        checked={pass.is_active !== false}
                                        onCheckedChange={async (checked) => {
                                          if (!pass.id) return;
                                          try {
                                            const apiBase = getApiBaseUrl();
                                            const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/activate`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              credentials: 'include',
                                              body: JSON.stringify({ is_active: checked })
                                            });
                                            if (!response.ok) {
                                              const err = await response.json();
                                              toast({ title: p.t.error, description: err.error || err.details || (p.language === 'en' ? 'Failed' : 'Échec'), variant: "destructive" });
                                              return;
                                            }
                                            const updatedPasses = [...p.passesForManagement];
                                            const idx = updatedPasses.findIndex(pp => pp.id === pass.id);
                                            if (idx >= 0) updatedPasses[idx] = { ...pass, is_active: checked };
                                            p.setPassesForManagement(updatedPasses);
                                            p.setSelectedPassForSettings(updatedPasses[idx] || pass);
                                            toast({ title: p.t.success || 'Success', description: p.language === 'en' ? `Pass ${checked ? 'activated' : 'deactivated'}` : `Pass ${checked ? 'activé' : 'désactivé'}` });
                                          } catch (e: any) {
                                            toast({ title: p.t.error, description: e.message || (p.language === 'en' ? 'Failed' : 'Échec'), variant: "destructive" });
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })()
                        ) : p.passesForManagement.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>{p.language === 'en' ? 'No passes found for this event' : 'Aucun pass trouvé pour cet événement'}</p>
                          </div>
                        ) : (
                          /* List view: cards on small screens, table from md up */
                          <>
                            <div className="md:hidden space-y-3">
                              {p.passesForManagement.map((pass, index) => {
                                const remaining =
                                  pass.remaining_quantity ??
                                  (pass.max_quantity != null
                                    ? Math.max(0, pass.max_quantity - (pass.sold_quantity || 0))
                                    : 0);
                                return (
                                  <button
                                    key={pass.id || index}
                                    type="button"
                                    onClick={() => {
                                      // If the "Add pass" form is open, close it when selecting an existing pass.
                                      p.setNewPassForm(null);
                                      p.setSelectedPassForSettings(pass);
                                    }}
                                    className="w-full text-left rounded-lg border border-border bg-card/30 p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 gap-y-1 mb-3">
                                      {pass.is_primary ? (
                                        <Badge variant="default" className="text-xs shrink-0">
                                          {p.language === 'en' ? 'PRIMARY' : 'PRINCIPAL'}
                                        </Badge>
                                      ) : null}
                                      <span className="font-semibold text-base break-words">{pass.name}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                      <div>
                                        <span className="text-muted-foreground text-xs block mb-0.5">
                                          {p.language === 'en' ? 'Price' : 'Prix'}
                                        </span>
                                        <span className="font-semibold text-primary tabular-nums">
                                          {pass.price.toFixed(2)} TND
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground text-xs block mb-0.5">
                                          {p.language === 'en' ? 'Sold' : 'Vendus'}
                                        </span>
                                        <span className="font-medium tabular-nums">{pass.sold_quantity || 0}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground text-xs block mb-0.5">
                                          {p.language === 'en' ? 'Remaining' : 'Restants'}
                                        </span>
                                        <span className="font-medium tabular-nums">{remaining}</span>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {pass.is_sold_out && (
                                        <Badge variant="destructive" className="text-xs">
                                          {p.language === 'en' ? 'Sold Out' : 'Épuisé'}
                                        </Badge>
                                      )}
                                      {!pass.is_active && (
                                        <Badge variant="secondary" className="text-xs">
                                          {p.language === 'en' ? 'Inactive' : 'Inactif'}
                                        </Badge>
                                      )}
                                      {!pass.is_sold_out && pass.is_active && (
                                        <Badge variant="outline" className="text-xs text-green-600 border-green-600/40">
                                          {p.language === 'en' ? 'Active' : 'Actif'}
                                        </Badge>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="hidden md:block rounded-lg border overflow-x-auto">
                              <table className="w-full min-w-[640px] text-sm">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="text-left p-3 font-medium">{p.language === 'en' ? 'Pass' : 'Pass'}</th>
                                    <th className="text-left p-3 font-medium">{p.language === 'en' ? 'Price' : 'Prix'}</th>
                                    <th className="text-left p-3 font-medium">{p.language === 'en' ? 'Sold' : 'Vendus'}</th>
                                    <th className="text-left p-3 font-medium">{p.language === 'en' ? 'Remaining' : 'Restants'}</th>
                                    <th className="text-left p-3 font-medium">{p.language === 'en' ? 'Status' : 'Statut'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.passesForManagement.map((pass, index) => {
                                    const remaining =
                                      pass.remaining_quantity ??
                                      (pass.max_quantity != null
                                        ? Math.max(0, pass.max_quantity - (pass.sold_quantity || 0))
                                        : 0);
                                    return (
                                      <tr
                                        key={pass.id || index}
                                        className="border-t cursor-pointer hover:bg-muted/30 transition-colors"
                                        onClick={() => p.setSelectedPassForSettings(pass)}
                                      >
                                        <td className="p-3">
                                          <div className="flex flex-wrap items-center gap-2">
                                            {pass.is_primary && (
                                              <Badge variant="default" className="text-xs shrink-0">
                                                {p.language === 'en' ? 'PRIMARY' : 'PRINCIPAL'}
                                              </Badge>
                                            )}
                                            <span className="font-medium">{pass.name}</span>
                                          </div>
                                        </td>
                                        <td className="p-3 font-semibold text-primary whitespace-nowrap">
                                          {pass.price.toFixed(2)} TND
                                        </td>
                                        <td className="p-3 tabular-nums">{pass.sold_quantity || 0}</td>
                                        <td className="p-3 font-medium tabular-nums">{remaining}</td>
                                        <td className="p-3">
                                          <div className="flex flex-wrap gap-1">
                                            {pass.is_sold_out && (
                                              <Badge variant="destructive" className="text-xs">
                                                {p.language === 'en' ? 'Sold Out' : 'Épuisé'}
                                              </Badge>
                                            )}
                                            {!pass.is_active && (
                                              <Badge variant="secondary" className="text-xs">
                                                {p.language === 'en' ? 'Inactive' : 'Inactif'}
                                              </Badge>
                                            )}
                                            {!pass.is_sold_out && pass.is_active && (
                                              <Badge variant="outline" className="text-xs text-green-600">
                                                {p.language === 'en' ? 'Active' : 'Actif'}
                                              </Badge>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex justify-end gap-2 mt-6">
                        <DialogClose asChild>
                          <Button variant="outline">
                            {p.language === 'en' ? 'Close' : 'Fermer'}
                          </Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {p.events.map((event, index) => (
                    <Card 
                      key={event.id}
                      className="transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg"
                    >
                      <CardContent className="p-6">
                        {event.poster_url && (
                          <div className="relative">
                            <img 
                              src={event.poster_url} 
                              alt={event.name} 
                              className="w-full h-48 object-cover rounded-lg mb-4 transform transition-transform duration-300 hover:scale-105" 
                            />
                          </div>
                        )}
                        <h3 className="text-lg font-semibold mb-2">
                          {event.name}
                        </h3>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <CalendarIcon className="w-4 h-4 animate-pulse" />
                            <span>{formatDateDMY(event.date, p.language)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 animate-pulse" />
                            <span>{event.venue}, {event.city}</span>
                          </div>
                          {event.passes && event.passes.length > 0 && (
                            <div className="flex items-center space-x-2">
                              <DollarSign className="w-4 h-4 animate-pulse" />
                              <span>
                                {event.passes.length} {p.language === 'en' ? 'pass(es)' : 'pass(es)'} available
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-stretch gap-3 mt-4">
                          {/* Row 1: Edit (modify event) */}
                          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 p-2 shadow-sm">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 min-w-[7rem] px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground rounded-sm transition-all duration-200"
                              disabled={openingEditEventId === event.id}
                              onClick={async () => {
                              setOpeningEditEventId(event.id);
                              try {
                                const apiBase = getApiBaseUrl();
                                const passesResponse = await fetch(`${apiBase}/api/admin/passes/${event.id}`, {
                                  credentials: "include",
                                });
                                let finalPasses: EventPass[] = [];
                                if (passesResponse.ok) {
                                  const passesResult = await passesResponse.json();
                                  finalPasses = (passesResult.passes || []).map((pp: any) => ({
                                    id: pp.id,
                                    name: pp.name || "",
                                    price:
                                      typeof pp.price === "number"
                                        ? pp.price
                                        : pp.price
                                          ? parseFloat(pp.price)
                                          : 0,
                                    description: pp.description || "",
                                    is_primary: pp.is_primary || false,
                                  }));
                                } else {
                                  console.error("Admin passes fetch failed", passesResponse.status);
                                  toast({
                                    title: p.t.error,
                                    description:
                                      p.language === "en"
                                        ? "Could not load passes for this event."
                                        : "Impossible de charger les passes.",
                                    variant: "destructive",
                                  });
                                }
                                const { passes: _, ...eventWithoutPasses } = event;
                                const eventWithPasses: Event = {
                                  ...eventWithoutPasses,
                                  passes: finalPasses,
                                };
                                p.setPendingGalleryImages([]);
                                p.setPendingGalleryVideos([]);
                                p.setPassValidationErrors({});
                                p.setEditingEvent(eventWithPasses);
                                setTimeout(() => {
                                  p.setIsEventDialogOpen(true);
                                }, 0);
                              } catch (err) {
                                console.error(err);
                                toast({
                                  title: p.t.error,
                                  description: p.language === "en" ? "Failed to open editor" : "Échec",
                                  variant: "destructive",
                                });
                              } finally {
                                // If the dialog didn't open (error), re-enable the button.
                                // If it did open, the effect above will clear the state.
                                setTimeout(() => {
                                  setOpeningEditEventId((cur) => (cur === event.id && !p.isEventDialogOpen ? null : cur));
                                }, 50);
                              }
                            }}
                          >
                            {openingEditEventId === event.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 shrink-0 animate-spin" />
                            ) : (
                              <Edit className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            )}
                            {openingEditEventId === event.id
                              ? (p.language === "en" ? "Opening..." : "Ouverture…")
                              : p.t.edit}
                          </Button>
                          </div>
                          <div className="rounded-md border border-border/50 border-destructive/30 bg-muted/30 p-2 shadow-sm">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => p.handleDeleteEvent(event.id)}
                              className="h-8 w-full min-w-[7rem] px-3 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-sm transition-all duration-200 justify-start"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                              {p.t.delete}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {p.events.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{p.t.noEvents}</p>
                  </div>
                )}
    </TabsContent>
  );
}

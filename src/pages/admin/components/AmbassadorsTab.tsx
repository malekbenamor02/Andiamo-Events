/**
 * Admin Dashboard — Ambassadors Management tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React, { useState, useMemo } from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  Download,
  Search,
} from "lucide-react";
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from "@/lib/constants";
import { formatAmbassadorLocationLabel } from "@/lib/ambassadors/extraVilles";
import { EditAmbassadorForm } from "./EditAmbassadorForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  Ambassador,
  NewAmbassadorForm,
  AmbassadorErrors,
} from "../types";

export interface AmbassadorsTabTranslation {
  add: string;
  cancel: string;
  save: string;
  edit: string;
  delete: string;
  ambassadorName: string;
  ambassadorPhone: string;
  ambassadorEmail: string;
  ambassadorCity: string;
  ambassadorPassword: string;
  noAmbassadors: string;
  error?: string;
}

export interface AmbassadorsTabProps {
  language: "en" | "fr";
  t: AmbassadorsTabTranslation;
  ambassadors: Ambassador[];
  editingAmbassador: Ambassador | null;
  setEditingAmbassador: (a: Ambassador | null) => void;
  newAmbassadorForm: NewAmbassadorForm;
  setNewAmbassadorForm: (v: NewAmbassadorForm | ((prev: NewAmbassadorForm) => NewAmbassadorForm)) => void;
  ambassadorErrors: AmbassadorErrors;
  setAmbassadorErrors: (v: AmbassadorErrors | ((prev: AmbassadorErrors) => AmbassadorErrors)) => void;
  isAmbassadorDialogOpen: boolean;
  setIsAmbassadorDialogOpen: (open: boolean) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  processingId: string | null;
  onExportExcel: () => Promise<void>;
  onSaveAmbassador: (ambassador: Ambassador) => Promise<void>;
  onToggleStatus: (ambassador: Ambassador) => void;
  onRequestDelete: (ambassador: Ambassador) => void;
  onBulkPause: (ambassadors: Ambassador[]) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
}

/** Mask email for display: show first 2 chars of local part + ***@ + domain */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const showLocal = local.length <= 2 ? local : local.slice(0, 2) + "***";
  return `${showLocal}@${domain}`;
}

const EMPTY_NEW_FORM: NewAmbassadorForm = {
  full_name: "",
  age: "",
  phone_number: "",
  email: "",
  city: "",
  ville: "",
  social_link: "",
  motivation: "",
};

export function AmbassadorsTab({
  language,
  t,
  ambassadors,
  editingAmbassador,
  setEditingAmbassador,
  newAmbassadorForm,
  setNewAmbassadorForm,
  ambassadorErrors,
  setAmbassadorErrors,
  isAmbassadorDialogOpen,
  setIsAmbassadorDialogOpen,
  showPassword,
  setShowPassword,
  processingId,
  onExportExcel,
  onSaveAmbassador,
  onToggleStatus,
  onRequestDelete,
  onBulkPause,
  onBulkDelete,
}: AmbassadorsTabProps) {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<"active" | "paused">("active");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterVille, setFilterVille] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | "pause" | "delete">(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const displayList = useMemo(
    () =>
      ambassadors.filter(
        (amb) => amb.status === "approved" || amb.status === "suspended"
      ),
    [ambassadors]
  );

  const filteredList = useMemo(() => {
    const phone = filterPhone.trim().replace(/\D/g, "");
    const email = filterEmail.trim().toLowerCase();
    const city = filterCity.trim().toLowerCase();
    const ville = filterVille.trim().toLowerCase();
    return displayList.filter((amb) => {
      if (filterStatus === "active" && amb.status !== "approved") return false;
      if (filterStatus === "paused" && amb.status !== "suspended") return false;
      if (phone && !(amb.phone || "").replace(/\D/g, "").includes(phone))
        return false;
      if (email && !(amb.email || "").toLowerCase().includes(email))
        return false;
      if (city && !(amb.city || "").toLowerCase().includes(city))
        return false;
      if (ville && !(amb.ville || "").toLowerCase().includes(ville))
        return false;
      return true;
    });
  }, [displayList, filterStatus, filterPhone, filterEmail, filterCity, filterVille]);

  const selectedAmbassadors = useMemo(
    () => ambassadors.filter((amb) => selectedIds.has(amb.id)),
    [ambassadors, selectedIds]
  );

  const visibleIds = useMemo(
    () => filteredList.map((amb) => amb.id),
    [filteredList]
  );

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const handleToggleSelectAllVisible = (checked: boolean | "indeterminate") => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleIds.forEach((id) => next.add(id));
      } else {
        visibleIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handleBulkConfirm = async () => {
    if (!bulkAction || selectedIds.size === 0) return;

    setBulkProcessing(true);
    try {
      if (bulkAction === "pause") {
        const toPause = selectedAmbassadors.filter((amb) => amb.status === "approved");
        if (toPause.length > 0) {
          await onBulkPause(toPause);
        }
      } else if (bulkAction === "delete") {
        await onBulkDelete(Array.from(selectedIds));
      }
      setSelectedIds(new Set());
      setBulkAction(null);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <TabsContent value="ambassadors" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {language === "en" ? "Ambassadors" : "Ambassadeurs"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filteredList.length.toLocaleString()}{" "}
            {language === "en" ? "shown" : "affichés"}
            {displayList.length !== filteredList.length
              ? ` · ${displayList.length.toLocaleString()} ${language === "en" ? "total" : "au total"}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExportExcel} className="gap-2">
            <Download className="h-4 w-4" />
            {language === "en" ? "Export Excel" : "Exporter Excel"}
          </Button>
          <Dialog
            open={isAmbassadorDialogOpen}
            onOpenChange={setIsAmbassadorDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => {
                  setEditingAmbassador({} as Ambassador);
                  setAmbassadorErrors({});
                  setIsAmbassadorDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t.add}
              </Button>
            </DialogTrigger>
            <DialogContent
              className={cn(
                "ambassador-edit-dialog flex max-h-[90dvh] w-[min(100%,calc(100vw-2rem))] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl p-0 sm:rounded-xl",
                "[&_input]:transition-none [&_textarea]:transition-none [&_[role=combobox]]:transition-none"
              )}
            >
              <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 py-4 sm:px-6">
                <DialogTitle className="text-base font-semibold">
                  {editingAmbassador?.id
                    ? language === "en"
                      ? "Edit ambassador"
                      : "Modifier l'ambassadeur"
                    : language === "en"
                      ? "Add ambassador"
                      : "Ajouter un ambassadeur"}
                </DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 scrollbar-hidden sm:px-6">
              {editingAmbassador?.id ? (
                <EditAmbassadorForm
                  language={language}
                  t={t}
                  ambassador={editingAmbassador}
                  setAmbassador={setEditingAmbassador}
                  errors={ambassadorErrors}
                  setErrors={setAmbassadorErrors}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="newAmbassadorName">
                        {language === "en" ? "Full Name" : "Nom Complet"}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="newAmbassadorName"
                        value={newAmbassadorForm.full_name}
                        onChange={(e) => {
                          setNewAmbassadorForm((prev) => ({
                            ...prev,
                            full_name: e.target.value,
                          }));
                          if (ambassadorErrors.full_name) {
                            setAmbassadorErrors((prev) => ({
                              ...prev,
                              full_name: undefined,
                            }));
                          }
                        }}
                        className={ambassadorErrors.full_name ? "border-destructive" : ""}
                        required
                      />
                      {ambassadorErrors.full_name && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.full_name}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="newAmbassadorAge">
                        {language === "en" ? "Age" : "Âge"}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="newAmbassadorAge"
                        type="number"
                        min={16}
                        max={99}
                        value={newAmbassadorForm.age}
                        onChange={(e) => {
                          setNewAmbassadorForm((prev) => ({
                            ...prev,
                            age: e.target.value,
                          }));
                          if (ambassadorErrors.full_name) {
                            setAmbassadorErrors((prev) => ({
                              ...prev,
                              full_name: undefined,
                            }));
                          }
                        }}
                        className={ambassadorErrors.full_name ? "border-destructive" : ""}
                        required
                      />
                      {ambassadorErrors.full_name && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.full_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="newAmbassadorPhone">
                        {language === "en"
                          ? "Phone Number"
                          : "Numéro de Téléphone"}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="newAmbassadorPhone"
                        type="tel"
                        value={newAmbassadorForm.phone_number}
                        onChange={(e) => {
                          const value = e.target.value;
                          const digitsOnly = value.replace(/\D/g, "");
                          const limited = digitsOnly.slice(0, 8);
                          setNewAmbassadorForm((prev) => ({
                            ...prev,
                            phone_number: limited,
                          }));
                          if (ambassadorErrors.phone) {
                            setAmbassadorErrors((prev) => ({
                              ...prev,
                              phone: undefined,
                            }));
                          }
                        }}
                        placeholder="24951234"
                        className={ambassadorErrors.phone ? "border-destructive" : ""}
                        required
                      />
                      {ambassadorErrors.phone && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.phone}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === "en"
                          ? "8 digits starting with 2, 4, 9, or 5"
                          : "8 chiffres commençant par 2, 4, 9 ou 5"}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="newAmbassadorEmail">
                        {language === "en" ? "Email" : "Email"}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="newAmbassadorEmail"
                        type="email"
                        value={newAmbassadorForm.email}
                        onChange={(e) => {
                          setNewAmbassadorForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }));
                          if (ambassadorErrors.email) {
                            setAmbassadorErrors((prev) => ({
                              ...prev,
                              email: undefined,
                            }));
                          }
                        }}
                        className={
                          ambassadorErrors.email ? "border-destructive" : ""
                        }
                        required
                      />
                      {ambassadorErrors.email && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="newAmbassadorCity">
                        {language === "en" ? "City" : "Ville"}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={newAmbassadorForm.city}
                        onValueChange={(value) => {
                          setNewAmbassadorForm((prev) => ({
                            ...prev,
                            city: value,
                            ville:
                              value === "Sousse" || value === "Tunis"
                                ? prev.ville
                                : "",
                          }));
                          if (ambassadorErrors.city) {
                            setAmbassadorErrors((prev) => ({
                              ...prev,
                              city: undefined,
                            }));
                          }
                        }}
                      >
                        <SelectTrigger
                          className={
                            ambassadorErrors.city ? "border-destructive" : ""
                          }
                        >
                          <SelectValue
                            placeholder={
                              language === "en"
                                ? "Select a city"
                                : "Sélectionner une ville"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {CITIES.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {ambassadorErrors.city && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.city}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="newAmbassadorSocial">
                        {language === "en"
                          ? "Instagram Link"
                          : "Lien Instagram"}
                      </Label>
                      <Input
                        id="newAmbassadorSocial"
                        type="url"
                        value={newAmbassadorForm.social_link}
                        onChange={(e) => {
                          setNewAmbassadorForm((prev) => ({
                            ...prev,
                            social_link: e.target.value,
                          }));
                          if (ambassadorErrors.social_link) {
                            setAmbassadorErrors((prev) => ({
                              ...prev,
                              social_link: undefined,
                            }));
                          }
                        }}
                        placeholder="https://www.instagram.com/username"
                        className={ambassadorErrors.social_link ? "border-destructive" : ""}
                      />
                      {ambassadorErrors.social_link && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.social_link}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === "en"
                          ? "Must start with https://www.instagram.com/ or https://instagram.com/"
                          : "Doit commencer par https://www.instagram.com/ ou https://instagram.com/"}
                      </p>
                    </div>
                  </div>
                  {(newAmbassadorForm.city === "Sousse" ||
                    newAmbassadorForm.city === "Tunis") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="newAmbassadorVille">
                          {language === "en"
                            ? "Ville (Neighborhood)"
                            : "Quartier"}{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={newAmbassadorForm.ville}
                          onValueChange={(value) => {
                            setNewAmbassadorForm((prev) => ({
                              ...prev,
                              ville: value,
                            }));
                            if (ambassadorErrors.ville) {
                              setAmbassadorErrors((prev) => ({
                                ...prev,
                                ville: undefined,
                              }));
                            }
                          }}
                        >
                          <SelectTrigger
                            className={
                              ambassadorErrors.ville ? "border-destructive" : ""
                            }
                          >
                            <SelectValue
                              placeholder={
                                language === "en"
                                  ? "Select a neighborhood"
                                  : "Sélectionner un quartier"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {newAmbassadorForm.city === "Sousse" &&
                              SOUSSE_VILLES.map((ville) => (
                                <SelectItem key={ville} value={ville}>
                                  {ville}
                                </SelectItem>
                              ))}
                            {newAmbassadorForm.city === "Tunis" &&
                              TUNIS_VILLES.map((ville) => (
                                <SelectItem key={ville} value={ville}>
                                  {ville}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {ambassadorErrors.ville && (
                          <p className="text-sm text-destructive mt-1">
                            {ambassadorErrors.ville}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="newAmbassadorMotivation">
                      {language === "en" ? "Motivation" : "Motivation"}
                    </Label>
                    <Textarea
                      id="newAmbassadorMotivation"
                      value={newAmbassadorForm.motivation}
                      onChange={(e) =>
                        setNewAmbassadorForm((prev) => ({
                          ...prev,
                          motivation: e.target.value,
                        }))
                      }
                      placeholder={
                        language === "en"
                          ? "Why do you want to become an ambassador? (optional)"
                          : "Pourquoi voulez-vous devenir ambassadeur ? (optionnel)"
                      }
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === "en"
                        ? "Optional field"
                        : "Champ optionnel"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      {language === "en"
                        ? "An approval email with login credentials is sent automatically after creation."
                        : "Un e-mail d'approbation avec les identifiants est envoyé automatiquement après la création."}
                    </p>
                  </div>
                </div>
              )}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-5 py-4 sm:px-6">
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewAmbassadorForm(EMPTY_NEW_FORM);
                      setAmbassadorErrors({});
                    }}
                  >
                    {t.cancel}
                  </Button>
                </DialogClose>
                <Button
                  onClick={async () => {
                    if (editingAmbassador?.id) {
                      await onSaveAmbassador(editingAmbassador);
                    } else {
                      await onSaveAmbassador({} as Ambassador);
                    }
                    if (!editingAmbassador?.id) {
                      setIsAmbassadorDialogOpen(false);
                    }
                  }}
                  disabled={processingId === "new-ambassador"}
                >
                  {processingId === "new-ambassador" ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      {language === "en" ? "Creating..." : "Création..."}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {t.save}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[160px] flex-1 sm:max-w-[200px]">
            <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "Phone" : "Téléphone"}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={language === "en" ? "Filter…" : "Filtrer…"}
                value={filterPhone}
                onChange={(e) => setFilterPhone(e.target.value)}
                className="h-9 border-border/60 bg-background pl-9"
              />
            </div>
          </div>
          <div className="min-w-[160px] flex-1 sm:max-w-[220px]">
            <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "Email" : "E-mail"}
            </Label>
            <Input
              placeholder={language === "en" ? "Filter…" : "Filtrer…"}
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value)}
              className="h-9 border-border/60 bg-background"
            />
          </div>
          <div className="min-w-[120px]">
            <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "Status" : "Statut"}
            </Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as "active" | "paused")}
            >
              <SelectTrigger className="h-9 w-[140px] bg-background">
                <SelectValue />
              </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">
                {language === "en" ? "Active" : "Actif"}
              </SelectItem>
              <SelectItem value="paused">
                {language === "en" ? "Paused" : "En pause"}
              </SelectItem>
            </SelectContent>
          </Select>
          </div>
          <div className="min-w-[120px]">
            <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "City" : "Ville"}
            </Label>
            <Select
              value={filterCity || "_all"}
              onValueChange={(v) => setFilterCity(v === "_all" ? "" : v)}
            >
              <SelectTrigger className="h-9 w-[160px] bg-background">
                <SelectValue placeholder={language === "en" ? "City" : "Ville"} />
              </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">
                {language === "en" ? "All cities" : "Toutes les villes"}
              </SelectItem>
              {CITIES.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="min-w-[140px]">
            <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "Neighborhood" : "Quartier"}
            </Label>
            <Select
              value={filterVille || "_all"}
              onValueChange={(v) => setFilterVille(v === "_all" ? "" : v)}
            >
              <SelectTrigger className="h-9 w-[180px] bg-background">
                <SelectValue placeholder={language === "en" ? "Neighborhood" : "Quartier"} />
              </SelectTrigger>
            <SelectContent side="bottom" avoidCollisions={false}>
              <SelectItem value="_all">
                {language === "en" ? "All neighborhoods" : "Tous les quartiers"}
              </SelectItem>
              {filterCity === "Sousse" &&
                SOUSSE_VILLES.map((ville) => (
                  <SelectItem key={`sousse-${ville}`} value={ville}>
                    {ville}
                  </SelectItem>
                ))}
              {filterCity === "Tunis" &&
                TUNIS_VILLES.map((ville) => (
                  <SelectItem key={`tunis-${ville}`} value={ville}>
                    {ville}
                  </SelectItem>
                ))}
              {!filterCity &&
                [
                  ...SOUSSE_VILLES.map((v) => ({ v, key: `sousse-${v}` })),
                  ...TUNIS_VILLES.map((v) => ({ v, key: `tunis-${v}` })),
                ].map(({ v, key }) => (
                  <SelectItem key={key} value={v}>
                    {v}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterStatus("active");
              setFilterPhone("");
              setFilterEmail("");
              setFilterCity("");
              setFilterVille("");
            }}
            className="h-9 shrink-0 text-xs text-muted-foreground"
          >
            {language === "en" ? "Clear filters" : "Effacer les filtres"}
          </Button>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} {language === "en" ? "selected" : "sélectionné(s)"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("pause")}
              disabled={bulkProcessing}
              className="h-8 border-amber-500/40 text-xs text-amber-600 hover:bg-amber-500/10"
            >
              {language === "en" ? "Pause selected" : "Mettre en pause"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("delete")}
              disabled={bulkProcessing}
              className="h-8 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
            >
              {language === "en" ? "Delete selected" : "Supprimer la sélection"}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-10 px-2 py-2.5">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                  onCheckedChange={handleToggleSelectAllVisible}
                  aria-label={language === "en" ? "Select all ambassadors" : "Tout sélectionner"}
                />
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t.ambassadorName}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {language === "en" ? "Status" : "Statut"}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {language === "en" ? "Active" : "Actif"}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t.ambassadorPhone}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t.ambassadorEmail}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {language === "en" ? "Location" : "Localisation"}
              </TableHead>
              <TableHead className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {language === "en" ? "Actions" : "Actions"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.map((ambassador) => (
              <TableRow
                key={ambassador.id}
                className="border-border/60 hover:bg-muted/20"
              >
                <TableCell className="px-2 py-2.5">
                  <Checkbox
                    checked={selectedIds.has(ambassador.id)}
                    onCheckedChange={(checked) =>
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) {
                          next.add(ambassador.id);
                        } else {
                          next.delete(ambassador.id);
                        }
                        return next;
                      })
                    }
                    aria-label={language === "en" ? "Select ambassador" : "Sélectionner l'ambassadeur"}
                  />
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <span className="font-medium text-foreground">{ambassador.full_name}</span>
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      ambassador.status === "approved"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {ambassador.status === "approved"
                      ? language === "en"
                        ? "Active"
                        : "Actif"
                      : language === "en"
                        ? "Paused"
                        : "En pause"}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <Switch
                    checked={ambassador.status === "approved"}
                    onCheckedChange={() => onToggleStatus(ambassador)}
                    disabled={processingId === ambassador.id}
                  />
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(ambassador.phone);
                        toast({
                          title: language === "en" ? "Copied" : "Copié",
                          description: language === "en" ? "Phone number copied" : "Numéro copié",
                        });
                      } catch {
                        toast({
                          title: t.error ?? (language === "en" ? "Error" : "Erreur"),
                          variant: "destructive",
                        });
                      }
                    }}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    {ambassador.phone}
                  </button>
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {ambassador.email ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(ambassador.email!);
                          toast({
                            title: language === "en" ? "Copied" : "Copié",
                            description: language === "en" ? "Email copied" : "Email copié",
                          });
                        } catch {
                          toast({
                            title: t.error ?? (language === "en" ? "Error" : "Erreur"),
                            variant: "destructive",
                          });
                        }
                      }}
                      className="text-sm text-muted-foreground hover:text-primary hover:underline"
                    >
                      {maskEmail(ambassador.email)}
                    </button>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                  {(() => {
                    const { label, title } = formatAmbassadorLocationLabel(ambassador);
                    return (
                      <span title={title}>{label}</span>
                    );
                  })()}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        let ambassadorAge: number | undefined;
                        let ambassadorSocialLink: string | undefined;
                        const { data: appData } = await supabase
                          .from("ambassador_applications")
                          .select("age, social_link")
                          .eq("phone_number", ambassador.phone)
                          .eq("status", "approved")
                          .order("created_at", { ascending: false })
                          .limit(1)
                          .maybeSingle();

                        if (appData) {
                          ambassadorAge = appData.age;
                          ambassadorSocialLink =
                            (appData as { social_link?: string }).social_link ??
                            undefined;
                        }

                        setEditingAmbassador({
                          ...ambassador,
                          age: ambassadorAge,
                          social_link:
                            ambassadorSocialLink || ambassador.social_link,
                          extra_villes: ambassador.extra_villes ?? [],
                        password: "",
                        });
                        setAmbassadorErrors({});
                        setIsAmbassadorDialogOpen(true);
                      }}
                      className="h-8 border-border/60 px-2.5 text-xs hover:bg-muted/50"
                    >
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      {t.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRequestDelete(ambassador)}
                      className="h-8 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {t.delete}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredList.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t.noAmbassadors}</p>
        </div>
      )}

      <Dialog
        open={!!bulkAction}
        onOpenChange={(open) => {
          if (!open && !bulkProcessing) {
            setBulkAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "pause"
                ? language === "en"
                  ? "Pause selected ambassadors"
                  : "Mettre en pause les ambassadeurs sélectionnés"
                : language === "en"
                  ? "Delete selected ambassadors"
                  : "Supprimer les ambassadeurs sélectionnés"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p>
              {bulkAction === "pause"
                ? language === "en"
                  ? "Are you sure you want to pause the selected ambassadors?"
                  : "Êtes-vous sûr de vouloir mettre en pause les ambassadeurs sélectionnés ?"
                : language === "en"
                  ? "Are you sure you want to delete the selected ambassadors? This action cannot be undone."
                  : "Êtes-vous sûr de vouloir supprimer les ambassadeurs sélectionnés ? Cette action est irréversible."}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === "en"
                ? `Selected: ${selectedIds.size} ambassador(s)`
                : `Sélectionné(s) : ${selectedIds.size} ambassadeur(s)`}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkAction(null)}
              disabled={bulkProcessing}
            >
              {language === "en" ? "Cancel" : "Annuler"}
            </Button>
            <Button
              variant={bulkAction === "delete" ? "destructive" : "default"}
              onClick={handleBulkConfirm}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? (
                <>
                  <Loader size="sm" className="mr-2" />
                  {language === "en" ? "Processing..." : "Traitement..."}
                </>
              ) : bulkAction === "pause" ? (
                language === "en" ? "Pause" : "Mettre en pause"
              ) : language === "en" ? (
                "Delete"
              ) : (
                "Supprimer"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

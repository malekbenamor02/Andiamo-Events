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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  Download,
  Phone,
  Mail,
  MapPin,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  ambassadorCommission: string;
  ambassadorPassword: string;
  noAmbassadors: string;
  error?: string;
}

export interface AmbassadorsTabProps {
  language: "en" | "fr";
  t: AmbassadorsTabTranslation;
  ambassadors: Ambassador[];
  animatedAmbassadors: Set<string>;
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
  animatedAmbassadors,
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
}: AmbassadorsTabProps) {
  const { toast } = useToast();
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterVille, setFilterVille] = useState("");

  const displayList = useMemo(
    () =>
      ambassadors.filter(
        (amb) => amb.status === "approved" || amb.status === "suspended"
      ),
    [ambassadors]
  );

  const filteredList = useMemo(() => {
    const name = filterName.trim().toLowerCase();
    const phone = filterPhone.trim().replace(/\D/g, "");
    const email = filterEmail.trim().toLowerCase();
    const city = filterCity.trim().toLowerCase();
    const ville = filterVille.trim().toLowerCase();
    return displayList.filter((amb) => {
      if (name && !(amb.full_name || "").toLowerCase().includes(name))
        return false;
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
  }, [displayList, filterName, filterPhone, filterEmail, filterCity, filterVille]);

  return (
    <TabsContent value="ambassadors" className="space-y-6">
      <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
        <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
          Ambassadors Management
        </h2>
        <div className="flex items-center gap-3 animate-in slide-in-from-right-4 duration-1000 delay-300">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            className="transform hover:scale-105 transition-all duration-300"
            style={{
              background: "#1F1F1F",
              borderColor: "#2A2A2A",
              color: "#FFFFFF",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#E21836";
              e.currentTarget.style.borderColor = "#E21836";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#1F1F1F";
              e.currentTarget.style.borderColor = "#2A2A2A";
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            {language === "en" ? "Export to Excel" : "Exporter vers Excel"}
          </Button>
          <Dialog
            open={isAmbassadorDialogOpen}
            onOpenChange={setIsAmbassadorDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingAmbassador({} as Ambassador);
                  setAmbassadorErrors({});
                  setIsAmbassadorDialogOpen(true);
                }}
                className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
              >
                <Plus className="w-4 h-4 mr-2 animate-pulse" />
                {t.add}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
              <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                  {editingAmbassador?.id
                    ? "Edit Ambassador"
                    : "Add New Ambassador"}
                </DialogTitle>
              </DialogHeader>
              {editingAmbassador?.id ? (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                      <Label htmlFor="ambassadorName">
                        {t.ambassadorName}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ambassadorName"
                        value={editingAmbassador?.full_name || ""}
                        onChange={(e) => {
                          setEditingAmbassador((prev) => ({
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
                        className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.full_name ? "border-destructive" : ""}`}
                        required
                      />
                      {ambassadorErrors.full_name && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.full_name}
                        </p>
                      )}
                    </div>
                    <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                      <Label htmlFor="ambassadorAge">
                        {language === "en" ? "Age" : "Âge"}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ambassadorAge"
                        type="number"
                        min={16}
                        max={99}
                        value={editingAmbassador?.age ?? ""}
                        onChange={(e) => {
                          const ageValue = e.target.value;
                          setEditingAmbassador((prev) => ({
                            ...prev,
                            age: ageValue ? parseInt(ageValue, 10) : undefined,
                          }));
                        }}
                        className="transition-all duration-300 focus:scale-105"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                      <Label htmlFor="ambassadorPhone">
                        {t.ambassadorPhone}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ambassadorPhone"
                        value={editingAmbassador?.phone || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          const digitsOnly = value.replace(/\D/g, "");
                          const limited = digitsOnly.slice(0, 8);
                          setEditingAmbassador((prev) => ({
                            ...prev,
                            phone: limited,
                          }));
                          if (ambassadorErrors.phone) {
                            setAmbassadorErrors((prev) => ({
                              ...prev,
                              phone: undefined,
                            }));
                          }
                        }}
                        placeholder="24951234"
                        className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.phone ? "border-destructive" : ""}`}
                        required
                      />
                      {ambassadorErrors.phone && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ambassadorEmail">
                        {t.ambassadorEmail}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ambassadorEmail"
                        type="email"
                        value={editingAmbassador?.email || ""}
                        onChange={(e) => {
                          setEditingAmbassador((prev) => ({
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
                        className={ambassadorErrors.email ? "border-destructive" : ""}
                        required
                      />
                      {ambassadorErrors.email && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.email}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="ambassadorCity">
                        {t.ambassadorCity}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={editingAmbassador?.city || ""}
                        onValueChange={(value) => {
                          setEditingAmbassador((prev) => ({
                            ...prev,
                            city: value,
                            ville:
                              value === "Sousse" || value === "Tunis"
                                ? prev?.ville ?? ""
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
                  </div>
                  {(editingAmbassador?.city === "Sousse" ||
                    editingAmbassador?.city === "Tunis") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ambassadorVille">
                          {language === "en"
                            ? "Ville (Neighborhood)"
                            : "Quartier"}{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={editingAmbassador?.ville || ""}
                          onValueChange={(value) => {
                            setEditingAmbassador((prev) => ({
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
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                language === "en"
                                  ? "Select a neighborhood"
                                  : "Sélectionner un quartier"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {editingAmbassador?.city === "Sousse" &&
                              SOUSSE_VILLES.map((ville) => (
                                <SelectItem key={ville} value={ville}>
                                  {ville}
                                </SelectItem>
                              ))}
                            {editingAmbassador?.city === "Tunis" &&
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
                    <Label htmlFor="ambassadorSocialLink">
                      {language === "en"
                        ? "Instagram Link"
                        : "Lien Instagram"}
                    </Label>
                    <Input
                      id="ambassadorSocialLink"
                      type="url"
                      value={editingAmbassador?.social_link || ""}
                      onChange={(e) => {
                        setEditingAmbassador((prev) => ({
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
                      className="transition-all duration-300 focus:scale-105"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === "en"
                        ? "Must start with https://www.instagram.com/ or https://instagram.com/"
                        : "Doit commencer par https://www.instagram.com/ ou https://instagram.com/"}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ambassadorCommission">
                        {t.ambassadorCommission}
                      </Label>
                      <Input
                        id="ambassadorCommission"
                        type="number"
                        step={0.01}
                        min={0}
                        max={100}
                        value={editingAmbassador?.commission_rate ?? ""}
                        onChange={(e) =>
                          setEditingAmbassador((prev) => ({
                            ...prev,
                            commission_rate:
                              parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="ambassadorPassword">
                        {t.ambassadorPassword}
                      </Label>
                      <div className="relative">
                        <Input
                          id="ambassadorPassword"
                          type={showPassword ? "text" : "password"}
                          value={editingAmbassador?.password || ""}
                          onChange={(e) => {
                            setEditingAmbassador((prev) => ({
                              ...prev,
                              password: e.target.value,
                            }));
                            if (ambassadorErrors.password) {
                              setAmbassadorErrors((prev) => ({
                                ...prev,
                                password: undefined,
                              }));
                            }
                          }}
                          className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.password ? "border-destructive" : ""}`}
                          placeholder={
                            language === "en"
                              ? "Leave empty to keep current password"
                              : "Laisser vide pour garder le mot de passe actuel"
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 transition-all duration-300 hover:scale-110"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Eye className="w-4 h-4 animate-pulse" />
                          )}
                        </button>
                      </div>
                      {ambassadorErrors.password && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.password}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === "en"
                          ? "Leave empty to keep current password"
                          : "Laisser vide pour garder le mot de passe actuel"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
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
                        className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.full_name ? "border-destructive" : ""}`}
                        required
                      />
                      {ambassadorErrors.full_name && (
                        <p className="text-sm text-destructive mt-1">
                          {ambassadorErrors.full_name}
                        </p>
                      )}
                    </div>
                    <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
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
                        className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.full_name ? "border-destructive" : ""}`}
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
                        className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.phone ? "border-destructive" : ""}`}
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
                        className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.social_link ? "border-destructive" : ""}`}
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
                      className="transition-all duration-300 focus:scale-105"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === "en"
                        ? "Optional field"
                        : "Champ optionnel"}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      {language === "en"
                        ? "📧 An approval email with login credentials will be automatically sent to the ambassador after creation."
                        : "📧 Un email d'approbation avec les identifiants de connexion sera automatiquement envoyé à l'ambassadeur après la création."}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-800">
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="transform hover:scale-105 transition-all duration-300"
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
                  className="transform hover:scale-105 transition-all duration-300"
                >
                  {processingId === "new-ambassador" ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      {language === "en" ? "Creating..." : "Création..."}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2 animate-pulse" />
                      {t.save}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            placeholder={language === "en" ? "Filter by name..." : "Filtrer par nom..."}
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="max-w-[200px] h-9"
          />
          <Input
            placeholder={language === "en" ? "Filter by phone..." : "Filtrer par téléphone..."}
            value={filterPhone}
            onChange={(e) => setFilterPhone(e.target.value)}
            className="max-w-[180px] h-9"
          />
          <Input
            placeholder={language === "en" ? "Filter by email..." : "Filtrer par email..."}
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            className="max-w-[220px] h-9"
          />
          <Select
            value={filterCity || "_all"}
            onValueChange={(v) => setFilterCity(v === "_all" ? "" : v)}
          >
            <SelectTrigger className="max-w-[160px] h-9">
              <SelectValue
                placeholder={language === "en" ? "City" : "Ville"}
              />
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
          <Select
            value={filterVille || "_all"}
            onValueChange={(v) => setFilterVille(v === "_all" ? "" : v)}
          >
            <SelectTrigger className="max-w-[180px] h-9">
              <SelectValue
                placeholder={language === "en" ? "Neighborhood" : "Quartier"}
              />
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilterName("");
              setFilterPhone("");
              setFilterEmail("");
              setFilterCity("");
              setFilterVille("");
            }}
            className="h-9 shrink-0"
          >
            {language === "en" ? "Clear filters" : "Effacer les filtres"}
          </Button>
        </div>
      <div className="rounded-lg border border-border/50 bg-card overflow-hidden animate-in fade-in duration-500">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="font-semibold">{t.ambassadorName}</TableHead>
              <TableHead className="font-semibold">
                {language === "en" ? "Status" : "Statut"}
              </TableHead>
              <TableHead className="font-semibold">
                {language === "en" ? "Active" : "Actif"}
              </TableHead>
              <TableHead className="font-semibold">{t.ambassadorPhone}</TableHead>
              <TableHead className="font-semibold">{t.ambassadorEmail}</TableHead>
              <TableHead className="font-semibold">
                {language === "en" ? "City / Neighborhood" : "Ville / Quartier"}
              </TableHead>
              <TableHead className="text-right font-semibold">
                {language === "en" ? "Actions" : "Actions"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.map((ambassador) => (
              <TableRow key={ambassador.id} className="border-border/50">
                <TableCell>
                  <span className="font-medium">{ambassador.full_name}</span>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-sm font-medium ${ambassador.status === "approved" ? "text-green-500" : "text-red-500"}`}
                  >
                    {ambassador.status === "approved"
                      ? language === "en"
                        ? "Active"
                        : "Actif"
                      : language === "en"
                        ? "Paused"
                        : "En Pause"}
                  </span>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={ambassador.status === "approved"}
                    onCheckedChange={() => onToggleStatus(ambassador)}
                    disabled={processingId === ambassador.id}
                    className="data-[state=checked]:bg-[#E21836]"
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
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
                    className="flex items-center gap-2 cursor-pointer hover:text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1 -mx-1"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    {ambassador.phone}
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">
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
                      className="flex items-center gap-2 cursor-pointer hover:text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1 -mx-1 text-left w-full"
                    >
                      <Mail className="w-4 h-4 shrink-0" />
                      {maskEmail(ambassador.email)}
                    </button>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0" />
                    {ambassador.ville
                      ? `${ambassador.city}, ${ambassador.ville}`
                      : ambassador.city}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
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
                        });
                        setAmbassadorErrors({});
                        setIsAmbassadorDialogOpen(true);
                      }}
                      className="shrink-0"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      {t.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onRequestDelete(ambassador)}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t.delete}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>
      {filteredList.length === 0 && (
        <div className="text-center py-8 animate-in fade-in duration-500">
          <p className="text-muted-foreground animate-pulse">
            {t.noAmbassadors}
          </p>
        </div>
      )}
    </TabsContent>
  );
}

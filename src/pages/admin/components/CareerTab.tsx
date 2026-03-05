/**
 * Admin Career tab: settings, domains, form fields, applications, export, audit.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase,
  Plus,
  Edit,
  Trash2,
  FileText,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Settings,
  GripVertical,
  CalendarIcon,
  Copy,
  ExternalLink,
  Instagram,
  Linkedin,
  Facebook,
  Github,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  fetchCareerSettings,
  updateCareerSettings,
  fetchAdminCareerDomains,
  fetchAdminCareerDomain,
  createCareerDomain,
  updateCareerDomain,
  deleteCareerDomain,
  createCareerField,
  updateCareerField,
  deleteCareerField,
  createCareerFieldsBulk,
  reorderCareerFields,
  fetchCareerApplications,
  fetchCareerApplication,
  updateCareerApplicationStatus,
  fetchCareerApplicationLogs,
  getCareerApplicationsExportUrl,
  fetchCareerTemplates,
  saveCareerTemplateFromDomain,
  applyCareerTemplateToDomain,
  fetchAdminCareerCityOptions,
  updateCareerCityOptions,
  fetchCareerCityOptions,
  fetchAdminCareerGenderOptions,
  updateCareerGenderOptions,
  fetchCareerGenderOptions,
} from "@/lib/career/api";
import type {
  CareerDomain,
  CareerDomainWithCount,
  CareerApplicationField,
  CareerApplication,
  CareerApplicationLog,
  CareerSettings,
} from "@/lib/career/types";
import {
  CAREER_JOB_TYPES,
  CAREER_FIELD_TYPES,
  CAREER_PREDEFINED_FIELD_NAMES,
  CAREER_LINK_TYPES,
  CAREER_PREDEFINED_FIELD_CONFIG,
  type CareerFieldType,
} from "@/lib/career/types";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const ALL_DOMAINS_VALUE = "__all__";
const ALL_STATUS_VALUE = "__all__";
/** Default status when opening Applications tab: show all applications. */
const DEFAULT_APPLICATIONS_STATUS = ALL_STATUS_VALUE;

interface CareerTabProps {
  language: "en" | "fr";
}

export function CareerTab({ language }: CareerTabProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CareerSettings>({ enabled: true });
  const [domains, setDomains] = useState<CareerDomainWithCount[]>([]);
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [totalApps, setTotalApps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<string>(ALL_DOMAINS_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_APPLICATIONS_STATUS);
  const [applicationFiltersDomainFields, setApplicationFiltersDomainFields] = useState<CareerApplicationField[]>([]);
  const [genderFilter, setGenderFilter] = useState<string>("");
  const AGE_RANGE_MIN = 15;
  const AGE_RANGE_MAX = 60;
  const [ageMinFilter, setAgeMinFilter] = useState<number>(AGE_RANGE_MIN);
  const [ageMaxFilter, setAgeMaxFilter] = useState<number>(AGE_RANGE_MAX);
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [cityOptionsForFilter, setCityOptionsForFilter] = useState<string[]>([]);
  const [genderOptionsForFilter, setGenderOptionsForFilter] = useState<string[]>(["Male", "Female"]);
  const [nameFilter, setNameFilter] = useState<string>("");
  const [phoneFilter, setPhoneFilter] = useState<string>("");
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<CareerDomain | null>(null);
  const [deletingDomain, setDeletingDomain] = useState(false);
  const [editingDomain, setEditingDomain] = useState<CareerDomain | null>(null);
  const [domainForm, setDomainForm] = useState({
    name: "",
    description: "",
    benefits: "",
    job_type: "" as string,
    salary: "",
    job_details: "",
    applications_open: true,
    document_upload_enabled: false,
  });
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false);
  const [selectedDomainForFields, setSelectedDomainForFields] = useState<CareerDomain | null>(null);
  const [fields, setFields] = useState<CareerApplicationField[]>([]);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<CareerApplicationField | null>(null);
  const [fieldForm, setFieldForm] = useState({
    label: "",
    field_type: "text" as CareerFieldType,
    required: false,
    options: [] as string[],
    validation: {} as { min?: number; max?: number; linkType?: string; disabledOptions?: string[] },
  });
  const [customFieldName, setCustomFieldName] = useState("");
  const [fieldOptionInput, setFieldOptionInput] = useState("");
  const [bulkSelected, setBulkSelected] = useState<
    {
      label: string;
      field_type: CareerFieldType;
      required: boolean;
      options?: string[];
      validation?: { min?: number; max?: number; linkType?: string; disabledOptions?: string[] };
    }[]
  >([]);
  const [predefinedNames, setPredefinedNames] = useState<string[]>(() => [...CAREER_PREDEFINED_FIELD_NAMES]);
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string | null; fields_count?: number }[]>([]);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<CareerApplication | null>(null);
  const [detailData, setDetailData] = useState<{ application: CareerApplication; domain: CareerDomain; fields: CareerApplicationField[]; logs: CareerApplicationLog[] } | null>(null);
  const fieldsDialogContentRef = useRef<HTMLDivElement | null>(null);

  const t = language === "fr"
    ? { careers: "Carrières", enabled: "Candidatures ouvertes", domains: "Domaines", applications: "Candidatures", addDomain: "Ajouter un domaine", name: "Nom", slug: "Slug", description: "Description", open: "Ouvert", upload: "CV/Documents", save: "Enregistrer", cancel: "Annuler", fields: "Champs", addField: "Ajouter un champ", fieldKey: "Clé", fieldLabel: "Libellé", fieldType: "Type", required: "Requis", options: "Options (liste)", addOption: "Ajouter", status: "Statut", date: "Date", view: "Voir", approve: "Approuver", reject: "Rejeter", export: "Exporter", new: "Nouveau", approved: "Approuvé", rejected: "Refusé", audit: "Historique", noApps: "Aucune candidature.", typeOfWork: "Type de travail", gender: "Genre", age: "Âge", ageMin: "Âge min", ageMax: "Âge max", city: "Ville", dateFrom: "Du", dateTo: "Au", all: "Tous", allStatus: "Tous les statuts", allCity: "Toutes les villes", allGender: "Tous les genres" }
    : { careers: "Careers", enabled: "Applications open", domains: "Domains", applications: "Applications", addDomain: "Add domain", name: "Name", slug: "Slug", description: "Description", open: "Open", upload: "CV/Documents", save: "Save", cancel: "Cancel", fields: "Fields", addField: "Add field", fieldKey: "Key", fieldLabel: "Label", fieldType: "Type", required: "Required", options: "Options (list)", addOption: "Add", status: "Status", date: "Date", view: "View", approve: "Approve", reject: "Reject", export: "Export", new: "New", approved: "Approved", rejected: "Rejected", audit: "Audit log", noApps: "No applications.", typeOfWork: "Type of work", gender: "Gender", age: "Age", ageMin: "Age min", ageMax: "Age max", city: "City", dateFrom: "From", dateTo: "To", all: "All", allStatus: "All status", allCity: "All city", allGender: "All gender" };

  // Resolve filter field key from domain fields (only show filter if field exists in selected domain).
  const filterFieldKey = (kind: "gender" | "age" | "city" | "name" | "phone"): string | undefined => {
    const field = applicationFiltersDomainFields.find((f) => {
      const key = f.field_key?.toLowerCase();
      const label = f.label?.toLowerCase();
      if (kind === "gender") return key === "gender" || label === "gender" || label === "genre";
      if (kind === "age") return key === "age" || label === "age" || label === "âge";
      if (kind === "city") return key === "city" || label === "city" || label === "ville";
      if (kind === "name") return key === "full_name" || key === "name" || key === "fullname" || label?.includes("name") || label === "nom";
      if (kind === "phone") return key === "phone" || key === "phone_number" || key === "number" || label === "phone" || label === "tél" || label?.includes("phone");
      return false;
    });
    return field?.field_key;
  };
  const genderFieldKey = filterFieldKey("gender");
  const ageFieldKey = filterFieldKey("age");
  const cityFieldKey = filterFieldKey("city");
  const nameFieldKey = filterFieldKey("name");
  const phoneFieldKey = filterFieldKey("phone");
  const hasGenderFilter = !!genderFieldKey;
  const hasAgeFilter = !!ageFieldKey;
  const hasCityFilter = !!cityFieldKey;
  const hasNameFilter = !!nameFieldKey;
  const hasPhoneFilter = !!phoneFieldKey;
  // Age range filter: show when domain has age field, or always with common key "age" for "All domains"
  const effectiveAgeKey = ageFieldKey || "age";
  // City filter: use domain's city field key when available, else "city" for "All domains"
  const effectiveCityKey = cityFieldKey || "city";
  // Gender filter: use domain's gender field key when available, else "gender" for "All domains"
  const effectiveGenderKey = genderFieldKey || "gender";

  /** Get candidate display value from form_data using common key variants. */
  const getCandidateValue = (formData: Record<string, unknown>, keys: string[]): string => {
    if (!formData) return "—";
    for (const k of keys) {
      const v = formData[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "—";
  };

  /** Get email from form_data: try known keys then any value that looks like an email (handles custom field_key). */
  const getCandidateEmail = (formData: Record<string, unknown>): string => {
    if (!formData) return "—";
    const knownKeys = ["email", "email_address", "Email", "Email_Address", "e_mail", "mail"];
    for (const k of knownKeys) {
      const v = formData[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    for (const v of Object.values(formData)) {
      const s = v != null ? String(v).trim() : "";
      if (s && s.includes("@") && s.includes(".")) return s;
    }
    return "—";
  };

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([fetchCareerSettings(), fetchAdminCareerDomains()]);
      setSettings(s);
      setDomains(d);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadApplications = useCallback(async () => {
    try {
      const { applications: list, total } = await fetchCareerApplications({
        domainId: domainFilter && domainFilter !== ALL_DOMAINS_VALUE ? domainFilter : undefined,
        status: statusFilter && statusFilter !== ALL_STATUS_VALUE ? statusFilter : undefined,
        from: dateFromFilter || undefined,
        to: dateToFilter || undefined,
        genderKey: genderFilter ? effectiveGenderKey : undefined,
        gender: genderFilter || undefined,
        ageKey: effectiveAgeKey || undefined,
        ageMin: ageMinFilter,
        ageMax: ageMaxFilter,
        cityKey: cityFilter ? effectiveCityKey : undefined,
        city: cityFilter || undefined,
        nameKey: nameFieldKey || undefined,
        name: nameFilter || undefined,
        phoneKey: phoneFieldKey || undefined,
        phone: phoneFilter || undefined,
        limit: 100,
      });
      setApplications(list);
      setTotalApps(total ?? list.length);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }, [domainFilter, statusFilter, dateFromFilter, dateToFilter, genderFilter, effectiveGenderKey, ageMinFilter, ageMaxFilter, effectiveAgeKey, cityFilter, effectiveCityKey, nameFilter, nameFieldKey, phoneFilter, phoneFieldKey, toast]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  // Fallback polling so the applications list stays fresh even if Realtime is unavailable.
  useEffect(() => {
    const interval = setInterval(() => {
      loadApplications();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadApplications]);

  // Realtime: keep career applications in sync; on new application show browser notification and play sound
  useEffect(() => {
    const playNotificationSound = () => {
      if (typeof window === "undefined") return;
      try {
        const audio = new Audio("/sounds/notification.mp3");
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    };

    const showNewApplicationNotification = (lang: "en" | "fr") => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const title = lang === "fr" ? "Nouvelle candidature" : "New career application";
      const body = lang === "fr" ? "Une nouvelle candidature a été envoyée." : "A new application has been submitted.";
      try {
        if (Notification.permission === "granted") {
          new Notification(title, {
            body,
            icon: "/logo.svg",
          });
        } else if (Notification.permission === "default") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") {
              new Notification(title, { body, icon: "/logo.svg" });
            }
          });
        }
      } catch {
        // ignore
      }
    };

    const channel = supabase
      .channel("admin-career-applications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "career_applications",
        },
        (payload: { eventType?: string }) => {
          if (payload.eventType === "INSERT") {
            playNotificationSound();
            showNewApplicationNotification(language);
          }
          loadApplications();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadApplications, language]);

  // When a specific domain is selected, load its fields so we know which filters (gender, age, city) exist.
  useEffect(() => {
    if (!domainFilter || domainFilter === ALL_DOMAINS_VALUE) {
      setApplicationFiltersDomainFields([]);
      return;
    }
    let cancelled = false;
    fetchAdminCareerDomain(domainFilter)
      .then((data) => {
        if (!cancelled && data?.fields) setApplicationFiltersDomainFields(data.fields);
        else if (!cancelled) setApplicationFiltersDomainFields([]);
      })
      .catch(() => {
        if (!cancelled) setApplicationFiltersDomainFields([]);
      });
    return () => { cancelled = true; };
  }, [domainFilter]);

  // Load city and gender options for the applications filters: global list when "All domains", else from selected domain's fields.
  useEffect(() => {
    if (domainFilter && domainFilter !== ALL_DOMAINS_VALUE && applicationFiltersDomainFields.length > 0) {
      const cityField = applicationFiltersDomainFields.find(
        (f) => f.field_key?.toLowerCase() === "city" || f.label?.toLowerCase() === "city" || f.label?.toLowerCase() === "ville"
      );
      const genderField = applicationFiltersDomainFields.find(
        (f) => f.field_key?.toLowerCase() === "gender" || f.label?.toLowerCase() === "gender" || f.label?.toLowerCase() === "genre"
      );
      setCityOptionsForFilter(cityField?.options && Array.isArray(cityField.options) ? cityField.options : []);
      setGenderOptionsForFilter(genderField?.options && Array.isArray(genderField.options) ? genderField.options : ["Male", "Female"]);
    } else {
      let cancelled = false;
      Promise.all([fetchCareerCityOptions(), fetchCareerGenderOptions()])
        .then(([cityRes, genderRes]) => {
          if (!cancelled) {
            setCityOptionsForFilter(cityRes?.options ?? []);
            setGenderOptionsForFilter(genderRes?.options?.length ? genderRes.options : ["Male", "Female"]);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCityOptionsForFilter([]);
            setGenderOptionsForFilter(["Male", "Female"]);
          }
        });
      return () => { cancelled = true; };
    }
  }, [domainFilter, applicationFiltersDomainFields]);

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await updateCareerSettings(checked);
      setSettings((prev) => ({ ...prev, enabled: checked }));
      toast({ title: checked ? "Applications opened" : "Applications closed" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const openDomainDialog = (domain?: CareerDomain) => {
    if (domain) {
      setEditingDomain(domain);
      setDomainForm({
        name: domain.name,
        description: domain.description || "",
        benefits: (domain as { benefits?: string }).benefits || "",
        job_type: domain.job_type || "",
        salary: domain.salary || "",
        job_details: domain.job_details || "",
        applications_open: domain.applications_open,
        document_upload_enabled: domain.document_upload_enabled,
      });
    } else {
      setEditingDomain(null);
      setDomainForm({
        name: "",
        description: "",
        benefits: "",
        job_type: "",
        salary: "",
        job_details: "",
        applications_open: true,
        document_upload_enabled: false,
      });
    }
    setDomainDialogOpen(true);
  };

  const saveDomain = async () => {
    try {
      if (editingDomain) {
        await updateCareerDomain(editingDomain.id, domainForm);
        toast({ title: "Domain updated" });
      } else {
        await createCareerDomain(domainForm);
        toast({ title: "Domain created" });
      }
      setDomainDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const deleteDomain = async (id: string) => {
    setDeletingDomain(true);
    try {
      await deleteCareerDomain(id);
      toast({ title: language === "fr" ? "Domaine supprimé" : "Domain deleted" });
      setDomainToDelete(null);
      load();
    } catch (e) {
      toast({ title: language === "fr" ? "Erreur" : "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingDomain(false);
    }
  };

  const openDeleteDomainDialog = (domain: CareerDomain) => {
    setDomainToDelete(domain);
  };

  const openFieldsDialog = async (domain: CareerDomain) => {
    setSelectedDomainForFields(domain);
    setAddFieldOpen(false);
    setBulkAddOpen(false);
    setEditingField(null);
    setSelectedFieldIds([]);
    setSelectionMode(false);
    setDraggedFieldId(null);
    setFieldForm({ label: "", field_type: "text", required: false, options: [], validation: {} });
    setFieldOptionInput("");
    setBulkSelected([]);
    try {
      const [domainResult, tpl] = await Promise.all([
        fetchAdminCareerDomain(domain.id),
        templates.length === 0 ? fetchCareerTemplates() : Promise.resolve(null),
      ]);
      if (domainResult) setFields(domainResult.fields ?? []);
      if (tpl && Array.isArray(tpl)) setTemplates(tpl);
    } catch {
      setFields([]);
    }
    setFieldsDialogOpen(true);
  };

  const openAddField = () => {
    setEditingField(null);
    setBulkAddOpen(false);
    setFieldForm({ label: "", field_type: "text", required: false, options: [], validation: {} });
    setFieldOptionInput("");
    setCustomFieldName("");
    setAddFieldOpen(true);
    if (fieldsDialogContentRef.current) {
      fieldsDialogContentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const isCityFieldByLabelOrKey = (label: string, fieldKey?: string) => {
    const key = (fieldKey || fieldKeyFromLabel(label)).toLowerCase();
    const l = (label || "").toLowerCase();
    return key === "city" || key === "ville" || l === "city" || l === "ville";
  };

  const isGenderFieldByLabelOrKey = (label: string, fieldKey?: string) => {
    const key = (fieldKey || fieldKeyFromLabel(label)).toLowerCase();
    const l = (label || "").toLowerCase();
    return key === "gender" || key === "genre" || l === "gender" || l === "genre";
  };

  const openEditField = (f: CareerApplicationField) => {
    setEditingField(f);
    const v = (f.validation || {}) as { min?: number; max?: number; linkType?: string; disabledOptions?: string[] };
    const isCity = isCityFieldByLabelOrKey(f.label, f.field_key) && f.field_type === "select";
    const isGender = isGenderFieldByLabelOrKey(f.label, f.field_key) && f.field_type === "select";
    setFieldForm({
      label: f.label,
      field_type: f.field_type as CareerFieldType,
      required: f.required,
      options: Array.isArray(f.options) ? [...f.options] : [],
      validation: { min: v.min, max: v.max, linkType: v.linkType, disabledOptions: v.disabledOptions },
    });
    setFieldOptionInput("");
    setAddFieldOpen(true);
    if (fieldsDialogContentRef.current) {
      fieldsDialogContentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (isCity) {
      fetchAdminCareerCityOptions()
        .then((data) => {
          setFieldForm((prev) => ({
            ...prev,
            options: data.options,
            validation: { ...prev.validation, disabledOptions: data.disabledOptions },
          }));
        })
        .catch(() => {});
    }
    if (isGender) {
      fetchAdminCareerGenderOptions()
        .then((data) => {
          setFieldForm((prev) => ({
            ...prev,
            options: data.options,
            validation: { ...prev.validation, disabledOptions: data.disabledOptions },
          }));
        })
        .catch(() => {});
    }
  };

  const openBulkAdd = () => {
    setAddFieldOpen(false);
    setEditingField(null);
    setBulkSelected([]);
    setBulkAddOpen(true);
  };

  const closeFieldForm = () => {
    setAddFieldOpen(false);
    setBulkAddOpen(false);
    setEditingField(null);
    setFieldForm({ label: "", field_type: "text", required: false, options: [], validation: {} });
    setSelectedFieldIds([]);
  };

  const addToBulkSelection = (label: string) => {
    setBulkSelected((prev) => {
      const idx = prev.findIndex((b) => b.label === label);
      // If already selected, deselect (toggle off)
      if (idx !== -1) {
        return prev.filter((_, i) => i !== idx);
      }
      // If not selected, add with preset config and keep order of clicks
      const preset = CAREER_PREDEFINED_FIELD_CONFIG[label];
      return [
        ...prev,
        {
          label,
          field_type: preset?.field_type ?? "text",
          required: preset?.required ?? false,
          options: preset?.options,
          validation: preset?.validation as { min?: number; max?: number; linkType?: string; disabledOptions?: string[] } | undefined,
        },
      ];
    });
  };

  const setBulkItemType = (index: number, field_type: CareerFieldType, required: boolean) => {
    setBulkSelected((prev) => prev.map((item, i) => (i === index ? { ...item, field_type, required } : item)));
  };

  const removeFromBulkSelection = (index: number) => {
    setBulkSelected((prev) => prev.filter((_, i) => i !== index));
  };

  const saveBulkFields = async () => {
    if (!selectedDomainForFields || bulkSelected.length === 0) return;
    try {
      await createCareerFieldsBulk(
        selectedDomainForFields.id,
        bulkSelected.map((b) => {
          const preset = CAREER_PREDEFINED_FIELD_CONFIG[b.label];
          const baseValidation =
            (b.validation ||
              (preset?.validation as { min?: number; max?: number; linkType?: string; disabledOptions?: string[] } | undefined)) ?? {};
          const validation =
            b.field_type === "link"
              ? {
                  ...baseValidation,
                  linkType:
                    baseValidation.linkType ||
                    (preset?.validation as { linkType?: string } | undefined)?.linkType ||
                    undefined,
                }
              : baseValidation;
          return {
            label: b.label,
            field_type: b.field_type,
            required: b.required,
            options: b.options ?? preset?.options,
            validation,
          };
        })
      );
      toast({ title: language === "fr" ? "Champs ajoutés" : "Fields added" });
      closeFieldForm();
      const result = await fetchAdminCareerDomain(selectedDomainForFields.id);
      setFields(result?.fields ?? []);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const applyFieldOrder = async (newOrder: CareerApplicationField[]) => {
    if (!selectedDomainForFields) return;
    try {
      const order = newOrder.map((f, i) => ({ id: f.id, sort_order: i }));
      await reorderCareerFields(selectedDomainForFields.id, order);
      setFields(newOrder);
      toast({ title: language === "fr" ? "Ordre mis à jour" : "Order updated" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleFieldDrop = async (targetId: string) => {
    if (!draggedFieldId || draggedFieldId === targetId) return;
    const currentIndex = fields.findIndex((f) => f.id === draggedFieldId);
    const targetIndex = fields.findIndex((f) => f.id === targetId);
    if (currentIndex === -1 || targetIndex === -1) return;
    const newOrder = [...fields];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, moved);
    await applyFieldOrder(newOrder);
    setDraggedFieldId(null);
  };

  const isCityFieldForm = () =>
    fieldForm.field_type === "select" && isCityFieldByLabelOrKey(fieldForm.label);

  const isGenderFieldForm = () =>
    fieldForm.field_type === "select" && isGenderFieldByLabelOrKey(fieldForm.label);

  const addOptionToList = async () => {
    const v = fieldOptionInput.trim();
    if (!v) return;
    if (isCityFieldForm()) {
      try {
        const nextOptions = [...fieldForm.options, v];
        await updateCareerCityOptions({ options: nextOptions });
        setFieldForm((p) => ({ ...p, options: nextOptions }));
        setFieldOptionInput("");
      } catch {
        toast({ title: "Error", description: language === "fr" ? "Échec de l'ajout de la ville." : "Failed to add city.", variant: "destructive" });
      }
      return;
    }
    if (isGenderFieldForm()) {
      try {
        const nextOptions = [...fieldForm.options, v];
        await updateCareerGenderOptions({ options: nextOptions });
        setFieldForm((p) => ({ ...p, options: nextOptions }));
        setFieldOptionInput("");
      } catch {
        toast({ title: "Error", description: language === "fr" ? "Échec de l'ajout du genre." : "Failed to add gender.", variant: "destructive" });
      }
      return;
    }
    setFieldForm((p) => ({ ...p, options: [...p.options, v] }));
    setFieldOptionInput("");
  };

  const removeOptionFromList = async (index: number) => {
    if (isCityFieldForm()) {
      const nextOptions = fieldForm.options.filter((_, i) => i !== index);
      const removed = fieldForm.options[index];
      const nextDisabled = Array.isArray((fieldForm.validation as any)?.disabledOptions)
        ? (fieldForm.validation as any).disabledOptions.filter((val: string) => val !== removed)
        : [];
      try {
        await updateCareerCityOptions({ options: nextOptions, disabledOptions: nextDisabled });
        setFieldForm((p) => ({
          ...p,
          options: nextOptions,
          validation: { ...p.validation, disabledOptions: nextDisabled },
        }));
      } catch {
        toast({ title: "Error", description: language === "fr" ? "Échec de la suppression." : "Failed to remove.", variant: "destructive" });
      }
      return;
    }
    if (isGenderFieldForm()) {
      const nextOptions = fieldForm.options.filter((_, i) => i !== index);
      const removed = fieldForm.options[index];
      const nextDisabled = Array.isArray((fieldForm.validation as any)?.disabledOptions)
        ? (fieldForm.validation as any).disabledOptions.filter((val: string) => val !== removed)
        : [];
      try {
        await updateCareerGenderOptions({ options: nextOptions, disabledOptions: nextDisabled });
        setFieldForm((p) => ({
          ...p,
          options: nextOptions,
          validation: { ...p.validation, disabledOptions: nextDisabled },
        }));
      } catch {
        toast({ title: "Error", description: language === "fr" ? "Échec de la suppression." : "Failed to remove.", variant: "destructive" });
      }
      return;
    }
    setFieldForm((p) => {
      const removed = p.options[index];
      const nextOptions = p.options.filter((_, i) => i !== index);
      const currentDisabled =
        Array.isArray((p.validation as any).disabledOptions)
          ? ([...(p.validation as any).disabledOptions] as string[])
          : [];
      const nextDisabled = removed
        ? currentDisabled.filter((val) => val !== removed)
        : currentDisabled;
      return {
        ...p,
        options: nextOptions,
        validation: { ...p.validation, disabledOptions: nextDisabled },
      };
    });
  };

  const updateOptionInList = async (index: number, value: string) => {
    if (isCityFieldForm()) {
      const nextOptions = fieldForm.options.map((opt, i) => (i === index ? value : opt));
      const currentDisabled = Array.isArray((fieldForm.validation as any)?.disabledOptions) ? [...(fieldForm.validation as any).disabledOptions] as string[] : [];
      const prevValue = fieldForm.options[index];
      const disabledIndex = prevValue ? currentDisabled.indexOf(prevValue) : -1;
      const nextDisabled = [...currentDisabled];
      if (disabledIndex !== -1) nextDisabled[disabledIndex] = value;
      try {
        await updateCareerCityOptions({ options: nextOptions, disabledOptions: nextDisabled });
        setFieldForm((p) => ({
          ...p,
          options: nextOptions,
          validation: { ...p.validation, disabledOptions: nextDisabled },
        }));
      } catch {
        toast({ title: "Error", description: language === "fr" ? "Échec de la mise à jour." : "Failed to update.", variant: "destructive" });
      }
      return;
    }
    if (isGenderFieldForm()) {
      const nextOptions = fieldForm.options.map((opt, i) => (i === index ? value : opt));
      const currentDisabled = Array.isArray((fieldForm.validation as any)?.disabledOptions) ? [...(fieldForm.validation as any).disabledOptions] as string[] : [];
      const prevValue = fieldForm.options[index];
      const disabledIndex = prevValue ? currentDisabled.indexOf(prevValue) : -1;
      const nextDisabled = [...currentDisabled];
      if (disabledIndex !== -1) nextDisabled[disabledIndex] = value;
      try {
        await updateCareerGenderOptions({ options: nextOptions, disabledOptions: nextDisabled });
        setFieldForm((p) => ({
          ...p,
          options: nextOptions,
          validation: { ...p.validation, disabledOptions: nextDisabled },
        }));
      } catch {
        toast({ title: "Error", description: language === "fr" ? "Échec de la mise à jour." : "Failed to update.", variant: "destructive" });
      }
      return;
    }
    setFieldForm((p) => {
      const prevValue = p.options[index];
      const nextOptions = p.options.map((opt, i) => (i === index ? value : opt));
      const currentDisabled =
        Array.isArray((p.validation as any).disabledOptions)
          ? ([...(p.validation as any).disabledOptions] as string[])
          : [];
      const disabledIndex = prevValue ? currentDisabled.indexOf(prevValue) : -1;
      if (disabledIndex !== -1) currentDisabled[disabledIndex] = value;
      return {
        ...p,
        options: nextOptions,
        validation: { ...p.validation, disabledOptions: currentDisabled },
      };
    });
  };

  const setOptionDisabled = async (index: number, disabled: boolean) => {
    const value = fieldForm.options[index];
    if (!value) return;
    const currentDisabled =
      Array.isArray((fieldForm.validation as any)?.disabledOptions)
        ? ([...(fieldForm.validation as any).disabledOptions] as string[])
        : [];
    const existsIndex = currentDisabled.indexOf(value);
    let nextDisabled: string[];
    if (disabled) {
      nextDisabled = existsIndex === -1 ? [...currentDisabled, value] : currentDisabled;
    } else {
      nextDisabled = existsIndex === -1 ? currentDisabled : currentDisabled.filter((val) => val !== value);
    }
    if (isCityFieldForm()) {
      try {
        await updateCareerCityOptions({ disabledOptions: nextDisabled });
        setFieldForm((p) => ({ ...p, validation: { ...p.validation, disabledOptions: nextDisabled } }));
      } catch {
        toast({ title: "Error", description: language === "fr" ? "Échec de la mise à jour." : "Failed to update.", variant: "destructive" });
      }
      return;
    }
    if (isGenderFieldForm()) {
      try {
        await updateCareerGenderOptions({ disabledOptions: nextDisabled });
        setFieldForm((p) => ({ ...p, validation: { ...p.validation, disabledOptions: nextDisabled } }));
      } catch {
        toast({ title: "Error", description: language === "fr" ? "Échec de la mise à jour." : "Failed to update.", variant: "destructive" });
      }
      return;
    }
    setFieldForm((p) => ({ ...p, validation: { ...p.validation, disabledOptions: nextDisabled } }));
  };

  const fieldKeyFromLabel = (label: string) =>
    String(label || "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "field";

  const saveField = async () => {
    if (!selectedDomainForFields) return;
    const label = (fieldForm.label || customFieldName || "").trim();
    const key = fieldKeyFromLabel(label);
    if (!label) {
      toast({ title: "Error", description: language === "fr" ? "Nom du champ requis." : "Field name required.", variant: "destructive" });
      return;
    }
    const validation: Record<string, unknown> = {};
    if (fieldForm.field_type === "age") {
      if (fieldForm.validation?.min != null) validation.min = fieldForm.validation.min;
      if (fieldForm.validation?.max != null) validation.max = fieldForm.validation.max;
    }
    if (fieldForm.field_type === "link" && fieldForm.validation?.linkType) {
      validation.linkType = fieldForm.validation.linkType;
    }
    if (fieldForm.field_type === "select" && Array.isArray(fieldForm.validation?.disabledOptions) && fieldForm.validation.disabledOptions.length) {
      validation.disabledOptions = fieldForm.validation.disabledOptions;
    }
    const isCity = fieldForm.field_type === "select" && isCityFieldByLabelOrKey(label);
    const isGender = fieldForm.field_type === "select" && isGenderFieldByLabelOrKey(label);
    const optionsToSave = (isCity || isGender) ? [] : (fieldForm.field_type === "select" ? fieldForm.options : []);
    try {
      if (editingField) {
        await updateCareerField(selectedDomainForFields.id, editingField.id, {
          label,
          field_type: fieldForm.field_type,
          required: fieldForm.required,
          options: fieldForm.field_type === "select" ? optionsToSave : undefined,
          validation: Object.keys(validation).length ? validation : undefined,
        });
        toast({ title: language === "fr" ? "Champ mis à jour" : "Field updated" });
      } else {
        await createCareerField(selectedDomainForFields.id, {
          field_key: key,
          label,
          field_type: fieldForm.field_type,
          required: fieldForm.required,
          options: fieldForm.field_type === "select" ? optionsToSave : [],
          validation,
        });
        if (label && !predefinedNames.includes(label)) setPredefinedNames((p) => [...p, label]);
        toast({ title: language === "fr" ? "Champ ajouté" : "Field added" });
      }
      closeFieldForm();
      const result = await fetchAdminCareerDomain(selectedDomainForFields.id);
      setFields(result?.fields ?? []);
      setSelectedFieldIds([]);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const removeField = async (f: CareerApplicationField) => {
    if (!selectedDomainForFields) return;
    if (!confirm(language === "fr" ? "Supprimer ce champ ?" : "Remove this field?")) return;
    try {
      await deleteCareerField(selectedDomainForFields.id, f.id);
      toast({ title: language === "fr" ? "Champ supprimé" : "Field removed" });
      const result = await fetchAdminCareerDomain(selectedDomainForFields.id);
      setFields(result?.fields ?? []);
      setSelectedFieldIds((prev) => prev.filter((id) => id !== f.id));
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const openDetail = async (app: CareerApplication) => {
    setSelectedApplication(app);
    try {
      const data = await fetchCareerApplication(app.id);
      const logs = await fetchCareerApplicationLogs(app.id);
      if (data) setDetailData({ ...data, logs });
      else setDetailData(null);
    } catch {
      setDetailData(null);
    }
    setDetailOpen(true);
  };

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      await updateCareerApplicationStatus(id, status);
      toast({ title: status === "approved" ? "Application approved" : "Application rejected" });
      loadApplications();
      if (selectedApplication?.id === id) {
        const data = await fetchCareerApplication(id);
        const logs = await fetchCareerApplicationLogs(id);
        if (data) setDetailData((prev) => (prev ? { ...data, logs } : null));
      }
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      new: { label: t.new, variant: "outline", className: "border-blue-500 bg-blue-500/15 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300" },
      reviewed: { label: language === "fr" ? "Vu" : "Viewed", variant: "outline", className: "text-muted-foreground" },
      approved: { label: t.approved, variant: "outline", className: "border-green-600 bg-green-600 text-white dark:bg-green-600 dark:text-white hover:bg-green-600" },
      rejected: { label: t.rejected, variant: "destructive" },
    };
    const c = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t.careers}</h2>
      </div>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">
            {t.applications}
          </TabsTrigger>
          <TabsTrigger value="domains">
            {t.domains}
          </TabsTrigger>
          <TabsTrigger value="settings">
            {t.enabled}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t.applications}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={domainFilter} onValueChange={setDomainFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All domains" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DOMAINS_VALUE}>All domains</SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STATUS_VALUE}>{t.allStatus}</SelectItem>
                    <SelectItem value="new">{t.new}</SelectItem>
                    <SelectItem value="approved">{t.approved}</SelectItem>
                    <SelectItem value="rejected">{t.rejected}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={cityFilter || "__all__"} onValueChange={(v) => setCityFilter(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder={t.city} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t.allCity}</SelectItem>
                    {cityOptionsForFilter.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={genderFilter || "__all__"} onValueChange={(v) => setGenderFilter(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t.gender} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t.allGender}</SelectItem>
                    {genderOptionsForFilter.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Age range filter: dual-handle slider, min 15 max 60 */}
                <div className="flex flex-col gap-1 min-w-[180px] max-w-[220px]">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium shrink-0">{t.age}</Label>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ({language === "fr" ? "entre" : "between"} {ageMinFilter} {language === "fr" ? "et" : "and"} {ageMaxFilter})
                    </span>
                  </div>
                  <Slider
                    min={AGE_RANGE_MIN}
                    max={AGE_RANGE_MAX}
                    step={1}
                    value={[ageMinFilter, ageMaxFilter]}
                    onValueChange={([min, max]) => {
                      setAgeMinFilter(min);
                      setAgeMaxFilter(max);
                    }}
                    className="w-full"
                  />
                </div>
                {/* Date range: From and To on the same line */}
                <div className="flex items-center gap-2 shrink-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start text-left font-normal shrink-0">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFromFilter ? format(new Date(dateFromFilter + "T00:00:00"), "MMM d, yyyy") : t.dateFrom}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card shadow-xl border-border" align="start">
                      <div className="p-2 border-b bg-muted/30 rounded-t-lg">
                        <p className="text-xs font-medium text-muted-foreground">{language === "fr" ? "Date de début" : "Start date"}</p>
                      </div>
                      <Calendar
                        mode="single"
                        selected={dateFromFilter ? new Date(dateFromFilter + "T00:00:00") : undefined}
                        onSelect={(d) => setDateFromFilter(d ? format(d, "yyyy-MM-dd") : "")}
                        initialFocus
                        className="rounded-md border-0"
                      />
                      <div className="flex items-center justify-between border-t p-2 bg-muted/20 rounded-b-lg">
                        <Button variant="ghost" size="sm" className="text-primary h-8 text-xs" onClick={() => setDateFromFilter("")}>
                          {language === "fr" ? "Effacer" : "Clear"}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-primary h-8 text-xs" onClick={() => setDateFromFilter(format(new Date(), "yyyy-MM-dd"))}>
                          {language === "fr" ? "Aujourd'hui" : "Today"}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start text-left font-normal shrink-0">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateToFilter ? format(new Date(dateToFilter + "T00:00:00"), "MMM d, yyyy") : t.dateTo}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card shadow-xl border-border" align="start">
                      <div className="p-2 border-b bg-muted/30 rounded-t-lg">
                        <p className="text-xs font-medium text-muted-foreground">{language === "fr" ? "Date de fin" : "End date"}</p>
                      </div>
                      <Calendar
                        mode="single"
                        selected={dateToFilter ? new Date(dateToFilter + "T00:00:00") : undefined}
                        onSelect={(d) => setDateToFilter(d ? format(d, "yyyy-MM-dd") : "")}
                        initialFocus
                        className="rounded-md border-0"
                      />
                      <div className="flex items-center justify-between border-t p-2 bg-muted/20 rounded-b-lg">
                        <Button variant="ghost" size="sm" className="text-primary h-8 text-xs" onClick={() => setDateToFilter("")}>
                          {language === "fr" ? "Effacer" : "Clear"}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-primary h-8 text-xs" onClick={() => setDateToFilter(format(new Date(), "yyyy-MM-dd"))}>
                          {language === "fr" ? "Aujourd'hui" : "Today"}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {hasNameFilter && (
                  <Input
                    type="text"
                    placeholder={t.name}
                    className="w-[140px]"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                )}
                {hasPhoneFilter && (
                  <Input
                    type="text"
                    placeholder={language === "fr" ? "Tél" : "Phone"}
                    className="w-[120px]"
                    value={phoneFilter}
                    onChange={(e) => setPhoneFilter(e.target.value)}
                  />
                )}
                <Button variant="outline" asChild>
                  <a
                    href={getCareerApplicationsExportUrl({
                      domainId: domainFilter !== ALL_DOMAINS_VALUE ? domainFilter : undefined,
                      status: statusFilter !== ALL_STATUS_VALUE ? statusFilter : undefined,
                      from: dateFromFilter || undefined,
                      to: dateToFilter || undefined,
                      genderKey: genderFilter ? effectiveGenderKey : undefined,
                      gender: genderFilter || undefined,
                      ageKey: effectiveAgeKey || undefined,
                      ageMin: ageMinFilter || undefined,
                      ageMax: ageMaxFilter || undefined,
                      cityKey: cityFilter ? effectiveCityKey : undefined,
                      city: cityFilter || undefined,
                      nameKey: nameFieldKey || undefined,
                      name: nameFilter || undefined,
                      phoneKey: phoneFieldKey || undefined,
                      phone: phoneFilter || undefined,
                      format: "xlsx",
                    })}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t.export} Excel
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>{t.name}</TableHead>
                    <TableHead>{t.age}</TableHead>
                    <TableHead>{language === "fr" ? "Tél" : "Phone"}</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.date}</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">{t.noApps}</TableCell>
                    </TableRow>
                  ) : (
                    applications.map((app) => {
                      const fd = (app.form_data || {}) as Record<string, unknown>;
                      return (
                        <TableRow key={app.id}>
                          <TableCell>{app.career_domain_id ? (domains.find((d) => d.id === app.career_domain_id)?.name ?? app.career_domain_id) : (language === "fr" ? "(Domaine supprimé)" : "(Deleted domain)")}</TableCell>
                          <TableCell>{getCandidateValue(fd, ["full_name", "name", "fullName"])}</TableCell>
                          <TableCell>{getCandidateValue(fd, ["age"])}</TableCell>
                          <TableCell>{getCandidateValue(fd, ["phone", "phone_number", "number"])}</TableCell>
                          <TableCell>{getCandidateEmail(fd)}</TableCell>
                          <TableCell>{getStatusBadge(app.status)}</TableCell>
                          <TableCell>{format(new Date(app.created_at), "PPp")}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => openDetail(app)} title={t.view}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                {t.domains}
              </CardTitle>
              <Button onClick={() => openDomainDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t.addDomain}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.name}</TableHead>
                    <TableHead>{t.slug}</TableHead>
                    <TableHead>{t.open}</TableHead>
                    <TableHead>Apps</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.name}</TableCell>
                      <TableCell className="text-muted-foreground">{d.slug}</TableCell>
                      <TableCell>{d.applications_open ? "Yes" : "No"}</TableCell>
                      <TableCell>{d.applications_count ?? 0}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openFieldsDialog(d)} title={t.fields}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDomainDialog(d)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteDomainDialog(d)} title={language === "fr" ? "Supprimer" : "Delete"}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Settings
              </CardTitle>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <Switch id="career-enabled" checked={settings.enabled} onCheckedChange={handleToggleEnabled} />
                  <Label htmlFor="career-enabled">{t.enabled}</Label>
                </div>
              </CardContent>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Domain dialog: slug is auto from name (read-only when editing) */}
      <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-hidden">
          <DialogHeader>
            <DialogTitle>{editingDomain ? "Edit domain" : t.addDomain}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t.name} {language === "fr" ? "(Titre du poste)" : "(Job title)"}</Label>
              <Input
                value={domainForm.name}
                onChange={(e) => setDomainForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Marketing"
              />
            </div>
            {editingDomain && (
              <div>
                <Label className="text-muted-foreground">{t.slug} (auto)</Label>
                <Input value={editingDomain.slug} readOnly className="bg-muted" />
              </div>
            )}
            <div>
              <Label>{t.description}</Label>
              <Input
                value={domainForm.description}
                onChange={(e) => setDomainForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>{language === "fr" ? "Type de poste" : "Job type"}</Label>
              <Select
                value={domainForm.job_type || "none"}
                onValueChange={(v) => setDomainForm((p) => ({ ...p, job_type: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "fr" ? "Aucun" : "None"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{language === "fr" ? "Aucun" : "None"}</SelectItem>
                  {CAREER_JOB_TYPES.map((jt) => (
                    <SelectItem key={jt} value={jt}>{jt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === "fr" ? "Salaire" : "Salary"}</Label>
              <Input
                value={domainForm.salary}
                onChange={(e) => setDomainForm((p) => ({ ...p, salary: e.target.value }))}
                placeholder={language === "fr" ? "Optionnel (ex: 50k-70k, Compétitif)" : "Optional (e.g. 50k-70k, Competitive)"}
              />
            </div>
            <div>
              <Label>{language === "fr" ? "Détails du poste" : "Job details"}</Label>
              <Textarea
                value={domainForm.job_details}
                onChange={(e) => setDomainForm((p) => ({ ...p, job_details: e.target.value }))}
                placeholder={language === "fr" ? "Optionnel – détails complets affichés sur la page de l’offre" : "Optional – full details shown on the job page"}
                rows={12}
                className="resize-y overflow-y-auto scrollbar-hidden min-h-[200px] max-h-[480px] w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {language === "fr" ? "Faites défiler pour voir tout le contenu." : "Scroll to see all content."}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {language === "fr"
                ? "Les champs de formulaire (Type de travail, Salaire attendu, etc.) se gèrent dans le panneau Champs de ce domaine."
                : "Form fields (Type of work, Expected salary, etc.) are managed in the Fields panel for this domain."}
            </p>
            <div className="flex items-center space-x-2">
              <Switch
                checked={domainForm.applications_open}
                onCheckedChange={(c) => setDomainForm((p) => ({ ...p, applications_open: c }))}
              />
              <Label>{t.open}</Label>
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-4 mt-2">
            <Button variant="outline" onClick={() => setDomainDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={saveDomain}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete domain confirmation */}
      <AlertDialog open={!!domainToDelete} onOpenChange={(open) => { if (!open) setDomainToDelete(null); }}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5 shrink-0" />
              {language === "fr" ? "Supprimer ce domaine ?" : "Delete this domain?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {domainToDelete && (
                <>
                  {language === "fr"
                    ? `« ${domainToDelete.name} » sera supprimé. Les candidatures existantes seront conservées (domaine affiché comme « Domaine supprimé »). Cette action est irréversible.`
                    : `"${domainToDelete.name}" will be deleted. Existing applications will be kept (shown as "Deleted domain"). This action cannot be undone.`}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deletingDomain}>
              {language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (domainToDelete) deleteDomain(domainToDelete.id);
              }}
              disabled={deletingDomain}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDomain ? (language === "fr" ? "Suppression…" : "Deleting…") : (language === "fr" ? "Supprimer" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fields dialog: list + Add field form + options for select type */}
      <Dialog open={fieldsDialogOpen} onOpenChange={(open) => { setFieldsDialogOpen(open); if (!open) closeFieldForm(); }}>
        <DialogContent
          ref={fieldsDialogContentRef}
          className="max-w-5xl w-[min(1120px,100vw-3rem)] max-h-[90vh] overflow-y-auto scrollbar-hidden"
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <DialogTitle>{selectedDomainForFields?.name} – {t.fields}</DialogTitle>
            {selectedDomainForFields && !addFieldOpen && !bulkAddOpen && (
              <div className="flex flex-wrap justify-end gap-2 md:gap-4 mt-2 md:mt-0 pr-8">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!fields.length}
                  onClick={() => {
                    const baseName = selectedDomainForFields ? `${selectedDomainForFields.name} form` : "Career form";
                    setTemplateName(baseName);
                    setTemplateDescription("");
                    setSaveTemplateOpen(true);
                  }}
                >
                  {language === "fr" ? "Enregistrer comme modèle" : "Save template"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!templates.length) {
                      fetchCareerTemplates()
                        .then((tpl) => setTemplates(tpl))
                        .catch((e) =>
                          toast({ title: "Error", description: (e as Error).message, variant: "destructive" })
                        );
                    }
                    setApplyTemplateOpen(true);
                  }}
                >
                  {language === "fr" ? "Appliquer un modèle" : "Apply template"}
                </Button>
                <Button size="sm" variant="outline" onClick={openBulkAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  {language === "fr" ? "Ajout en masse" : "Bulk add"}
                </Button>
                <Button
                  size="sm"
                  variant={selectionMode ? "secondary" : "outline"}
                  disabled={!fields.length}
                  onClick={() => {
                    setSelectionMode((prev) => !prev);
                    setSelectedFieldIds([]);
                  }}
                >
                  {selectionMode
                    ? language === "fr"
                      ? "Terminer la sélection"
                      : "Done selecting"
                    : language === "fr"
                      ? "Sélectionner"
                      : "Select"}
                </Button>
                <Button size="sm" onClick={openAddField}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t.addField}
                </Button>
              </div>
            )}
          </DialogHeader>

          {bulkAddOpen && selectedDomainForFields && (
            <Card className="mb-6">
              <CardHeader className="py-4">
                <CardTitle className="text-base">{language === "fr" ? "Ajouter plusieurs champs" : "Bulk add fields"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">{language === "fr" ? "Choisir des champs à ajouter" : "Select fields to add"}</Label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {predefinedNames.map((name) => (
                      <Button
                        key={name}
                        type="button"
                        variant={bulkSelected.some((b) => b.label === name) ? "default" : "outline"}
                        size="sm"
                        onClick={() => addToBulkSelection(name)}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                </div>
                {bulkSelected.length > 0 && (
                  <>
                    <Label className="mb-2 block">{language === "fr" ? "Type et requis pour chaque champ" : "Type & required for each"}</Label>
                    <ul className="space-y-2">
                      {bulkSelected.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium min-w-[140px]">{item.label}</span>
                          {CAREER_PREDEFINED_FIELD_CONFIG[item.label] ? (
                            <Badge variant="outline" className="px-2 py-1 text-xs capitalize">
                              {item.field_type}
                            </Badge>
                          ) : (
                            <Select value={item.field_type} onValueChange={(v) => setBulkItemType(i, v as CareerFieldType, item.required)}>
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CAREER_FIELD_TYPES.map((ft) => (
                                  <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <div className="flex items-center gap-2">
                            <Switch checked={item.required} onCheckedChange={(c) => setBulkItemType(i, item.field_type, c)} />
                            <Label className="text-sm">{t.required}</Label>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeFromBulkSelection(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <DialogFooter className="pt-4">
                      <Button variant="outline" onClick={closeFieldForm}>{t.cancel}</Button>
                      <Button onClick={saveBulkFields}>{t.save}</Button>
                    </DialogFooter>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {addFieldOpen && selectedDomainForFields && (
            <Card className="mb-6">
              <CardHeader className="py-4">
                <CardTitle className="text-base">{editingField ? (language === "fr" ? "Modifier le champ" : "Edit field") : t.addField}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t.fieldLabel}</Label>
                  <Select
                    value={fieldForm.label && predefinedNames.includes(fieldForm.label) ? fieldForm.label : "__custom__"}
                    onValueChange={(v) => {
                      if (v === "__custom__") {
                        setFieldForm((p) => ({
                          ...p,
                          label: "",
                          field_type: "text",
                          required: false,
                          options: [],
                          validation: {},
                        }));
                        return;
                      }
                      const preset = CAREER_PREDEFINED_FIELD_CONFIG[v] || CAREER_PREDEFINED_FIELD_CONFIG[(v as string)] || null;
                      const isCity = (v === "City" || v === "Ville") && (preset?.field_type === "select");
                      setFieldForm((p) => ({
                        ...p,
                        label: v,
                        field_type: preset?.field_type ?? p.field_type,
                        required: preset?.required ?? p.required,
                        options: preset?.options ? [...preset.options] : p.options,
                        validation: preset?.validation ? { ...preset.validation } : p.validation,
                      }));
                      if (isCity) {
                        fetchAdminCareerCityOptions()
                          .then((data) => setFieldForm((prev) => ({
                            ...prev,
                            options: data.options,
                            validation: { ...prev.validation, disabledOptions: data.disabledOptions },
                          })))
                          .catch(() => {});
                      }
                      if (isGenderFieldByLabelOrKey(v, undefined)) {
                        fetchAdminCareerGenderOptions()
                          .then((data) => setFieldForm((prev) => ({
                            ...prev,
                            options: data.options,
                            validation: { ...prev.validation, disabledOptions: data.disabledOptions },
                          })))
                          .catch(() => {});
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "fr" ? "Choisir ou ajouter..." : "Select or add new..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {predefinedNames.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">{language === "fr" ? "+ Nouveau libellé" : "+ Add new name"}</SelectItem>
                    </SelectContent>
                  </Select>
                  {(fieldForm.label === "" || !predefinedNames.includes(fieldForm.label)) && (
                    <Input
                      className="mt-2"
                      value={editingField ? fieldForm.label : (fieldForm.label || customFieldName)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!editingField) setCustomFieldName(val);
                        setFieldForm((p) => ({ ...p, label: val }));
                      }}
                      placeholder={language === "fr" ? "Nom du champ" : "Field name"}
                    />
                  )}
                  {fieldForm.label && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.fieldKey}: <code>{editingField ? editingField.field_key : fieldKeyFromLabel(fieldForm.label)}</code>
                    </p>
                  )}
                </div>
                <div>
                  <Label>{t.fieldType}</Label>
                  <Select
                    value={fieldForm.field_type}
                    disabled={!!fieldForm.label && !!CAREER_PREDEFINED_FIELD_CONFIG[fieldForm.label]}
                    onValueChange={(v) => setFieldForm((p) => ({ ...p, field_type: v as CareerFieldType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAREER_FIELD_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={fieldForm.required}
                    onCheckedChange={(c) => setFieldForm((p) => ({ ...p, required: c }))}
                  />
                  <Label>{t.required}</Label>
                </div>
                {fieldForm.field_type === "age" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{language === "fr" ? "Âge min" : "Min age"}</Label>
                      <Input
                        type="number"
                        value={fieldForm.validation?.min ?? ""}
                        onChange={(e) => setFieldForm((p) => ({
                          ...p,
                          validation: { ...p.validation, min: e.target.value === "" ? undefined : Number(e.target.value) },
                        }))}
                        placeholder="18"
                      />
                    </div>
                    <div>
                      <Label>{language === "fr" ? "Âge max" : "Max age"}</Label>
                      <Input
                        type="number"
                        value={fieldForm.validation?.max ?? ""}
                        onChange={(e) => setFieldForm((p) => ({
                          ...p,
                          validation: { ...p.validation, max: e.target.value === "" ? undefined : Number(e.target.value) },
                        }))}
                        placeholder="99"
                      />
                    </div>
                  </div>
                )}
                {fieldForm.field_type === "link" && (
                  <div>
                    <Label>{language === "fr" ? "Type de lien" : "Link type"}</Label>
                    <Select
                      value={fieldForm.validation?.linkType ?? "website"}
                      onValueChange={(v) => setFieldForm((p) => ({ ...p, validation: { ...p.validation, linkType: v } }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CAREER_LINK_TYPES.map((lt) => (
                          <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {fieldForm.field_type === "select" && (
                  <div>
                    <Label className="mb-2 block">
                      {isCityFieldForm()
                        ? (language === "fr" ? "Villes (partagées entre tous les postes)" : "Cities (shared across all jobs)")
                        : isGenderFieldForm()
                          ? (language === "fr" ? "Genres (partagés entre tous les postes)" : "Genders (shared across all jobs)")
                          : `${t.options} (e.g. Part time, Full time, Internship)`}
                    </Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={fieldOptionInput}
                        onChange={(e) => setFieldOptionInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOptionToList())}
                        placeholder={language === "fr" ? "Nouvelle option" : "New option"}
                      />
                      <Button type="button" variant="secondary" size="sm" onClick={addOptionToList}>
                        {t.addOption}
                      </Button>
                    </div>
                    <ul className="space-y-2">
                      {fieldForm.options.map((opt, i) => {
                        const disabledOptions = Array.isArray((fieldForm.validation as any).disabledOptions)
                          ? ((fieldForm.validation as any).disabledOptions as string[])
                          : [];
                        const isDisabled = disabledOptions.includes(opt);
                        return (
                          <li key={i} className="flex items-center gap-3">
                            <Input
                              value={opt}
                              onChange={(e) => updateOptionInList(i, e.target.value)}
                              className={`flex-1 ${isDisabled ? "opacity-60 line-through" : ""}`}
                            />
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={!isDisabled}
                                onCheckedChange={(checked) => setOptionDisabled(i, !checked)}
                              />
                              <span className="text-xs text-muted-foreground">
                                {isDisabled ? (language === "fr" ? "Désactivée" : "Disabled") : (language === "fr" ? "Active" : "Active")}
                              </span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeOptionFromList(i)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={closeFieldForm}>{t.cancel}</Button>
                  <Button onClick={saveField}>{t.save}</Button>
                </DialogFooter>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {selectionMode && selectedFieldIds.length > 0 && (
              <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs md:text-sm text-destructive">
                <span>
                  {language === "fr"
                    ? `${selectedFieldIds.length} champ(s) sélectionné(s) pour suppression.`
                    : `${selectedFieldIds.length} field(s) selected for deletion.`}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  {language === "fr" ? "Supprimer la sélection" : "Delete selected"}
                </Button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t.fieldKey}</TableHead>
                  <TableHead>{t.fieldLabel}</TableHead>
                  <TableHead>{t.fieldType}</TableHead>
                  <TableHead>{t.required}</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length === 0 && !addFieldOpen && !bulkAddOpen ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {language === "fr"
                        ? "Aucun champ. Cliquez sur « Ajouter un champ » ou « Ajout en masse »."
                        : "No fields. Click « Add field » or « Bulk add »."}
                    </TableCell>
                  </TableRow>
                ) : (
                  fields.map((f, index) => {
                    const checked = selectedFieldIds.includes(f.id);
                    return (
                      <TableRow
                        key={f.id}
                        className={`${checked ? "bg-destructive/5" : ""} ${
                          draggedFieldId === f.id ? "opacity-60" : ""
                        }`}
                        draggable
                        onDragStart={() => setDraggedFieldId(f.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleFieldDrop(f.id)}
                        onDragEnd={() => setDraggedFieldId(null)}
                      >
                        <TableCell className="p-1 align-middle">
                          <button
                            type="button"
                            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-move"
                            aria-label={language === "fr" ? "Réorganiser le champ" : "Reorder field"}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                        </TableCell>
                        <TableCell className="align-middle">
                          {selectionMode ? (
                            <button
                              type="button"
                              className={`h-4 w-4 rounded-full border transition-colors ${
                                checked
                                  ? "border-destructive bg-destructive"
                                  : "border-destructive/70 bg-transparent"
                              }`}
                              onClick={() =>
                                setSelectedFieldIds((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== f.id)
                                    : [...prev, f.id]
                                )
                              }
                              aria-pressed={checked}
                              aria-label={
                                checked
                                  ? language === "fr"
                                    ? "Désélectionner le champ"
                                    : "Unselect field"
                                  : language === "fr"
                                    ? "Sélectionner le champ"
                                    : "Select field"
                              }
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs align-middle">
                          {f.field_key}
                        </TableCell>
                        <TableCell className="align-middle">{f.label}</TableCell>
                        <TableCell className="align-middle">
                          {f.field_type}
                          {f.field_type === "select" &&
                          Array.isArray(f.options) &&
                          f.options.length
                            ? ` (${f.options.length})`
                            : ""}
                          {f.field_type === "age" &&
                          (f.validation as { min?: number; max?: number })?.min !=
                            null
                            ? ` [${(f.validation as any).min}-${
                                (f.validation as any).max ?? "?"
                              }]`
                            : ""}
                          {f.field_type === "link" &&
                          (f.validation as { linkType?: string })?.linkType
                            ? ` (${(f.validation as any).linkType})`
                            : ""}
                        </TableCell>
                        <TableCell className="align-middle">
                          {f.required ? "Yes" : "No"}
                        </TableCell>
                        <TableCell className="align-middle">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditField(f)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!selectionMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeField(f)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation for fields */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-left text-destructive">
              {language === "fr" ? "Supprimer les champs sélectionnés" : "Delete selected fields"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground">
              {language === "fr"
                ? `Vous êtes sur le point de supprimer définitivement ${selectedFieldIds.length} champ(s) du formulaire « ${selectedDomainForFields?.name ?? ""} ».`
                : `You are about to permanently delete ${selectedFieldIds.length} field(s) from the “${selectedDomainForFields?.name ?? ""}” form.`}
            </p>
            <p className="text-xs text-destructive/80">
              {language === "fr"
                ? "Cette action est irréversible. Les données déjà envoyées ne seront pas supprimées, mais ces champs disparaîtront pour les prochaines candidatures."
                : "This action cannot be undone. Existing applications will keep their data, but these fields will disappear from future submissions."}
            </p>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!selectedDomainForFields || !selectedFieldIds.length) {
                  setBulkDeleteOpen(false);
                  return;
                }
                try {
                  await Promise.all(
                    selectedFieldIds.map((id) =>
                      deleteCareerField(selectedDomainForFields.id, id)
                    )
                  );
                  const result = await fetchAdminCareerDomain(
                    selectedDomainForFields.id
                  );
                  setFields(result?.fields ?? []);
                  setSelectedFieldIds([]);
                  setBulkDeleteOpen(false);
                  toast({
                    title:
                      language === "fr"
                        ? "Champs supprimés"
                        : "Fields deleted",
                  });
                } catch (e) {
                  toast({
                    title: "Error",
                    description: (e as Error).message,
                    variant: "destructive",
                  });
                }
              }}
            >
              {language === "fr" ? "Supprimer définitivement" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save template dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Enregistrer comme modèle" : "Save as template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{language === "fr" ? "Nom du modèle" : "Template name"}</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={language === "fr" ? "Formulaire standard" : "Standard form"}
              />
            </div>
            <div>
              <Label>{language === "fr" ? "Description (optionnelle)" : "Description (optional)"}</Label>
              <Input
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder={language === "fr" ? "Pour quels postes ?" : "For which roles?"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveTemplateOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={async () => {
                if (!selectedDomainForFields || !templateName.trim()) {
                  toast({
                    title: "Error",
                    description:
                      language === "fr"
                        ? "Nom du modèle requis."
                        : "Template name is required.",
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  const tpl = await saveCareerTemplateFromDomain(selectedDomainForFields.id, {
                    name: templateName.trim(),
                    description: templateDescription.trim() || undefined,
                  });
                  setTemplates((prev) => [...prev, tpl]);
                  setSaveTemplateOpen(false);
                  toast({
                    title:
                      language === "fr"
                        ? "Modèle enregistré"
                        : "Template saved",
                  });
                } catch (e) {
                  toast({
                    title: "Error",
                    description: (e as Error).message,
                    variant: "destructive",
                  });
                }
              }}
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply template dialog */}
      <Dialog open={applyTemplateOpen} onOpenChange={setApplyTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Appliquer un modèle" : "Apply template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{language === "fr" ? "Choisir un modèle" : "Choose a template"}</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      language === "fr"
                        ? "Sélectionner un modèle"
                        : "Select a template"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.fields_count != null ? ` (${tpl.fields_count})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {language === "fr"
                ? "Remplace tous les champs actuels de ce domaine par ceux du modèle sélectionné. Vous pourrez toujours modifier les champs ensuite."
                : "This will replace all current fields for this domain with the selected template's fields. You can still edit fields afterwards."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApplyTemplateOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button
              disabled={!selectedDomainForFields || !selectedTemplateId}
              onClick={async () => {
                if (!selectedDomainForFields || !selectedTemplateId) return;
                try {
                  const newFields = await applyCareerTemplateToDomain(
                    selectedDomainForFields.id,
                    selectedTemplateId
                  );
                  setFields(newFields);
                  setApplyTemplateOpen(false);
                  toast({
                    title:
                      language === "fr"
                        ? "Modèle appliqué"
                        : "Template applied",
                  });
                } catch (e) {
                  toast({
                    title: "Error",
                    description: (e as Error).message,
                    variant: "destructive",
                  });
                }
              }}
            >
              {language === "fr" ? "Appliquer" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Application detail
            </DialogTitle>
          </DialogHeader>
          {detailData && (() => {
            const linkTypeToIcon: Record<string, React.ComponentType<{ className?: string }>> = {
              instagram: Instagram,
              linkedin: Linkedin,
              facebook: Facebook,
              github: Github,
              twitter: ExternalLink,
              website: ExternalLink,
              portfolio: ExternalLink,
              other: ExternalLink,
            };
            return (
            <>
              <div className="space-y-3">
                {detailData.fields
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((f) => {
                    const value = (detailData.application.form_data as Record<string, unknown>)[f.field_key];
                    const isEmpty = value == null || String(value).trim() === "";
                    const isFile = f.field_type === "file";
                    const isUrl = isFile && typeof value === "string" && (value.startsWith("http") || value.startsWith("/"));
                    const stringValue = isEmpty ? "" : String(value);
                    const isPhone = f.field_type === "phone" && !isEmpty;
                    const isEmail = f.field_type === "email" && !isEmpty;
                    const isGenericLink =
                      (f.field_type === "link" || typeof value === "string") &&
                      !isEmpty &&
                      (stringValue.startsWith("http://") || stringValue.startsWith("https://"));

                    const href =
                      isEmail ? `mailto:${stringValue}` :
                      isPhone ? `tel:${stringValue}` :
                      isGenericLink ? stringValue :
                      undefined;

                    const linkType = (f.validation as { linkType?: string } | undefined)?.linkType ?? "other";
                    const LinkIcon = linkTypeToIcon[linkType] ?? ExternalLink;

                    const handleCopy = () => {
                      if (!stringValue) return;
                      navigator.clipboard
                        .writeText(stringValue)
                        .then(() => {
                          toast({ title: language === "fr" ? "Copié" : "Copied" });
                        })
                        .catch(() => {
                          toast({ title: language === "fr" ? "Erreur de copie" : "Copy failed", variant: "destructive" });
                        });
                    };

                    return (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/5 px-4 py-3"
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shrink-0">
                            {f.label}:
                          </span>
                          {isFile && isUrl ? (
                            <a
                              href={stringValue}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:text-destructive/90 break-words"
                            >
                              <Download className="h-4 w-4 shrink-0" />
                              {language === "fr" ? "Télécharger le document" : "Download document"}
                            </a>
                          ) : isEmpty ? (
                            <span className="text-sm font-medium text-muted-foreground">—</span>
                          ) : isGenericLink ? (
                            <a
                              href={stringValue}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-9 h-9 rounded-md text-foreground hover:bg-muted/60 transition"
                              title={stringValue}
                              aria-label={f.label}
                            >
                              <LinkIcon className="h-5 w-5" />
                            </a>
                          ) : href ? (
                            <a
                              href={href}
                              target={isGenericLink ? "_blank" : undefined}
                              rel={isGenericLink ? "noopener noreferrer" : undefined}
                              className="text-sm font-medium text-foreground hover:underline break-words"
                            >
                              {stringValue}
                            </a>
                          ) : (
                            <span className="text-sm font-medium text-foreground break-words">{stringValue}</span>
                          )}
                        </div>
                        {!isEmpty && (isPhone || isEmail || isGenericLink || (isFile && isUrl)) && (
                          <button
                            type="button"
                            onClick={handleCopy}
                            className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                            aria-label={language === "fr" ? "Copier" : "Copy"}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium mb-2">{t.audit}</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {detailData.logs.slice(0, 10).map((log) => (
                    <li key={log.id}>
                      {log.action}
                      {log.admin_name != null && log.admin_name !== "" ? ` – ${log.admin_name}` : ""}
                      {" – "}
                      {format(new Date(log.created_at), "PPp")}
                    </li>
                  ))}
                </ul>
              </div>
              {(detailData.application.status === "new" || detailData.application.status === "reviewed") ? (
                <DialogFooter className="flex-wrap gap-2">
                  <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white" onClick={() => updateStatus(detailData.application.id, "approved")}><CheckCircle className="h-4 w-4 mr-2" />{t.approve}</Button>
                  <Button variant="destructive" onClick={() => updateStatus(detailData.application.id, "rejected")}><XCircle className="h-4 w-4 mr-2" />{t.reject}</Button>
                </DialogFooter>
              ) : null}
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

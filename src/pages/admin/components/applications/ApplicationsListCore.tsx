/**
 * Shared ambassador applications list: filters, table, and row actions.
 * Used by All Applications and Draft Selection detail views.
 */

import React, { Fragment, useCallback, useState } from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogClose,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Download,
  Trash2,
  Search,
  X,
  Calendar as CalendarIcon,
  FileText,
  CheckCircle,
  XCircle,
  Mail as MailIcon,
  Instagram,
  ExternalLink,
  FolderPlus,
  ListChecks,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import type { AmbassadorApplication, Ambassador, SelectedMotivation } from "../../types";
import type { ApplicationsTabProps } from "../ApplicationsTab";
import { AdminResendEmailConfirm, ADMIN_RESEND_EMAIL_CONFIRM_CLOSE_MS } from "../AdminResendEmailConfirm";
import {
  AdminApplicationReviewConfirm,
  ADMIN_APPLICATION_REVIEW_CONFIRM_CLOSE_MS,
  type AdminApplicationReviewAction,
} from "../AdminApplicationReviewConfirm";

export type ApplicationsListCoreProps = ApplicationsTabProps & {
  title?: string;
  countLabel?: string;
  showExport?: boolean;
  showOrphanCleanup?: boolean;
  extraToolbar?: React.ReactNode;
  selectionItemMeta?: Record<string, { added_by_name?: string; added_at?: string }>;
  showAddedByColumn?: boolean;
  onRemoveFromSelection?: (app: AmbassadorApplication) => void;
  showAddToDraft?: boolean;
  onAddToDraft?: (app: AmbassadorApplication) => void;
  enableBulkSelect?: boolean;
  /** When 'all', every visible row can be selected (draft removals). Default 'pending'. */
  bulkSelectScope?: "pending" | "all";
  /** Skip the toggle — checkboxes always visible. Used in draft selections. */
  bulkSelectAlwaysVisible?: boolean;
  bulkSelectedIds?: Set<string>;
  onToggleBulkSelect?: (applicationId: string, checked: boolean) => void;
  onToggleAllBulkSelect?: (applicationIds: string[], checked: boolean) => void;
  /** Rendered below filters when at least one row is selected. */
  bulkActionsBar?: React.ReactNode;
};

function isInstagramUrl(url: string) {
  return (
    url.startsWith("https://www.instagram.com/") ||
    url.startsWith("https://instagram.com/")
  );
}

function SocialLinkIcon({ url }: { url: string }) {
  if (isInstagramUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
        title="View Instagram Profile"
      >
        <Instagram className="w-4 h-4" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline transition-colors"
      title={url}
    >
      <ExternalLink className="w-4 h-4" />
    </a>
  );
}

export function ApplicationsListCore({
  language,
  t,
  filteredApplications,
  ambassadors,
  applicationSearchTerm,
  setApplicationSearchTerm,
  applicationInstagramFilter,
  setApplicationInstagramFilter,
  applicationStatusFilter,
  setApplicationStatusFilter,
  applicationCityFilter,
  setApplicationCityFilter,
  applicationVilleFilter,
  setApplicationVilleFilter,
  applicationDateFrom,
  setApplicationDateFrom,
  applicationDateTo,
  setApplicationDateTo,
  emailStatus,
  emailFailedApplications,
  selectedMotivation,
  setSelectedMotivation,
  isMotivationDialogOpen,
  setIsMotivationDialogOpen,
  getStatusBadge,
  onExportExcel,
  onCleanupOrphaned,
  onApprove,
  onReject,
  onResendEmail,
  processingId,
  orphanedCount,
  title = "Ambassador Applications",
  countLabel = "Applications",
  showExport = true,
  showOrphanCleanup = true,
  extraToolbar,
  selectionItemMeta,
  showAddedByColumn = false,
  onRemoveFromSelection,
  showAddToDraft = false,
  onAddToDraft,
  enableBulkSelect = false,
  bulkSelectScope = "pending",
  bulkSelectAlwaysVisible = false,
  bulkSelectedIds,
  onToggleBulkSelect,
  onToggleAllBulkSelect,
  bulkActionsBar,
}: ApplicationsListCoreProps) {
  const { toast } = useToast();
  const [bulkSelectVisible, setBulkSelectVisible] = useState(bulkSelectAlwaysVisible);
  const [resendTarget, setResendTarget] = useState<AmbassadorApplication | null>(null);
  const [isResendConfirmOpen, setIsResendConfirmOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AmbassadorApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<AdminApplicationReviewAction | null>(null);
  const [isReviewConfirmOpen, setIsReviewConfirmOpen] = useState(false);

  const openReviewConfirm = useCallback(
    (application: AmbassadorApplication, action: AdminApplicationReviewAction) => {
      setReviewTarget(application);
      setReviewAction(action);
      setIsReviewConfirmOpen(true);
    },
    []
  );

  const handleReviewConfirm = useCallback(async () => {
    if (!reviewTarget || !reviewAction) return;
    if (reviewAction === "approve") {
      await onApprove(reviewTarget);
    } else {
      await onReject(reviewTarget);
    }
    setIsReviewConfirmOpen(false);
  }, [reviewTarget, reviewAction, onApprove, onReject]);

  const bulkSelectableIds = enableBulkSelect
    ? filteredApplications
        .filter((a) => bulkSelectScope === "all" || a.status === "pending")
        .map((a) => a.id)
    : [];
  const showBulkCheckboxes =
    enableBulkSelect && (bulkSelectAlwaysVisible || bulkSelectVisible);
  const allBulkSelected =
    bulkSelectableIds.length > 0 &&
    bulkSelectableIds.every((id) => bulkSelectedIds?.has(id));
  const someBulkSelected =
    bulkSelectableIds.some((id) => bulkSelectedIds?.has(id)) && !allBulkSelected;

  const toggleBulkSelectMode = useCallback(() => {
    setBulkSelectVisible((prev) => {
      if (prev && bulkSelectedIds && bulkSelectedIds.size > 0) {
        onToggleAllBulkSelect?.([...bulkSelectedIds], false);
      }
      return !prev;
    });
  }, [bulkSelectedIds, onToggleAllBulkSelect]);

  const tableColSpan =
    10 +
    (showAddedByColumn ? 1 : 0) +
    (showBulkCheckboxes ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filteredApplications.length.toLocaleString()} {countLabel.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extraToolbar}
          {showExport && (
            <Button variant="outline" size="sm" onClick={onExportExcel} className="gap-2">
              <Download className="h-4 w-4" />
              {language === "en" ? "Export Excel" : "Exporter Excel"}
            </Button>
          )}
          {showOrphanCleanup && orphanedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCleanupOrphaned}
              className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              title={
                language === "en"
                  ? "Delete approved applications that have no matching ambassador account (data cleanup)"
                  : "Supprimer les candidatures approuvées sans compte ambassadeur correspondant"
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              {language === "en"
                ? `Cleanup ${orphanedCount} orphaned`
                : `Nettoyer ${orphanedCount} orphelines`}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              language === "en"
                ? "Search by name, email, or phone…"
                : "Rechercher par nom, e-mail ou téléphone…"
            }
            value={applicationSearchTerm}
            onChange={(e) => setApplicationSearchTerm(e.target.value)}
            className="h-9 border-border/60 bg-background pl-9"
          />
        </div>

        <div className="relative">
          <Instagram className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              language === "en"
                ? "Filter by Instagram username or link…"
                : "Filtrer par nom d'utilisateur ou lien Instagram…"
            }
            value={applicationInstagramFilter}
            onChange={(e) => setApplicationInstagramFilter(e.target.value)}
            className="h-9 border-border/60 bg-background pl-9"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[140px] flex-col gap-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "Status" : "Statut"}
            </Label>
            <Select
              value={applicationStatusFilter}
              onValueChange={setApplicationStatusFilter}
            >
              <SelectTrigger className="h-9 w-[160px] bg-background">
                <SelectValue
                  placeholder={
                    language === "en" ? "All Statuses" : "Tous les Statuts"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "en" ? "All Statuses" : "Tous les Statuts"}
                </SelectItem>
                <SelectItem value="pending">
                  {language === "en" ? "Pending" : "En Attente"}
                </SelectItem>
                <SelectItem value="approved">
                  {language === "en" ? "Approved" : "Approuvé"}
                </SelectItem>
                <SelectItem value="rejected">
                  {language === "en" ? "Rejected" : "Rejeté"}
                </SelectItem>
                <SelectItem value="suspended">
                  {language === "en" ? "Suspended" : "Suspendu"}
                </SelectItem>
                <SelectItem value="removed">
                  {language === "en" ? "Removed" : "Retiré"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[140px] flex-col gap-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "City" : "Ville"}
            </Label>
            <Select
              value={applicationCityFilter}
              onValueChange={(value) => {
                setApplicationCityFilter(value);
                if (value !== "all") setApplicationVilleFilter("all");
              }}
            >
              <SelectTrigger className="h-9 w-[160px] bg-background">
                <SelectValue
                  placeholder={
                    language === "en" ? "All Cities" : "Toutes les Villes"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "en" ? "All Cities" : "Toutes les Villes"}
                </SelectItem>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(applicationCityFilter === "Sousse" ||
            applicationCityFilter === "Tunis" ||
            applicationCityFilter === "all") && (
            <div className="flex min-w-[160px] flex-col gap-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {language === "en" ? "Neighborhood" : "Quartier"}
              </Label>
              <Select
                value={applicationVilleFilter}
                onValueChange={setApplicationVilleFilter}
                disabled={
                  applicationCityFilter !== "Sousse" &&
                  applicationCityFilter !== "Tunis" &&
                  applicationCityFilter !== "all"
                }
              >
                <SelectTrigger className="h-9 w-[180px] bg-background">
                    <SelectValue
                      placeholder={
                        language === "en" ? "All Villes" : "Tous les Quartiers"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="[&[data-side=top]]:!hidden"
                  >
                    <SelectItem value="all">
                      {language === "en" ? "All Villes" : "Tous les Quartiers"}
                    </SelectItem>
                    {applicationCityFilter === "Sousse" &&
                      SOUSSE_VILLES.map((ville) => (
                        <SelectItem key={ville} value={ville}>
                          {ville}
                        </SelectItem>
                      ))}
                    {applicationCityFilter === "Tunis" &&
                      TUNIS_VILLES.map((ville) => (
                        <SelectItem key={ville} value={ville}>
                          {ville}
                        </SelectItem>
                      ))}
                    {applicationCityFilter === "all" && (
                      <>
                        {SOUSSE_VILLES.map((ville) => (
                          <SelectItem key={`sousse-${ville}`} value={ville}>
                            {ville} (Sousse)
                          </SelectItem>
                        ))}
                        {TUNIS_VILLES.map((ville) => (
                          <SelectItem key={`tunis-${ville}`} value={ville}>
                            {ville} (Tunis)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
            </div>
          )}

          {(applicationStatusFilter !== "pending" ||
            applicationCityFilter !== "all" ||
            applicationVilleFilter !== "all" ||
            applicationInstagramFilter.trim()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setApplicationStatusFilter("pending");
                setApplicationCityFilter("all");
                setApplicationVilleFilter("all");
                setApplicationInstagramFilter("");
              }}
              className="h-9 text-xs text-muted-foreground"
            >
              <X className="mr-1 h-3 w-3" />
              {language === "en" ? "Clear filters" : "Effacer les filtres"}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-border/50 pt-3">
          <div className="flex min-w-[160px] flex-col gap-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "From" : "Du"}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-[180px] justify-start bg-background text-left font-normal",
                    !applicationDateFrom && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                  <span className="truncate">
                    {applicationDateFrom
                      ? format(applicationDateFrom, "dd/MM/yyyy")
                      : language === "en"
                        ? "Pick date"
                        : "Choisir"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={applicationDateFrom}
                  onSelect={(date) => setApplicationDateFrom(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex min-w-[160px] flex-col gap-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {language === "en" ? "To" : "Au"}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!applicationDateFrom}
                  className={cn(
                    "h-9 w-[180px] justify-start bg-background text-left font-normal",
                    !applicationDateTo && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                  <span className="truncate">
                    {applicationDateTo
                      ? format(applicationDateTo, "dd/MM/yyyy")
                      : language === "en"
                        ? "Pick date"
                        : "Choisir"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={applicationDateTo}
                  onSelect={(date) => setApplicationDateTo(date)}
                  disabled={(date) =>
                    applicationDateFrom ? date < applicationDateFrom : false
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {(applicationDateFrom || applicationDateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setApplicationDateFrom(undefined);
                setApplicationDateTo(undefined);
              }}
              className="h-9 text-xs text-muted-foreground"
            >
              <X className="mr-1 h-3 w-3" />
              {language === "en" ? "Clear dates" : "Effacer les dates"}
            </Button>
          )}
        </div>
      </div>

      {enableBulkSelect && bulkSelectedIds && bulkSelectedIds.size > 0 && bulkActionsBar ? (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5 sm:px-4">
          {bulkActionsBar}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              {showBulkCheckboxes && (
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground w-10">
                    <Checkbox
                      checked={allBulkSelected ? true : someBulkSelected ? "indeterminate" : false}
                      onCheckedChange={(v) =>
                        onToggleAllBulkSelect?.(bulkSelectableIds, v === true)
                      }
                      aria-label={
                        bulkSelectScope === "all"
                          ? language === "en"
                            ? "Select all visible"
                            : "Tout sélectionner (affichés)"
                          : language === "en"
                            ? "Select all pending"
                            : "Tout sélectionner (en attente)"
                      }
                    />
                  </TableHead>
                )}
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {enableBulkSelect && !bulkSelectAlwaysVisible && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 shrink-0",
                          bulkSelectVisible && "text-primary bg-primary/10",
                        )}
                        onClick={toggleBulkSelectMode}
                        title={
                          bulkSelectVisible
                            ? language === "en"
                              ? "Hide selection"
                              : "Masquer la sélection"
                            : language === "en"
                              ? "Select applications"
                              : "Sélectionner des candidatures"
                        }
                        aria-pressed={bulkSelectVisible}
                      >
                        <ListChecks className="w-4 h-4" />
                      </Button>
                    )}
                    <span>Name</span>
                  </div>
                </TableHead>
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Age
                </TableHead>
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Phone
                </TableHead>
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </TableHead>
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  City
                </TableHead>
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {language === "en" ? "Ville" : "Quartier"}
                </TableHead>
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                {showAddedByColumn && (
                  <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {language === "en" ? "Added by" : "Ajouté par"}
                  </TableHead>
                )}
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Applied
                </TableHead>
                <TableHead className="h-auto px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Details
                </TableHead>
                <TableHead className="h-auto px-2 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TooltipProvider delayDuration={300}>
                {filteredApplications.map((application) => {
                  const itemMeta = selectionItemMeta?.[application.id];
                  const showReviewerTooltip =
                    application.status !== "pending" &&
                    !!(application.reviewed_by_name?.trim() || application.reviewed_at);
                  const reviewerDisplayName =
                    application.reviewed_by_name?.trim() ||
                    (language === "en" ? "Not recorded" : "Non enregistré");
                const row = (
                    <TableRow
                      className={cn(
                        "border-border/50 hover:bg-muted/20",
                        showBulkCheckboxes &&
                          bulkSelectedIds?.has(application.id) &&
                          "bg-primary/[0.04] hover:bg-primary/[0.07]",
                        showReviewerTooltip && "cursor-help",
                      )}
                    >
                      {showBulkCheckboxes && (
                        <TableCell className="text-xs px-2 py-2">
                          {(bulkSelectScope === "all" || application.status === "pending") ? (
                            <Checkbox
                              checked={bulkSelectedIds?.has(application.id) ?? false}
                              onCheckedChange={(v) =>
                                onToggleBulkSelect?.(application.id, v === true)
                              }
                              aria-label={
                                language === "en" ? "Select application" : "Sélectionner"
                              }
                            />
                          ) : null}
                        </TableCell>
                      )}
                      <TableCell className="px-2 py-2.5 text-sm font-medium">
                        {application.full_name}
                      </TableCell>
                      <TableCell className="px-2 py-2.5 text-sm tabular-nums text-muted-foreground">
                        {application.age}
                      </TableCell>
                      <TableCell className="px-2 py-2.5 text-sm text-muted-foreground">
                        {application.phone_number}
                      </TableCell>
                      <TableCell className="px-2 py-2.5 text-sm">
                        {application.email ? (
                          <button
                            type="button"
                            className="max-w-[120px] truncate text-left text-primary hover:underline"
                            onClick={() => {
                              navigator.clipboard.writeText(application.email!);
                              toast({
                                title: language === "en" ? "Email copied" : "E-mail copié",
                                description: application.email!,
                              });
                            }}
                            title={application.email}
                          >
                            {application.email}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-2.5 text-sm">{application.city}</TableCell>
                      <TableCell className="text-xs px-2 py-2">
                        {application.ville ? (
                          <span className="text-xs">{application.ville}</span>
                        ) : application.city === "Sousse" || application.city === "Tunis" ? (
                          (() => {
                            const matchingAmbassador = ambassadors.find(
                              (amb) =>
                                amb.phone === application.phone_number ||
                                (application.email && amb.email === application.email),
                            );
                            return matchingAmbassador?.ville ? (
                              <span className="text-xs text-muted-foreground italic">
                                {matchingAmbassador.ville}*
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            );
                          })()
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs px-2 py-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(application.status)}
                          {application.status === "approved" && (
                            <div
                              className="flex items-center"
                              title={
                                emailStatus[application.id] === "sent"
                                  ? language === "en"
                                    ? "Email sent successfully"
                                    : "Email envoyé avec succès"
                                  : emailStatus[application.id] === "failed"
                                    ? language === "en"
                                      ? "Email failed to send"
                                      : "Échec de l'envoi de l'email"
                                    : emailStatus[application.id] === "pending"
                                      ? language === "en"
                                        ? "Email sending..."
                                        : "Envoi de l'email..."
                                      : language === "en"
                                        ? "Email status unknown"
                                        : "Statut de l'email inconnu"
                              }
                            >
                              {emailStatus[application.id] === "sent" ? (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              ) : emailStatus[application.id] === "failed" ? (
                                <XCircle className="w-3 h-3 text-red-500" />
                              ) : emailStatus[application.id] === "pending" ? (
                                <Loader size="sm" className="[background:#facc15] shrink-0" />
                              ) : emailFailedApplications.has(application.id) ? (
                                <XCircle className="w-3 h-3 text-red-500" />
                              ) : (
                                <MailIcon className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {showAddedByColumn && (
                        <TableCell className="text-xs px-2 py-2">
                          {itemMeta?.added_by_name?.trim() ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">
                                  {itemMeta.added_by_name}
                                </span>
                              </TooltipTrigger>
                              {itemMeta.added_at && (
                                <TooltipContent>
                                  {format(new Date(itemMeta.added_at), "dd/MM/yyyy HH:mm")}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="px-2 py-2.5 text-sm tabular-nums text-muted-foreground">
                        {format(new Date(application.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-xs px-2 py-2">
                        <div className="flex items-center gap-2">
                          {application.motivation && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMotivation({
                                  application,
                                  motivation: application.motivation!,
                                });
                                setIsMotivationDialogOpen(true);
                              }}
                              className="inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent hover:opacity-80 transition-opacity cursor-pointer"
                              title={
                                language === "en"
                                  ? "Click to view motivation"
                                  : "Cliquer pour voir la motivation"
                              }
                            >
                              <FileText className="w-3 h-3 text-primary" />
                            </button>
                          )}
                          {application.social_link && (
                            <div className="flex items-center">
                              <SocialLinkIcon url={application.social_link} />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs px-2 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {application.status === "pending" && (
                            <>
                              <Button
                                onClick={() => openReviewConfirm(application, "approve")}
                                disabled={processingId === application.id}
                                size="sm"
                                variant="outline"
                                className="h-7 border-emerald-500/40 px-2 text-xs text-emerald-600 hover:bg-emerald-500/10"
                              >
                                {processingId === application.id ? (
                                  <>
                                    <Loader size="sm" className="mr-1 shrink-0" />
                                    {t.processing}
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    {t.approve}
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => openReviewConfirm(application, "reject")}
                                disabled={processingId === application.id}
                                size="sm"
                                variant="outline"
                                className="h-7 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                              >
                                {processingId === application.id ? (
                                  <>
                                    <Loader size="sm" className="mr-1 shrink-0" />
                                    {t.processing}
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="mr-1 h-3 w-3" />
                                    {t.reject}
                                  </>
                                )}
                              </Button>
                              {showAddToDraft && onAddToDraft && (
                                <Button
                                  onClick={() => onAddToDraft(application)}
                                  disabled={processingId === application.id}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-primary/40 px-2 text-xs text-primary hover:bg-primary/10"
                                  title={
                                    language === "en"
                                      ? "Add to draft selection"
                                      : "Ajouter à une sélection"
                                  }
                                >
                                  <FolderPlus className="mr-1 h-3 w-3" />
                                  {language === "en" ? "Add" : "Ajouter"}
                                </Button>
                              )}
                            </>
                          )}
                          {application.status === "approved" && (
                            <div className="flex gap-1">
                              <Button
                                onClick={() => {
                                  setResendTarget(application);
                                  setIsResendConfirmOpen(true);
                                }}
                                disabled={processingId === application.id}
                                size="sm"
                                className="h-7 px-2 text-xs bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600/40"
                                title={
                                  emailStatus[application.id] === "failed"
                                    ? language === "en"
                                      ? "Email failed - Click to resend"
                                      : "Échec de l'email - Cliquez pour renvoyer"
                                    : emailStatus[application.id] === "sent"
                                      ? language === "en"
                                        ? "Email sent - Click to resend"
                                        : "Email envoyé - Cliquez pour renvoyer"
                                      : language === "en"
                                        ? "Resend approval email"
                                        : "Renvoyer l'email d'approbation"
                                }
                              >
                                {processingId === application.id ? (
                                  <>
                                    <Loader size="sm" className="mr-1 shrink-0" />
                                    <span className="text-xs">
                                      {language === "en" ? "Sending..." : "Envoi..."}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <MailIcon className="mr-1 h-3 w-3" />
                                    <span className="text-xs">
                                      {language === "en" ? "Resend" : "Renvoyer"}
                                    </span>
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                          {onRemoveFromSelection && (
                            <Button
                              onClick={() => onRemoveFromSelection(application)}
                              size="sm"
                              variant="outline"
                              className="text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                              style={{
                                fontSize: "0.7rem",
                                padding: "0.25rem 0.5rem",
                                height: "auto",
                              }}
                              title={
                                language === "en"
                                  ? "Remove from draft only"
                                  : "Retirer du brouillon uniquement"
                              }
                            >
                              <X className="w-2.5 h-2.5 mr-1" />
                              <span className="text-xs">
                                {language === "en" ? "Remove" : "Retirer"}
                              </span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  return (
                    <Fragment key={application.id}>
                      {showReviewerTooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{row}</TooltipTrigger>
                          <TooltipContent side="top" align="center" className="max-w-xs">
                            <p className="text-xs text-muted-foreground">
                              {language === "en" ? "Reviewed by" : "Examiné par"}
                            </p>
                            <p className="text-sm font-semibold">{reviewerDisplayName}</p>
                            {application.reviewed_at ? (
                              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                                {format(new Date(application.reviewed_at), "dd/MM/yyyy HH:mm")}
                              </p>
                            ) : null}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        row
                      )}
                    </Fragment>
                  );
                })}
              </TooltipProvider>
              {filteredApplications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="text-center py-8">
                    {applicationSearchTerm || applicationInstagramFilter.trim() ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {language === "en"
                            ? applicationInstagramFilter.trim()
                              ? `No results for Instagram "${applicationInstagramFilter.trim()}"`
                              : `No results for "${applicationSearchTerm}"`
                            : applicationInstagramFilter.trim()
                              ? `Aucun résultat pour Instagram « ${applicationInstagramFilter.trim()} »`
                              : `Aucun résultat pour « ${applicationSearchTerm} »`}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setApplicationSearchTerm("");
                            setApplicationInstagramFilter("");
                          }}
                        >
                          {language === "en" ? "Clear search" : "Effacer la recherche"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t.noApplications}</p>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </div>

      <Dialog open={isMotivationDialogOpen} onOpenChange={setIsMotivationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === "en" ? "Application Motivation" : "Motivation de la Candidature"}
            </DialogTitle>
          </DialogHeader>
          {selectedMotivation && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {language === "en" ? "Applicant:" : "Candidat:"}
                </p>
                <p className="text-lg font-semibold">
                  {selectedMotivation.application.full_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {language === "en" ? "Motivation:" : "Motivation:"}
                </p>
                <div className="p-4 bg-muted/50 rounded-lg border border-border max-h-[60vh] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {selectedMotivation.motivation}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline">{language === "en" ? "Close" : "Fermer"}</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <AdminResendEmailConfirm
        open={isResendConfirmOpen}
        onOpenChange={(nextOpen) => {
          setIsResendConfirmOpen(nextOpen);
          if (!nextOpen) {
            window.setTimeout(() => setResendTarget(null), ADMIN_RESEND_EMAIL_CONFIRM_CLOSE_MS);
          }
        }}
        kind={isResendConfirmOpen ? "approval" : null}
        language={language}
        recipientName={resendTarget?.full_name}
        recipientEmail={resendTarget?.email}
        recipientPhone={resendTarget?.phone_number}
        onConfirm={async () => {
          if (!resendTarget) return;
          setIsResendConfirmOpen(false);
          await onResendEmail(resendTarget);
        }}
        isSubmitting={!!resendTarget && processingId === resendTarget.id}
      />

      <AdminApplicationReviewConfirm
        open={isReviewConfirmOpen}
        onOpenChange={(nextOpen) => {
          setIsReviewConfirmOpen(nextOpen);
          if (!nextOpen) {
            window.setTimeout(() => {
              setReviewTarget(null);
              setReviewAction(null);
            }, ADMIN_APPLICATION_REVIEW_CONFIRM_CLOSE_MS);
          }
        }}
        action={isReviewConfirmOpen ? reviewAction : null}
        application={isReviewConfirmOpen ? reviewTarget : null}
        language={language}
        onConfirm={handleReviewConfirm}
        isSubmitting={!!reviewTarget && processingId === reviewTarget.id}
      />
    </div>
  );
}

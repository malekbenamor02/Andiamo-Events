/**
 * Draft selections panel: list selections, open one, review applications with shared list UI.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Archive, CheckCircle, Download, FolderOpen, Plus, User, XCircle } from "lucide-react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { filterAmbassadorApplications } from "../../lib/filterApplications";
import { exportDraftSelectionToExcel } from "../../lib/exportAmbassadorApplicationsExcel";
import { ApplicationsListCore } from "./ApplicationsListCore";
import {
  AdminApplicationBulkActionConfirm,
  ADMIN_APPLICATION_BULK_CONFIRM_CLOSE_MS,
  type AdminApplicationBulkAction,
} from "../AdminApplicationBulkActionConfirm";
import type { useApplicationSelections } from "../../hooks/useApplicationSelections";
import type { AmbassadorApplication, AmbassadorApplicationSelection } from "../../types";
import type { ApplicationsTabProps } from "../ApplicationsTab";

export type ApplicationSelectionsPanelProps = Omit<
  ApplicationsTabProps,
  | "filteredApplications"
  | "applicationSearchTerm"
  | "setApplicationSearchTerm"
  | "applicationStatusFilter"
  | "setApplicationStatusFilter"
  | "applicationCityFilter"
  | "setApplicationCityFilter"
  | "applicationVilleFilter"
  | "setApplicationVilleFilter"
  | "applicationDateFrom"
  | "setApplicationDateFrom"
  | "applicationDateTo"
  | "setApplicationDateTo"
  | "onExportExcel"
  | "onCleanupOrphaned"
  | "orphanedCount"
> & {
  selectionsApi: ReturnType<typeof useApplicationSelections>;
};

export function ApplicationSelectionsPanel({
  language,
  t,
  applications,
  ambassadors,
  emailStatus,
  emailFailedApplications,
  selectedMotivation,
  setSelectedMotivation,
  isMotivationDialogOpen,
  setIsMotivationDialogOpen,
  getStatusBadge,
  onApprove,
  onReject,
  onResendEmail,
  processingId,
  currentAdminId,
  currentAdminName,
  currentAdminEmail,
  ambassadorMap,
  selectionsApi,
}: ApplicationSelectionsPanelProps) {
  const { toast } = useToast();
  const {
    selections,
    selectionItems,
    loadedSelectionId,
    loadingSelections,
    loadingItems,
    fetchSelections,
    fetchSelectionItems,
    createSelection,
    archiveSelection,
    removeApplicationFromSelection,
    removeApplicationsFromSelection,
    fetchSelectionItemsSnapshot,
    clearSelectionItems,
  } = selectionsApi;

  const [selectedSelectionId, setSelectedSelectionId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSelectionName, setNewSelectionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [exportingSelectionId, setExportingSelectionId] = useState<string | null>(null);

  const [selectionSearchTerm, setSelectionSearchTerm] = useState("");
  const [selectionStatusFilter, setSelectionStatusFilter] = useState("pending");
  const [selectionCityFilter, setSelectionCityFilter] = useState("all");
  const [selectionVilleFilter, setSelectionVilleFilter] = useState("all");
  const [selectionDateFrom, setSelectionDateFrom] = useState<Date | undefined>(undefined);
  const [selectionDateTo, setSelectionDateTo] = useState<Date | undefined>(undefined);

  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<AdminApplicationBulkAction | null>(null);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AmbassadorApplication | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    fetchSelections({ silent: selections.length > 0 }).catch((err) => {
      console.error("Failed to fetch selections:", err);
      toast({
        title: language === "en" ? "Error" : "Erreur",
        description:
          language === "en"
            ? "Failed to load draft selections"
            : "Échec du chargement des sélections",
        variant: "destructive",
      });
    });
  }, [fetchSelections, language, toast]);

  const selectedSelectionMeta = selections.find((s) => s.id === selectedSelectionId);

  useEffect(() => {
    setBulkSelectedIds(new Set());
  }, [selectedSelectionId]);

  useEffect(() => {
    if (!selectedSelectionId) {
      clearSelectionItems();
      return;
    }
    fetchSelectionItems(selectedSelectionId).catch((err) => {
      console.error("Failed to fetch selection items:", err);
    });
  }, [
    selectedSelectionId,
    selectedSelectionMeta?.item_count,
    fetchSelectionItems,
    clearSelectionItems,
  ]);

  const selectedSelection = useMemo(
    () => selections.find((s) => s.id === selectedSelectionId) ?? null,
    [selections, selectedSelectionId],
  );

  const selectionApplicationIds = useMemo(
    () => new Set(selectionItems.map((item) => item.application_id)),
    [selectionItems],
  );

  const selectionBaseApps = useMemo(
    () => applications.filter((a) => selectionApplicationIds.has(a.id)),
    [applications, selectionApplicationIds],
  );

  const selectionFilteredApps = useMemo(
    () =>
      filterAmbassadorApplications(selectionBaseApps, {
        searchTerm: selectionSearchTerm,
        statusFilter: selectionStatusFilter,
        cityFilter: selectionCityFilter,
        villeFilter: selectionVilleFilter,
        dateFrom: selectionDateFrom,
        dateTo: selectionDateTo,
        ambassadorMap,
      }),
    [
      selectionBaseApps,
      selectionSearchTerm,
      selectionStatusFilter,
      selectionCityFilter,
      selectionVilleFilter,
      selectionDateFrom,
      selectionDateTo,
      ambassadorMap,
    ],
  );

  const selectionItemMeta = useMemo(() => {
    const meta: Record<string, { added_by_name?: string; added_at?: string }> = {};
    for (const item of selectionItems) {
      meta[item.application_id] = {
        added_by_name: item.added_by_name ?? undefined,
        added_at: item.added_at,
      };
    }
    return meta;
  }, [selectionItems]);

  const bulkSelectableIds = useMemo(
    () => selectionFilteredApps.map((a) => a.id),
    [selectionFilteredApps],
  );

  const bulkSelectedApps = useMemo(
    () => selectionFilteredApps.filter((a) => bulkSelectedIds.has(a.id)),
    [selectionFilteredApps, bulkSelectedIds],
  );

  const bulkPendingApps = useMemo(
    () => bulkSelectedApps.filter((a) => a.status === "pending"),
    [bulkSelectedApps],
  );

  const handleToggleBulkSelect = useCallback((applicationId: string, checked: boolean) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(applicationId);
      else next.delete(applicationId);
      return next;
    });
  }, []);

  const handleToggleAllBulkSelect = useCallback((applicationIds: string[], checked: boolean) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) applicationIds.forEach((id) => next.add(id));
      else applicationIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const openBulkConfirm = useCallback(
    (action: AdminApplicationBulkAction) => {
      if (bulkSelectedIds.size === 0) return;
      if ((action === "approve" || action === "reject") && bulkPendingApps.length === 0) {
        toast({
          title: language === "en" ? "No pending applications" : "Aucune candidature en attente",
          description:
            language === "en"
              ? "Approve and reject only apply to pending applications in your selection."
              : "L'approbation et le rejet ne s'appliquent qu'aux candidatures en attente.",
          variant: "destructive",
        });
        return;
      }
      setBulkAction(action);
      setIsBulkConfirmOpen(true);
    },
    [bulkSelectedIds.size, bulkPendingApps.length, language, toast],
  );

  const bulkConfirmApps = useMemo(() => {
    if (bulkAction === "remove") return bulkSelectedApps;
    return bulkPendingApps;
  }, [bulkAction, bulkSelectedApps, bulkPendingApps]);

  const handleBulkConfirm = useCallback(async () => {
    if (!bulkAction || !selectedSelectionId) return;

    setBulkProcessing(true);
    try {
      if (bulkAction === "remove") {
        const ids = bulkSelectedApps.map((a) => a.id);
        await removeApplicationsFromSelection(selectedSelectionId, ids);
        setBulkSelectedIds(new Set());
        toast({
          title: language === "en" ? "Removed from draft" : "Retiré du brouillon",
          description:
            language === "en"
              ? `${ids.length} application${ids.length === 1 ? "" : "s"} removed.`
              : `${ids.length} candidature${ids.length === 1 ? "" : "s"} retirée(s).`,
        });
      } else {
        const targets = bulkPendingApps;
        let succeeded = 0;
        const expectedStatus = bulkAction === "approve" ? "approved" : "rejected";
        for (const app of targets) {
          if (bulkAction === "approve") await onApprove(app);
          else await onReject(app);

          const { data: statusRow } = await supabase
            .from("ambassador_applications")
            .select("status")
            .eq("id", app.id)
            .maybeSingle();

          if (statusRow?.status === expectedStatus) {
            succeeded += 1;
            setBulkSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(app.id);
              return next;
            });
          }
        }
        if (succeeded === targets.length) {
          toast({
            title:
              bulkAction === "approve"
                ? language === "en"
                  ? "Applications approved"
                  : "Candidatures approuvées"
                : language === "en"
                  ? "Applications rejected"
                  : "Candidatures rejetées",
            description:
              language === "en"
                ? `${succeeded} processed successfully.`
                : `${succeeded} traitée(s) avec succès.`,
          });
        } else if (succeeded > 0) {
          toast({
            title: language === "en" ? "Partially completed" : "Partiellement terminé",
            description:
              language === "en"
                ? `${succeeded} of ${targets.length} processed. Check remaining items.`
                : `${succeeded} sur ${targets.length} traitée(s). Vérifiez les éléments restants.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: language === "en" ? "Error" : "Erreur",
            description:
              language === "en"
                ? "Could not process the selected applications."
                : "Impossible de traiter les candidatures sélectionnées.",
            variant: "destructive",
          });
        }
      }
      setIsBulkConfirmOpen(false);
    } catch (err) {
      console.error(err);
      toast({
        title: language === "en" ? "Error" : "Erreur",
        variant: "destructive",
      });
    } finally {
      setBulkProcessing(false);
    }
  }, [
    bulkAction,
    selectedSelectionId,
    bulkSelectedApps,
    bulkPendingApps,
    removeApplicationsFromSelection,
    onApprove,
    onReject,
    language,
    toast,
  ]);

  const allBulkSelected =
    bulkSelectableIds.length > 0 &&
    bulkSelectableIds.every((id) => bulkSelectedIds.has(id));

  const bulkActionsBar =
    bulkSelectedIds.size > 0 ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {bulkSelectedIds.size}{" "}
          {language === "en" ? "selected" : "sélectionné(s)"}
          {bulkPendingApps.length > 0 && bulkPendingApps.length < bulkSelectedIds.size ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              · {bulkPendingApps.length} {language === "en" ? "pending" : "en attente"}
            </span>
          ) : null}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => handleToggleAllBulkSelect(bulkSelectableIds, !allBulkSelected)}
          >
            {allBulkSelected
              ? language === "en"
                ? "Deselect all"
                : "Tout désélectionner"
              : language === "en"
                ? "Select all"
                : "Tout sélectionner"}
          </Button>
          <span className="hidden sm:inline text-border">|</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkProcessing || bulkPendingApps.length === 0}
            onClick={() => openBulkConfirm("approve")}
            className="h-8 border-emerald-500/40 text-xs text-emerald-600 hover:bg-emerald-500/10"
          >
            <CheckCircle className="mr-1 h-3.5 w-3.5" />
            {language === "en" ? "Approve" : "Approuver"}
            {bulkPendingApps.length > 0 && bulkPendingApps.length < bulkSelectedIds.size
              ? ` (${bulkPendingApps.length})`
              : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkProcessing || bulkPendingApps.length === 0}
            onClick={() => openBulkConfirm("reject")}
            className="h-8 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            {language === "en" ? "Reject" : "Rejeter"}
            {bulkPendingApps.length > 0 && bulkPendingApps.length < bulkSelectedIds.size
              ? ` (${bulkPendingApps.length})`
              : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkProcessing}
            onClick={() => openBulkConfirm("remove")}
            className="h-8 border-amber-500/40 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-500"
          >
            {language === "en" ? "Remove from draft" : "Retirer du brouillon"}
          </Button>
        </div>
      </div>
    ) : null;

  const adminDisplayName =
    (currentAdminName && currentAdminName.trim()) ||
    (currentAdminEmail && currentAdminEmail.trim()) ||
    null;

  const isLoadingSelectionApps =
    !!selectedSelection &&
    (loadingItems || loadedSelectionId !== selectedSelectionId);

  const handleCreateSelection = async () => {
    const name = newSelectionName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createSelection({
        name,
        createdByAdminId: currentAdminId,
        createdByName: adminDisplayName,
      });
      setNewSelectionName("");
      setIsCreateOpen(false);
      setSelectedSelectionId(created.id);
      toast({
        title: language === "en" ? "Selection created" : "Sélection créée",
        description: name,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: language === "en" ? "Error" : "Erreur",
        description:
          language === "en" ? "Failed to create selection" : "Échec de la création",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveFromSelection = useCallback(
    async (app: AmbassadorApplication) => {
      if (!selectedSelectionId) return;
      try {
        await removeApplicationFromSelection(selectedSelectionId, app.id);
        toast({
          title: language === "en" ? "Removed" : "Retiré",
          description: app.full_name,
        });
      } catch (err) {
        console.error(err);
        toast({
          title: language === "en" ? "Error" : "Erreur",
          variant: "destructive",
        });
      }
    },
    [selectedSelectionId, removeApplicationFromSelection, language, toast],
  );

  const handleExportDraft = useCallback(
    async (selection: AmbassadorApplicationSelection) => {
      setExportingSelectionId(selection.id);
      try {
        const items = await fetchSelectionItemsSnapshot(selection.id);
        const count = await exportDraftSelectionToExcel({
          selection,
          selectionItems: items,
          applications,
          ambassadors,
        });
        toast({
          title: language === "en" ? "Export Successful" : "Exportation réussie",
          description:
            language === "en"
              ? `Exported ${count} applications to Excel`
              : `${count} candidatures exportées vers Excel`,
        });
      } catch (err) {
        console.error("Error exporting draft selection:", err);
        toast({
          title: language === "en" ? "Export Failed" : "Échec de l'exportation",
          description:
            language === "en"
              ? "Failed to export draft selection. Please try again."
              : "Échec de l'exportation du brouillon. Veuillez réessayer.",
          variant: "destructive",
        });
      } finally {
        setExportingSelectionId(null);
      }
    },
    [
      fetchSelectionItemsSnapshot,
      applications,
      ambassadors,
      language,
      toast,
    ],
  );

  const handleArchive = async () => {
    if (!archiveTargetId) return;
    setArchiving(true);
    try {
      await archiveSelection(archiveTargetId);
      if (selectedSelectionId === archiveTargetId) {
        setSelectedSelectionId(null);
      }
      toast({
        title: language === "en" ? "Selection archived" : "Sélection archivée",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: language === "en" ? "Error" : "Erreur",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
      setArchiveTargetId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* Top: draft selection picker */}
      <section className="shrink-0 rounded-lg border border-border bg-card/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">
            {language === "en" ? "Draft Selections" : "Sélections brouillon"}
          </h3>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {language === "en" ? "New draft" : "Nouveau brouillon"}
          </Button>
        </div>

        {loadingSelections && selections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader size="lg" />
            <p className="text-sm text-muted-foreground">
              {language === "en" ? "Loading drafts..." : "Chargement des brouillons..."}
            </p>
          </div>
        ) : selections.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            {language === "en" ? "No drafts yet." : "Aucun brouillon."}
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {selections.map((selection) => {
              const isExporting = exportingSelectionId === selection.id;
              const exportLabel =
                language === "en" ? "Export to Excel" : "Exporter vers Excel";

              return (
              <div
                key={selection.id}
                className={cn(
                  "group relative shrink-0 w-[200px] rounded-lg border overflow-hidden transition-all duration-200",
                  selectedSelectionId === selection.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/50 hover:bg-muted/40 hover:shadow-md hover:shadow-primary/5",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedSelectionId(selection.id)}
                  className="w-full text-left p-3 pb-11"
                >
                  <div className="flex items-start justify-between gap-2 min-h-[2.5rem]">
                    <span className="font-medium text-sm line-clamp-2 leading-snug">
                      {selection.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs bg-primary/15 text-primary border-0"
                    >
                      {selection.item_count ?? 0}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {selection.created_by_name?.trim() ||
                        (language === "en" ? "Unknown" : "Inconnu")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(selection.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </button>

                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 px-2 pb-2 pt-6",
                    "bg-gradient-to-t from-card via-card/95 to-transparent",
                    "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100",
                    "group-focus-within:translate-y-0 group-focus-within:opacity-100",
                    "transition-all duration-200 ease-out",
                    isExporting && "translate-y-0 opacity-100",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void handleExportDraft(selection)}
                    disabled={isExporting}
                    title={exportLabel}
                    aria-label={exportLabel}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5",
                      "h-7 rounded-md text-xs font-medium",
                      "bg-primary/10 text-primary border border-primary/20",
                      "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      "disabled:opacity-60 disabled:cursor-not-allowed",
                      "transition-colors duration-150",
                    )}
                  >
                    {isExporting ? (
                      <>
                        <Loader size="sm" className="[background:white] shrink-0" />
                        <span>{language === "en" ? "Exporting…" : "Export…"}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>{language === "en" ? "Export" : "Exporter"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </section>

      {/* Bottom: applications list — full width, remaining space */}
      <section className="flex-1 min-w-0 min-h-0">
        {!selectedSelection ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed rounded-lg h-full min-h-[320px]">
            <FolderOpen className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">
              {language === "en"
                ? "Select a draft above to view its applications"
                : "Sélectionnez un brouillon ci-dessus pour voir les candidatures"}
            </p>
          </div>
        ) : isLoadingSelectionApps ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border py-16 min-h-[320px]">
            <Loader size="lg" />
            <p className="text-sm text-muted-foreground">
              {language === "en" ? "Loading applications..." : "Chargement des candidatures..."}
            </p>
          </div>
        ) : (
          <ApplicationsListCore
            language={language}
            t={t}
            filteredApplications={selectionFilteredApps}
            applications={applications}
            ambassadors={ambassadors}
            applicationSearchTerm={selectionSearchTerm}
            setApplicationSearchTerm={setSelectionSearchTerm}
            applicationStatusFilter={selectionStatusFilter}
            setApplicationStatusFilter={setSelectionStatusFilter}
            applicationCityFilter={selectionCityFilter}
            setApplicationCityFilter={setSelectionCityFilter}
            applicationVilleFilter={selectionVilleFilter}
            setApplicationVilleFilter={setSelectionVilleFilter}
            applicationDateFrom={selectionDateFrom}
            setApplicationDateFrom={setSelectionDateFrom}
            applicationDateTo={selectionDateTo}
            setApplicationDateTo={setSelectionDateTo}
            emailStatus={emailStatus}
            emailFailedApplications={emailFailedApplications}
            selectedMotivation={selectedMotivation}
            setSelectedMotivation={setSelectedMotivation}
            isMotivationDialogOpen={isMotivationDialogOpen}
            setIsMotivationDialogOpen={setIsMotivationDialogOpen}
            getStatusBadge={getStatusBadge}
            onExportExcel={async () => {}}
            onCleanupOrphaned={() => {}}
            onApprove={onApprove}
            onReject={onReject}
            onResendEmail={onResendEmail}
            processingId={processingId}
            orphanedCount={0}
            title={selectedSelection.name}
            countLabel={language === "en" ? "in selection" : "dans la sélection"}
            showExport={false}
            showOrphanCleanup={false}
            showAddedByColumn
            selectionItemMeta={selectionItemMeta}
            onRemoveFromSelection={(app) => setRemoveTarget(app)}
            enableBulkSelect
            bulkSelectScope="all"
            bulkSelectAlwaysVisible
            bulkSelectedIds={bulkSelectedIds}
            onToggleBulkSelect={handleToggleBulkSelect}
            onToggleAllBulkSelect={handleToggleAllBulkSelect}
            bulkActionsBar={bulkActionsBar}
            extraToolbar={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setArchiveTargetId(selectedSelection.id)}
                  title={
                    language === "en"
                      ? "Hide this draft from the active list (applications unchanged)"
                      : "Masquer ce brouillon (candidatures inchangées)"
                  }
                >
                  <Archive className="w-4 h-4 mr-1" />
                  {language === "en" ? "Archive" : "Archiver"}
                </Button>
                {selectedSelection.created_by_name && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {language === "en" ? "Created by" : "Créé par"}{" "}
                    <strong>{selectedSelection.created_by_name}</strong> ·{" "}
                    {format(new Date(selectedSelection.created_at), "dd/MM/yyyy HH:mm")}
                  </span>
                )}
              </>
            }
          />
        )}
      </section>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "en" ? "New draft selection" : "Nouvelle sélection brouillon"}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder={language === "en" ? "Selection name..." : "Nom de la sélection..."}
            value={newSelectionName}
            onChange={(e) => setNewSelectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateSelection();
            }}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{language === "en" ? "Cancel" : "Annuler"}</Button>
            </DialogClose>
            <Button
              onClick={handleCreateSelection}
              disabled={!newSelectionName.trim() || creating}
            >
              {creating ? (
                <>
                  <Loader size="sm" className="[background:white] shrink-0 mr-2" />
                  {language === "en" ? "Creating..." : "Création..."}
                </>
              ) : language === "en" ? (
                "Create"
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!archiveTargetId}
        onOpenChange={(open) => !open && setArchiveTargetId(null)}
        title={language === "en" ? "Archive selection?" : "Archiver la sélection ?"}
        description={
          language === "en"
            ? "This hides the draft from your active list. Applications stay in the system and keep their status (pending, approved, etc.). This does not delete anything."
            : "Le brouillon sera masqué de la liste active. Les candidatures restent dans le système avec leur statut. Rien n'est supprimé."
        }
        confirmLabel={language === "en" ? "Archive" : "Archiver"}
        cancelLabel={language === "en" ? "Cancel" : "Annuler"}
        onConfirm={handleArchive}
        confirmLoading={archiving}
        closeOnConfirm={false}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && !removing && setRemoveTarget(null)}
        title={language === "en" ? "Remove from draft?" : "Retirer du brouillon ?"}
        description={
          removeTarget
            ? language === "en"
              ? `${removeTarget.full_name} will be removed from this draft only. Their application status stays unchanged.`
              : `${removeTarget.full_name} sera retiré(e) de ce brouillon uniquement. Le statut de la candidature reste inchangé.`
            : undefined
        }
        confirmLabel={language === "en" ? "Remove" : "Retirer"}
        cancelLabel={language === "en" ? "Cancel" : "Annuler"}
        variant="danger"
        confirmLoading={removing}
        closeOnConfirm={false}
        onConfirm={async () => {
          if (!removeTarget) return;
          setRemoving(true);
          try {
            await handleRemoveFromSelection(removeTarget);
            setRemoveTarget(null);
          } finally {
            setRemoving(false);
          }
        }}
      />

      <AdminApplicationBulkActionConfirm
        open={isBulkConfirmOpen}
        onOpenChange={(nextOpen) => {
          setIsBulkConfirmOpen(nextOpen);
          if (!nextOpen && !bulkProcessing) {
            window.setTimeout(() => setBulkAction(null), ADMIN_APPLICATION_BULK_CONFIRM_CLOSE_MS);
          }
        }}
        action={isBulkConfirmOpen ? bulkAction : null}
        applications={isBulkConfirmOpen ? bulkConfirmApps : []}
        language={language}
        draftName={selectedSelection?.name}
        onConfirm={handleBulkConfirm}
        isSubmitting={bulkProcessing}
      />

    </div>
  );
}

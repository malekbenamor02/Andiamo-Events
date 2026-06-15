/**
 * Draft selections panel: list selections, open one, review applications with shared list UI.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Archive, Download, FolderOpen, Plus, User } from "lucide-react";
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
import { filterAmbassadorApplications } from "../../lib/filterApplications";
import { exportDraftSelectionToExcel } from "../../lib/exportAmbassadorApplicationsExcel";
import { ApplicationsListCore } from "./ApplicationsListCore";
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
  onCopyCredentials,
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
          <h3 className="text-lg font-semibold text-primary">
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
            onCopyCredentials={onCopyCredentials}
            processingId={processingId}
            orphanedCount={0}
            title={selectedSelection.name}
            countLabel={language === "en" ? "in selection" : "dans la sélection"}
            showExport={false}
            showOrphanCleanup={false}
            showAddedByColumn
            selectionItemMeta={selectionItemMeta}
            onRemoveFromSelection={handleRemoveFromSelection}
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

    </div>
  );
}

/**
 * Admin Dashboard — Ambassador Applications tab.
 * All Applications (with add-to-draft) + Draft Selections sub-view.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Ambassador, AmbassadorApplication, SelectedMotivation } from "../types";
import { useApplicationSelections } from "../hooks/useApplicationSelections";
import { ApplicationsListCore } from "./applications/ApplicationsListCore";
import { ApplicationSelectionsPanel } from "./applications/ApplicationSelectionsPanel";
import { PickSelectionDialog } from "./applications/PickSelectionDialog";
import {
  AnimatedUnderlineButtonNav,
  ADMIN_UNDERLINE_BUTTON_CLASS,
} from "./AnimatedUnderlineTabs";

export interface ApplicationsTabTranslation {
  approve: string;
  reject: string;
  processing: string;
  pending: string;
  approved: string;
  rejected: string;
  noApplications: string;
}

export interface ApplicationsTabProps {
  language: "en" | "fr";
  t: ApplicationsTabTranslation;
  filteredApplications: AmbassadorApplication[];
  applications: AmbassadorApplication[];
  ambassadors: Ambassador[];
  applicationSearchTerm: string;
  setApplicationSearchTerm: (v: string) => void;
  applicationStatusFilter: string;
  setApplicationStatusFilter: (v: string) => void;
  applicationCityFilter: string;
  setApplicationCityFilter: (v: string) => void;
  applicationVilleFilter: string;
  setApplicationVilleFilter: (v: string) => void;
  applicationDateFrom: Date | undefined;
  setApplicationDateFrom: (v: Date | undefined) => void;
  applicationDateTo: Date | undefined;
  setApplicationDateTo: (v: Date | undefined) => void;
  emailStatus: Record<string, "sent" | "failed" | "pending">;
  emailFailedApplications: Set<string>;
  selectedMotivation: SelectedMotivation | null;
  setSelectedMotivation: (v: SelectedMotivation | null) => void;
  isMotivationDialogOpen: boolean;
  setIsMotivationDialogOpen: (v: boolean) => void;
  getStatusBadge: (status: string) => ReactNode;
  onExportExcel: () => Promise<void>;
  onCleanupOrphaned: () => void;
  onApprove: (app: AmbassadorApplication) => void;
  onReject: (app: AmbassadorApplication) => void;
  onResendEmail: (app: AmbassadorApplication) => void;
  processingId: string | null;
  orphanedCount: number;
  currentAdminId: string | null;
  currentAdminName: string | null;
  currentAdminEmail: string | null;
  ambassadorMap: Map<string, { ville?: string }>;
}

type ApplicationsViewMode = "all" | "selections";

export function ApplicationsTab(props: ApplicationsTabProps) {
  const {
    language,
    applications,
    currentAdminId,
    currentAdminName,
    currentAdminEmail,
  } = props;
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ApplicationsViewMode>("all");
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [addToDraftIds, setAddToDraftIds] = useState<string[] | null>(null);

  const selectionsApi = useApplicationSelections();
  const { fetchSelections, selections, loadingSelections, addApplicationsToSelection, createSelection } =
    selectionsApi;

  const adminDisplayName =
    (currentAdminName && currentAdminName.trim()) ||
    (currentAdminEmail && currentAdminEmail.trim()) ||
    null;

  useEffect(() => {
    fetchSelections().catch(console.error);
  }, [fetchSelections]);

  const openAddToDraft = useCallback((apps: AmbassadorApplication[]) => {
    const pendingIds = apps.filter((a) => a.status === "pending").map((a) => a.id);
    if (pendingIds.length === 0) {
      toast({
        title: language === "en" ? "Nothing to add" : "Rien à ajouter",
        description:
          language === "en"
            ? "Only pending applications can be added to a draft."
            : "Seules les candidatures en attente peuvent être ajoutées.",
        variant: "destructive",
      });
      return;
    }
    if (selections.length > 0) {
      fetchSelections({ silent: true }).catch(console.error);
    }
    setAddToDraftIds(pendingIds);
  }, [language, toast, selections.length, fetchSelections]);

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

  const bulkAddApps = useMemo(
    () => applications.filter((a) => bulkSelectedIds.has(a.id)),
    [applications, bulkSelectedIds],
  );

  const handlePickSelectionConfirm = async (selectionId: string) => {
    if (!addToDraftIds?.length) return;
    const result = await addApplicationsToSelection({
      selectionId,
      applicationIds: addToDraftIds,
    });

    const { added, skipped } = result;
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      addToDraftIds.forEach((id) => next.delete(id));
      return next;
    });
    setAddToDraftIds(null);

    let description =
      language === "en"
        ? `${added} application${added === 1 ? "" : "s"} added to draft.`
        : `${added} candidature${added === 1 ? "" : "s"} ajoutée(s).`;
    if (skipped > 0) {
      description +=
        language === "en"
          ? ` ${skipped} already in this draft.`
          : ` ${skipped} déjà dans ce brouillon.`;
    }

    toast({
      title: language === "en" ? "Added to draft" : "Ajouté au brouillon",
      description,
    });
  };

  const handleCreateSelectionFromPicker = async (name: string) => {
    return createSelection({ name });
  };

  const bulkToolbar =
    bulkSelectedIds.size > 0 ? (
      <Button
        size="sm"
        variant="outline"
        onClick={() => openAddToDraft(bulkAddApps)}
        className="border-primary/40 text-primary hover:bg-primary/10"
      >
        <FolderPlus className="w-4 h-4 mr-1" />
        {language === "en"
          ? `Add ${bulkSelectedIds.size} to draft`
          : `Ajouter ${bulkSelectedIds.size} au brouillon`}
      </Button>
    ) : null;

  return (
    <TabsContent value="applications" className="space-y-6">
      <AnimatedUnderlineButtonNav activeValue={viewMode}>
        <button
          type="button"
          data-nav-value="all"
          className={ADMIN_UNDERLINE_BUTTON_CLASS(viewMode === "all")}
          onClick={() => setViewMode("all")}
        >
          {language === "en" ? "All applications" : "Toutes les candidatures"}
        </button>
        <button
          type="button"
          data-nav-value="selections"
          className={ADMIN_UNDERLINE_BUTTON_CLASS(viewMode === "selections")}
          onClick={() => setViewMode("selections")}
        >
          {language === "en" ? "Draft selections" : "Sélections brouillon"}
        </button>
      </AnimatedUnderlineButtonNav>

      {viewMode === "all" ? (
        <ApplicationsListCore
          {...props}
          showAddToDraft
          onAddToDraft={(app) => openAddToDraft([app])}
          enableBulkSelect
          bulkSelectedIds={bulkSelectedIds}
          onToggleBulkSelect={handleToggleBulkSelect}
          onToggleAllBulkSelect={handleToggleAllBulkSelect}
          extraToolbar={bulkToolbar}
        />
      ) : (
        <ApplicationSelectionsPanel {...props} selectionsApi={selectionsApi} />
      )}

      <PickSelectionDialog
        open={addToDraftIds !== null}
        onOpenChange={(open) => !open && setAddToDraftIds(null)}
        language={language}
        applicationCount={addToDraftIds?.length ?? 0}
        selections={selections}
        loadingSelections={loadingSelections && selections.length === 0}
        onConfirm={handlePickSelectionConfirm}
        onCreateSelection={handleCreateSelectionFromPicker}
      />
    </TabsContent>
  );
}

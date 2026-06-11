/**
 * Pick a draft selection to add one or more applications into.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import Loader from "@/components/ui/Loader";
import { Plus, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { AmbassadorApplicationSelection } from "../../types";

export interface PickSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "en" | "fr";
  applicationCount: number;
  selections: AmbassadorApplicationSelection[];
  /** True only on first load when no cached drafts exist yet. */
  loadingSelections: boolean;
  onConfirm: (selectionId: string) => Promise<void>;
  onCreateSelection: (name: string) => Promise<AmbassadorApplicationSelection>;
}

export function PickSelectionDialog({
  open,
  onOpenChange,
  language,
  applicationCount,
  selections,
  loadingSelections,
  onConfirm,
  onCreateSelection,
}: PickSelectionDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setSelectedId(null);
      setShowCreate(false);
      setNewName("");
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await onConfirm(selectedId);
      handleOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAndSelect = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await onCreateSelection(name);
      setSelectedId(created.id);
      setShowCreate(false);
      setNewName("");
    } finally {
      setCreating(false);
    }
  };

  const countLabel =
    language === "en"
      ? `${applicationCount} application${applicationCount === 1 ? "" : "s"}`
      : `${applicationCount} candidature${applicationCount === 1 ? "" : "s"}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === "en" ? "Add to draft selection" : "Ajouter à une sélection"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {language === "en"
            ? `Choose a draft for ${countLabel}:`
            : `Choisissez un brouillon pour ${countLabel} :`}
        </p>

        {loadingSelections && selections.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader size="md" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {selections.length === 0 && !showCreate && (
              <p className="text-sm text-muted-foreground py-2">
                {language === "en"
                  ? "No drafts yet. Create one below."
                  : "Aucun brouillon. Créez-en un ci-dessous."}
              </p>
            )}
            {selections.map((selection) => (
              <button
                key={selection.id}
                type="button"
                onClick={() => setSelectedId(selection.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selectedId === selection.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-sm">{selection.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {selection.item_count ?? 0}{" "}
                    {language === "en" ? "apps" : "cand."}
                  </span>
                </div>
                {selection.created_by_name && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    {selection.created_by_name} ·{" "}
                    {format(new Date(selection.created_at), "dd/MM/yyyy")}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {showCreate ? (
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-sm">
              {language === "en" ? "New draft name" : "Nom du brouillon"}
            </Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={language === "en" ? "Selection name..." : "Nom de la sélection..."}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateAndSelect();
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
              >
                {language === "en" ? "Cancel" : "Annuler"}
              </Button>
              <Button
                size="sm"
                onClick={handleCreateAndSelect}
                disabled={!newName.trim() || creating}
              >
                {creating ? (
                  <Loader size="sm" className="[background:white] shrink-0 mr-1" />
                ) : null}
                {language === "en" ? "Create draft" : "Créer"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            {language === "en" ? "Create new draft" : "Créer un nouveau brouillon"}
          </Button>
        )}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">{language === "en" ? "Cancel" : "Annuler"}</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!selectedId || submitting}>
            {submitting ? (
              <>
                <Loader size="sm" className="[background:white] shrink-0 mr-2" />
                {language === "en" ? "Saving..." : "Enregistrement..."}
              </>
            ) : language === "en" ? (
              "Save"
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

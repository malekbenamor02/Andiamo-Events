/**
 * Admin Dashboard — Sponsors tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import FileUpload from "@/components/ui/file-upload";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import type { Sponsor } from "../types";
import {
  AdminTabHeader,
  AdminTabEmpty,
  AdminTabCard,
  AdminTabCardGrid,
  ADMIN_BTN_EDIT,
  ADMIN_BTN_DELETE,
} from "./AdminTabShell";

export interface SponsorsTabProps {
  sponsors: Sponsor[];
  editingSponsor: Sponsor | null;
  setEditingSponsor: (v: Sponsor | null) => void;
  isSponsorDialogOpen: boolean;
  setIsSponsorDialogOpen: (v: boolean) => void;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (v: boolean) => void;
  onOpenAdd: () => void;
  onOpenEdit: (sponsor: Sponsor) => void;
  onOpenDelete: (sponsor: Sponsor) => void;
  onSave: (e: React.FormEvent) => void;
  onCloseAddEdit: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}

export function SponsorsTab({
  sponsors,
  editingSponsor,
  setEditingSponsor,
  isSponsorDialogOpen,
  setIsSponsorDialogOpen,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  onOpenAdd,
  onOpenEdit,
  onOpenDelete,
  onSave,
  onCloseAddEdit,
  onCloseDelete,
  onConfirmDelete,
}: SponsorsTabProps) {
  return (
    <TabsContent value="sponsors" className="space-y-6">
      <AdminTabHeader
        title="Sponsors"
        subtitle={
          sponsors.length > 0
            ? `${sponsors.length} sponsor${sponsors.length === 1 ? "" : "s"}`
            : undefined
        }
        actions={
          <Button size="sm" onClick={onOpenAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Sponsor
          </Button>
        }
      />

      {sponsors.length > 0 ? (
        <AdminTabCardGrid>
          {sponsors.map((sponsor) => (
            <AdminTabCard
              key={sponsor.id}
              className="items-center text-center"
            >
              {sponsor.logo_url && (
                <img
                  src={sponsor.logo_url}
                  alt={sponsor.name}
                  className="mb-3 h-20 w-32 rounded-lg object-contain"
                />
              )}
              <h3 className="font-semibold">{sponsor.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {sponsor.description || sponsor.category}
              </p>
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/5 text-primary"
                >
                  Global
                </Badge>
              </div>
              <div className="mt-3 flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenEdit(sponsor)}
                  className={ADMIN_BTN_EDIT}
                >
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenDelete(sponsor)}
                  className={ADMIN_BTN_DELETE}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </AdminTabCard>
          ))}
        </AdminTabCardGrid>
      ) : (
        <AdminTabEmpty
          message="No sponsors found"
          hint="Add your first sponsor to get started."
        />
      )}

      <Dialog open={isSponsorDialogOpen} onOpenChange={setIsSponsorDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSponsor?.id ? "Edit Sponsor" : "Add Sponsor"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sponsorName">Name</Label>
                <Input
                  id="sponsorName"
                  value={editingSponsor?.name ?? ""}
                  onChange={(e) =>
                    setEditingSponsor((prev) =>
                      prev ? { ...prev, name: e.target.value } : null
                    )
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="sponsorDescription">Description</Label>
                <Textarea
                  id="sponsorDescription"
                  value={editingSponsor?.description ?? ""}
                  onChange={(e) =>
                    setEditingSponsor((prev) =>
                      prev ? { ...prev, description: e.target.value } : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="sponsorWebsite">Website URL</Label>
                <Input
                  id="sponsorWebsite"
                  type="url"
                  value={editingSponsor?.website_url ?? ""}
                  onChange={(e) =>
                    setEditingSponsor((prev) =>
                      prev ? { ...prev, website_url: e.target.value } : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="sponsorCategory">Category</Label>
                <Input
                  id="sponsorCategory"
                  value={editingSponsor?.category ?? ""}
                  onChange={(e) =>
                    setEditingSponsor((prev) =>
                      prev ? { ...prev, category: e.target.value } : null
                    )
                  }
                />
              </div>
              <div>
                <Label>Logo</Label>
                <FileUpload
                  onFileSelect={(file) =>
                    setEditingSponsor((prev) =>
                      prev ? { ...prev, _uploadFile: file } : null
                    )
                  }
                  onUrlChange={(url) =>
                    setEditingSponsor((prev) =>
                      prev ? { ...prev, logo_url: url } : null
                    )
                  }
                  currentUrl={editingSponsor?.logo_url}
                  accept="image/*"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCloseAddEdit}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sponsor</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this sponsor?</p>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onCloseDelete}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={onConfirmDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

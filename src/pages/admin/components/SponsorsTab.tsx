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

export interface SponsorsTabProps {
  sponsors: Sponsor[];
  animatedSponsors: Set<string>;
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
  animatedSponsors,
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
      <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
        <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
          Sponsors
        </h2>
        <Button
          variant="default"
          onClick={onOpenAdd}
          className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
        >
          <Plus className="w-4 h-4 mr-2 animate-pulse" />
          Add Sponsor
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sponsors.map((sponsor) => (
          <div
            key={sponsor.id}
            className={`rounded-xl bg-card p-6 shadow-lg flex flex-col items-center justify-center transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
              animatedSponsors.has(sponsor.id ?? "")
                ? "animate-in slide-in-from-bottom-4 fade-in duration-700"
                : "opacity-0 translate-y-8"
            }`}
          >
            {sponsor.logo_url && (
              <div className="animate-in zoom-in-95 duration-500 delay-200">
                <img
                  src={sponsor.logo_url}
                  alt={sponsor.name}
                  className="w-32 h-20 object-contain mb-3 rounded-lg transform transition-transform duration-300 hover:scale-110"
                />
              </div>
            )}
            <h3 className="font-semibold mb-1 animate-in slide-in-from-left-4 duration-500 delay-300">
              {sponsor.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-2 animate-in slide-in-from-left-4 duration-500 delay-400">
              {sponsor.description || sponsor.category}
            </p>
            <div className="flex gap-2 mb-2 animate-in slide-in-from-bottom-4 duration-500 delay-500">
              <Badge className="bg-primary text-white animate-pulse">
                Global
              </Badge>
            </div>
            <div className="flex gap-2 mt-2 animate-in slide-in-from-bottom-4 duration-500 delay-600">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenEdit(sponsor)}
                className="transform hover:scale-105 transition-all duration-300"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onOpenDelete(sponsor)}
                className="transform hover:scale-105 transition-all duration-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      {sponsors.length === 0 && (
        <div className="text-center py-8 animate-in fade-in duration-500">
          <p className="text-muted-foreground animate-pulse">
            No sponsors found
          </p>
        </div>
      )}

      <Dialog open={isSponsorDialogOpen} onOpenChange={setIsSponsorDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
          <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
            <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
              {editingSponsor?.id ? "Edit Sponsor" : "Add Sponsor"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="animate-in slide-in-from-bottom-4 duration-700 delay-300">
            <div className="space-y-4">
              <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
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
                  className="transition-all duration-300 focus:scale-105"
                />
              </div>
              <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                <Label htmlFor="sponsorDescription">Description</Label>
                <Textarea
                  id="sponsorDescription"
                  value={editingSponsor?.description ?? ""}
                  onChange={(e) =>
                    setEditingSponsor((prev) =>
                      prev ? { ...prev, description: e.target.value } : null
                    )
                  }
                  className="transition-all duration-300 focus:scale-105"
                />
              </div>
              <div className="animate-in slide-in-from-left-4 duration-500 delay-600">
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
                  className="transition-all duration-300 focus:scale-105"
                />
              </div>
              <div className="animate-in slide-in-from-right-4 duration-500 delay-700">
                <Label htmlFor="sponsorCategory">Category</Label>
                <Input
                  id="sponsorCategory"
                  value={editingSponsor?.category ?? ""}
                  onChange={(e) =>
                    setEditingSponsor((prev) =>
                      prev ? { ...prev, category: e.target.value } : null
                    )
                  }
                  className="transition-all duration-300 focus:scale-105"
                />
              </div>
              <div className="animate-in slide-in-from-left-4 duration-500 delay-800">
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
            <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-900">
              <Button
                type="button"
                variant="outline"
                onClick={onCloseAddEdit}
                className="transform hover:scale-105 transition-all duration-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="transform hover:scale-105 transition-all duration-300"
              >
                <Save className="w-4 h-4 mr-2 animate-pulse" />
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="animate-in zoom-in-95 duration-300">
          <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
            <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
              Delete Sponsor
            </DialogTitle>
          </DialogHeader>
          <p className="animate-in slide-in-from-bottom-4 duration-500 delay-300">
            Are you sure you want to delete this sponsor?
          </p>
          <div className="flex justify-end gap-2 mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-500">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                onClick={onCloseDelete}
                className="transform hover:scale-105 transition-all duration-300"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
              className="transform hover:scale-105 transition-all duration-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

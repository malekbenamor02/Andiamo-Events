/**
 * Admin Dashboard — Team Members tab.
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
import { Plus, Edit, Trash2, Save, Upload } from "lucide-react";
import type { TeamMember } from "../types";

export interface TeamTabProps {
  teamMembers: TeamMember[];
  animatedTeamMembers: Set<string>;
  editingTeamMember: TeamMember | null;
  setEditingTeamMember: (v: TeamMember | null) => void;
  isTeamDialogOpen: boolean;
  setIsTeamDialogOpen: (v: boolean) => void;
  isDeleteTeamDialogOpen: boolean;
  setIsDeleteTeamDialogOpen: (v: boolean) => void;
  onOpenAdd: () => void;
  onOpenEdit: (member: TeamMember) => void;
  onOpenDelete: (member: TeamMember) => void;
  onSave: (e: React.FormEvent) => void;
  onCloseAddEdit: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}

export function TeamTab({
  teamMembers,
  animatedTeamMembers,
  editingTeamMember,
  setEditingTeamMember,
  isTeamDialogOpen,
  setIsTeamDialogOpen,
  isDeleteTeamDialogOpen,
  setIsDeleteTeamDialogOpen,
  onOpenAdd,
  onOpenEdit,
  onOpenDelete,
  onSave,
  onCloseAddEdit,
  onCloseDelete,
  onConfirmDelete,
}: TeamTabProps) {
  return (
    <TabsContent value="team" className="space-y-6">
      <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
        <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
          Team Members
        </h2>
        <Button
          variant="default"
          onClick={onOpenAdd}
          className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
        >
          <Plus className="w-4 h-4 mr-2 animate-pulse" />
          Add Team Member
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full px-2">
        {teamMembers.map((member) => (
          <div
            key={member.id}
            className={`rounded-xl bg-card p-6 shadow-lg flex flex-col items-center justify-center transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
              animatedTeamMembers.has(member.id ?? "")
                ? "animate-in slide-in-from-bottom-4 fade-in duration-700"
                : "opacity-0 translate-y-8"
            }`}
          >
            {member.photo_url && (
              <div className="animate-in zoom-in-95 duration-500 delay-200">
                <img
                  src={member.photo_url}
                  alt={member.name}
                  className="w-24 h-24 object-cover mb-3 rounded-full transform transition-transform duration-300 hover:scale-110"
                />
              </div>
            )}
            <h3 className="font-semibold mb-1 animate-in slide-in-from-left-4 duration-500 delay-300">
              {member.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-1 animate-in slide-in-from-left-4 duration-500 delay-400">
              {member.role}
            </p>
            {member.bio && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2 animate-in slide-in-from-left-4 duration-500 delay-500">
                {member.bio}
              </p>
            )}
            {member.social_url && (
              <div className="animate-in slide-in-from-bottom-4 duration-500 delay-600">
                <a
                  href={member.social_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs mb-2 transform hover:scale-105 transition-all duration-300"
                >
                  Social
                </a>
              </div>
            )}
            <div className="flex gap-2 mt-2 animate-in slide-in-from-bottom-4 duration-500 delay-700">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenEdit(member)}
                className="transform hover:scale-105 transition-all duration-300"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onOpenDelete(member)}
                className="transform hover:scale-105 transition-all duration-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      {teamMembers.length === 0 && (
        <div className="text-center py-8 animate-in fade-in duration-500">
          <p className="text-muted-foreground animate-pulse">
            No team members found
          </p>
        </div>
      )}

      <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
          <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
            <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
              {editingTeamMember?.id
                ? "Edit Team Member"
                : "Add Team Member"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="animate-in slide-in-from-bottom-4 duration-700 delay-300">
            <div className="space-y-4">
              <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                <Label htmlFor="memberName">Name</Label>
                <Input
                  id="memberName"
                  value={editingTeamMember?.name ?? ""}
                  onChange={(e) =>
                    setEditingTeamMember((prev) =>
                      prev ? { ...prev, name: e.target.value } : null
                    )
                  }
                  required
                  className="transition-all duration-300 focus:scale-105"
                />
              </div>
              <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                <Label htmlFor="memberRole">Role</Label>
                <Input
                  id="memberRole"
                  value={editingTeamMember?.role ?? ""}
                  onChange={(e) =>
                    setEditingTeamMember((prev) =>
                      prev ? { ...prev, role: e.target.value } : null
                    )
                  }
                  required
                  className="transition-all duration-300 focus:scale-105"
                />
              </div>
              <div className="animate-in slide-in-from-left-4 duration-500 delay-600">
                <Label htmlFor="memberBio">Bio</Label>
                <Textarea
                  id="memberBio"
                  value={editingTeamMember?.bio ?? ""}
                  onChange={(e) =>
                    setEditingTeamMember((prev) =>
                      prev ? { ...prev, bio: e.target.value } : null
                    )
                  }
                  className="transition-all duration-300 focus:scale-105"
                />
              </div>
              <div className="animate-in slide-in-from-right-4 duration-500 delay-700">
                <Label htmlFor="memberPhoto">Photo</Label>
                <div className="space-y-2">
                  {editingTeamMember?.photo_url && (
                    <div className="animate-in zoom-in-95 duration-300">
                      <img
                        src={editingTeamMember.photo_url}
                        alt="Current photo"
                        className="w-20 h-20 object-cover rounded-lg border-2 border-border"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      id="memberPhoto"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setEditingTeamMember((prev) =>
                              prev ? { ...prev, photo_url: result } : null
                            );
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="transition-all duration-300 focus:scale-105"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById(
                          "memberPhoto"
                        ) as HTMLInputElement;
                        input?.click();
                      }}
                      className="transform hover:scale-105 transition-all duration-300"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                </div>
              </div>
              <div className="animate-in slide-in-from-left-4 duration-500 delay-800">
                <Label htmlFor="memberSocial">Social URL</Label>
                <Input
                  id="memberSocial"
                  type="url"
                  value={editingTeamMember?.social_url ?? ""}
                  onChange={(e) =>
                    setEditingTeamMember((prev) =>
                      prev ? { ...prev, social_url: e.target.value } : null
                    )
                  }
                  className="transition-all duration-300 focus:scale-105"
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

      <Dialog
        open={isDeleteTeamDialogOpen}
        onOpenChange={setIsDeleteTeamDialogOpen}
      >
        <DialogContent className="animate-in zoom-in-95 duration-300">
          <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
            <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
              Delete Team Member
            </DialogTitle>
          </DialogHeader>
          <p className="animate-in slide-in-from-bottom-4 duration-500 delay-300">
            Are you sure you want to delete this team member?
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

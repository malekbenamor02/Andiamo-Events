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
import {
  AdminTabHeader,
  AdminTabEmpty,
  AdminTabCard,
  AdminTabCardGrid,
  ADMIN_BTN_EDIT,
  ADMIN_BTN_DELETE,
} from "./AdminTabShell";

export interface TeamTabProps {
  teamMembers: TeamMember[];
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
      <AdminTabHeader
        title="Team Members"
        subtitle={
          teamMembers.length > 0
            ? `${teamMembers.length} member${teamMembers.length === 1 ? "" : "s"}`
            : undefined
        }
        actions={
          <Button size="sm" onClick={onOpenAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Team Member
          </Button>
        }
      />

      {teamMembers.length > 0 ? (
        <AdminTabCardGrid>
          {teamMembers.map((member) => (
            <AdminTabCard
              key={member.id}
              className="items-center text-center"
            >
              {member.photo_url && (
                <img
                  src={member.photo_url}
                  alt={member.name}
                  className="mb-3 h-24 w-24 rounded-full object-cover"
                />
              )}
              <h3 className="font-semibold">{member.name}</h3>
              <p className="text-xs text-muted-foreground">{member.role}</p>
              {member.bio && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {member.bio}
                </p>
              )}
              {member.social_url && (
                <a
                  href={member.social_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-xs text-primary hover:underline"
                >
                  Social
                </a>
              )}
              <div className="mt-3 flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenEdit(member)}
                  className={ADMIN_BTN_EDIT}
                >
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenDelete(member)}
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
          message="No team members found"
          hint="Add your first team member to get started."
        />
      )}

      <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTeamMember?.id
                ? "Edit Team Member"
                : "Add Team Member"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave}>
            <div className="space-y-4">
              <div>
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
                />
              </div>
              <div>
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
                />
              </div>
              <div>
                <Label htmlFor="memberBio">Bio</Label>
                <Textarea
                  id="memberBio"
                  value={editingTeamMember?.bio ?? ""}
                  onChange={(e) =>
                    setEditingTeamMember((prev) =>
                      prev ? { ...prev, bio: e.target.value } : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="memberPhoto">Photo</Label>
                <div className="space-y-2">
                  {editingTeamMember?.photo_url && (
                    <img
                      src={editingTeamMember.photo_url}
                      alt="Current photo"
                      className="h-20 w-20 rounded-lg border border-border/60 object-cover"
                    />
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
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                  </div>
                </div>
              </div>
              <div>
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

      <Dialog
        open={isDeleteTeamDialogOpen}
        onOpenChange={setIsDeleteTeamDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team Member</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this team member?</p>
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

/**
 * Admin Dashboard — Admins Management tab (super_admin only).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Save, History } from "lucide-react";
import { format } from "date-fns";
import type { AdminUser, EditingAdminShape } from "../types";
import {
  AdminTabHeader,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_ROW,
  ADMIN_TABLE_WRAP,
  ADMIN_BTN_EDIT,
  ADMIN_BTN_DELETE,
} from "./AdminTabShell";

export interface AdminsTabProps {
  language: "en" | "fr";
  admins: AdminUser[];
  newAdminData: { name: string; email: string; phone: string };
  setNewAdminData: (data: { name: string; email: string; phone: string }) => void;
  isAddAdminDialogOpen: boolean;
  setIsAddAdminDialogOpen: (open: boolean) => void;
  isEditAdminDialogOpen: boolean;
  setIsEditAdminDialogOpen: (open: boolean) => void;
  editingAdmin: EditingAdminShape | null;
  setEditingAdmin: (admin: EditingAdminShape | null) => void;
  processingId: string | null;
  currentAdminId: string | null;
  adminLogs: any[];
  loadingAdminLogs: boolean;
  onAddAdmin: () => Promise<void>;
  onEditAdmin: () => Promise<void>;
  onDeleteAdmin: (adminId: string) => void;
}

export function AdminsTab({
  language,
  admins,
  newAdminData,
  setNewAdminData,
  isAddAdminDialogOpen,
  setIsAddAdminDialogOpen,
  isEditAdminDialogOpen,
  setIsEditAdminDialogOpen,
  editingAdmin,
  setEditingAdmin,
  processingId,
  currentAdminId,
  adminLogs,
  loadingAdminLogs,
  onAddAdmin,
  onEditAdmin,
  onDeleteAdmin,
}: AdminsTabProps) {
  return (
    <div className="space-y-6">
      <AdminTabHeader
        title={language === "en" ? "Admin Management" : "Gestion des Administrateurs"}
        actions={
          <Dialog open={isAddAdminDialogOpen} onOpenChange={setIsAddAdminDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setNewAdminData({ name: "", email: "", phone: "" });
                  setIsAddAdminDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {language === "en" ? "Add Admin" : "Ajouter un Admin"}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl animate-in zoom-in-95 duration-300">
            <DialogHeader>
              <DialogTitle>
                {language === "en" ? "Add New Admin" : "Ajouter un Nouvel Admin"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="adminName">{language === "en" ? "Name" : "Nom"}</Label>
                <Input
                  id="adminName"
                  value={newAdminData.name}
                  onChange={(e) => setNewAdminData({ ...newAdminData, name: e.target.value })}
                  placeholder={language === "en" ? "Enter admin name" : "Entrez le nom de l'admin"}
                  required
                />
              </div>
              <div>
                <Label htmlFor="adminEmail">{language === "en" ? "Email" : "Email"}</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={newAdminData.email}
                  onChange={(e) => setNewAdminData({ ...newAdminData, email: e.target.value })}
                  placeholder={language === "en" ? "Enter admin email" : "Entrez l'email de l'admin"}
                  required
                />
              </div>
              <div>
                <Label htmlFor="adminPhone">
                  {language === "en" ? "Phone Number" : "Numéro de Téléphone"}
                </Label>
                <Input
                  id="adminPhone"
                  type="tel"
                  value={newAdminData.phone}
                  onChange={(e) => setNewAdminData({ ...newAdminData, phone: e.target.value })}
                  placeholder={
                    language === "en"
                      ? "Enter phone number (optional)"
                      : "Entrez le numéro de téléphone (optionnel)"
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsAddAdminDialogOpen(false)}>
                  {language === "en" ? "Cancel" : "Annuler"}
                </Button>
                <Button onClick={onAddAdmin} disabled={processingId === "new-admin"}>
                  {processingId === "new-admin" ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      {language === "en" ? "Creating..." : "Création..."}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      {language === "en" ? "Create Admin" : "Créer l'Admin"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        }
      />

      {/* Edit Admin Dialog */}
      <Dialog open={isEditAdminDialogOpen} onOpenChange={setIsEditAdminDialogOpen}>
        <DialogContent className="max-w-2xl animate-in zoom-in-95 duration-300">
          <DialogHeader>
            <DialogTitle>
              {language === "en" ? "Edit Admin" : "Modifier l'Admin"}
            </DialogTitle>
          </DialogHeader>
          {editingAdmin && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editAdminName">{language === "en" ? "Name" : "Nom"}</Label>
                <Input
                  id="editAdminName"
                  value={editingAdmin.name}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, name: e.target.value })}
                  placeholder={language === "en" ? "Enter admin name" : "Entrez le nom de l'admin"}
                  required
                />
              </div>
              <div>
                <Label htmlFor="editAdminEmail">{language === "en" ? "Email" : "Email"}</Label>
                <Input
                  id="editAdminEmail"
                  type="email"
                  value={editingAdmin.email}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, email: e.target.value })}
                  placeholder={language === "en" ? "Enter admin email" : "Entrez l'email de l'admin"}
                  required
                />
              </div>
              <div>
                <Label htmlFor="editAdminPhone">
                  {language === "en" ? "Phone Number" : "Numéro de Téléphone"}
                </Label>
                <Input
                  id="editAdminPhone"
                  type="tel"
                  value={editingAdmin.phone || ""}
                  onChange={(e) =>
                    setEditingAdmin({ ...editingAdmin, phone: e.target.value })
                  }
                  placeholder={
                    language === "en"
                      ? "Enter phone number (optional)"
                      : "Entrez le numéro de téléphone (optionnel)"
                  }
                />
              </div>
              <div>
                <Label htmlFor="editAdminRole">{language === "en" ? "Role" : "Rôle"}</Label>
                <Select
                  value={editingAdmin.role}
                  onValueChange={(value: "admin" | "super_admin") =>
                    setEditingAdmin({ ...editingAdmin, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      {language === "en" ? "Admin" : "Admin"}
                    </SelectItem>
                    <SelectItem value="super_admin">
                      {language === "en" ? "Super Admin" : "Super Admin"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editAdminActive"
                  checked={editingAdmin.is_active}
                  onChange={(e) =>
                    setEditingAdmin({ ...editingAdmin, is_active: e.target.checked })
                  }
                />
                <Label htmlFor="editAdminActive">
                  {language === "en" ? "Active" : "Actif"}
                </Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingAdmin(null);
                    setIsEditAdminDialogOpen(false);
                  }}
                >
                  {language === "en" ? "Cancel" : "Annuler"}
                </Button>
                <Button
                  onClick={onEditAdmin}
                  disabled={processingId === `edit-admin-${editingAdmin.id}`}
                >
                  {processingId === `edit-admin-${editingAdmin.id}` ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      {language === "en" ? "Saving..." : "Enregistrement..."}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {language === "en" ? "Save Changes" : "Enregistrer les Modifications"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">
          {language === "en" ? "All Admins" : "Tous les Admins"}
        </h3>
        <div className={ADMIN_TABLE_WRAP}>
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className={ADMIN_TABLE_HEAD}>
                  {language === "en" ? "Name" : "Nom"}
                </TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>
                  {language === "en" ? "Email" : "Email"}
                </TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>
                  {language === "en" ? "Phone" : "Téléphone"}
                </TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>
                  {language === "en" ? "Role" : "Rôle"}
                </TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>
                  {language === "en" ? "Status" : "Statut"}
                </TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>
                  {language === "en" ? "Created" : "Créé"}
                </TableHead>
                <TableHead className={ADMIN_TABLE_HEAD}>
                  {language === "en" ? "Actions" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id} className={ADMIN_TABLE_ROW}>
                  <TableCell className="font-medium">{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{admin.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={admin.role === "super_admin" ? "default" : "secondary"}>
                      {admin.role === "super_admin"
                        ? language === "en"
                          ? "Super Admin"
                          : "Super Admin"
                        : language === "en"
                          ? "Admin"
                          : "Admin"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.is_active ? "default" : "destructive"}>
                      {admin.is_active
                        ? language === "en"
                          ? "Active"
                          : "Actif"
                        : language === "en"
                          ? "Inactive"
                          : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(admin.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingAdmin({
                            id: admin.id,
                            name: admin.name,
                            email: admin.email,
                            phone: admin.phone,
                            role: admin.role,
                            is_active: admin.is_active,
                          });
                          setIsEditAdminDialogOpen(true);
                        }}
                        disabled={processingId === `edit-admin-${admin.id}`}
                        className={ADMIN_BTN_EDIT}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        {processingId === `edit-admin-${admin.id}`
                          ? language === "en"
                            ? "Saving..."
                            : "Enregistrement..."
                          : language === "en"
                            ? "Edit"
                            : "Modifier"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDeleteAdmin(admin.id)}
                        disabled={
                          processingId === `delete-admin-${admin.id}` || admin.id === currentAdminId
                        }
                        className={ADMIN_BTN_DELETE}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {processingId === `delete-admin-${admin.id}`
                          ? language === "en"
                            ? "Deleting..."
                            : "Suppression..."
                          : language === "en"
                            ? "Delete"
                            : "Supprimer"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {admins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === "en" ? "No admins found" : "Aucun admin trouvé"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            {language === "en" ? "Activity Logs" : "Journaux d'activité"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAdminLogs ? (
            <p className="text-muted-foreground text-sm py-4">
              {language === "en" ? "Loading…" : "Chargement…"}
            </p>
          ) : adminLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              {language === "en" ? "No activity yet." : "Aucune activité pour l'instant."}
            </p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "en" ? "Date" : "Date"}</TableHead>
                    <TableHead>{language === "en" ? "Admin" : "Admin"}</TableHead>
                    <TableHead>{language === "en" ? "Action" : "Action"}</TableHead>
                    <TableHead>{language === "en" ? "Target" : "Cible"}</TableHead>
                    <TableHead>{language === "en" ? "Details" : "Détails"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {log.created_at ? format(new Date(log.created_at), "PPp") : "-"}
                      </TableCell>
                      <TableCell className="font-medium">{log.admin_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.target_type && log.target_id
                          ? `${log.target_type} (${String(log.target_id).slice(0, 8)}…)`
                          : "-"}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground text-xs max-w-[180px] truncate"
                        title={log.details ? JSON.stringify(log.details) : ""}
                      >
                        {log.details ? JSON.stringify(log.details) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

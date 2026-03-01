/**
 * Admin Dashboard — Ambassador info dialog (view ambassador details from order).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Phone, Mail, MapPin } from "lucide-react";

export interface AmbassadorInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ambassador: {
    full_name?: string;
    phone?: string;
    email?: string;
    city?: string;
    ville?: string;
  } | null;
  language: "en" | "fr";
}

export function AmbassadorInfoDialog({
  open,
  onOpenChange,
  ambassador,
  language,
}: AmbassadorInfoDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            {language === "en" ? "Ambassador Information" : "Informations Ambassadeur"}
          </DialogTitle>
        </DialogHeader>
        {ambassador && (
          <div className="space-y-6">
            {/* Contact Information */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  {language === "en" ? "Contact Information" : "Informations de Contact"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {language === "en" ? "Full Name" : "Nom Complet"}
                    </Label>
                    <p className="text-sm font-semibold">{ambassador.full_name}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {language === "en" ? "Phone" : "Téléphone"}
                    </Label>
                    <p className="text-sm font-mono">{ambassador.phone}</p>
                  </div>
                  {ambassador.email && (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {language === "en" ? "Email" : "Email"}
                      </Label>
                      <p className="text-sm break-all">{ambassador.email}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {language === "en" ? "Location" : "Localisation"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {language === "en" ? "City" : "Ville"}
                    </Label>
                    <p className="text-sm font-semibold">{ambassador.city}</p>
                  </div>
                  {ambassador.ville && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {language === "en" ? "Neighborhood" : "Quartier"}
                      </Label>
                      <p className="text-sm font-semibold">{ambassador.ville}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

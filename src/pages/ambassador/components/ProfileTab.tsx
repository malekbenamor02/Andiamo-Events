/**
 * Ambassador Dashboard — Profile tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit } from "lucide-react";
import type { Ambassador } from "../types";
import type { AmbassadorTranslations } from "../types";

export interface ProfileTabProps {
  t: AmbassadorTranslations;
  ambassador: Ambassador;
  onOpenEditDialog: () => void;
}

export function ProfileTab({ t, ambassador, onOpenEditDialog }: ProfileTabProps) {
  return (
    <Card className="border-border/50 shadow-lg shadow-primary/5">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl font-heading">{t.profile}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">{t.currentPhone}</Label>
            <Input
              value={ambassador.phone}
              disabled
              className="bg-muted/50 border-border/50"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">{t.city}</Label>
            <Input
              value={ambassador.city}
              disabled
              className="bg-muted/50 border-border/50"
            />
          </div>
          {ambassador.ville && (
            <div>
              <Label className="text-sm font-medium mb-2 block">{t.ville}</Label>
              <Input
                value={ambassador.ville}
                disabled
                className="bg-muted/50 border-border/50"
              />
            </div>
          )}
          <Button onClick={onOpenEditDialog} variant="outline" className="w-full sm:w-auto">
            <Edit className="w-4 h-4 mr-2" />
            {t.editProfile}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

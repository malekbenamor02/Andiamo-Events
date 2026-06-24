/**
 * Ambassador Dashboard — Profile tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, MapPin, Phone } from "lucide-react";
import type { Ambassador } from "../types";
import type { AmbassadorTranslations } from "../types";

export interface ProfileTabProps {
  t: AmbassadorTranslations;
  ambassador: Ambassador;
  onOpenEditDialog: () => void;
}

function ProfileField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-sm font-medium text-foreground break-all">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function ProfileTab({ t, ambassador, onOpenEditDialog }: ProfileTabProps) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
        <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">
          {t.profile}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <ProfileField
          label={t.currentPhone}
          value={ambassador.phone}
          icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
        />
        <ProfileField
          label={t.city}
          value={ambassador.city}
          icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
        />
        {ambassador.ville && (
          <ProfileField
            label={t.ville}
            value={ambassador.ville}
            icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
          />
        )}
        <Button onClick={onOpenEditDialog} variant="outline" className="w-full sm:w-auto">
          <Edit className="mr-2 h-4 w-4" aria-hidden />
          {t.editProfile}
        </Button>
      </CardContent>
    </Card>
  );
}

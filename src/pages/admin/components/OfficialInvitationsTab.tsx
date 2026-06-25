/**
 * Admin Dashboard — Official Invitations tab (super_admin only).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { OfficialInvitationForm } from "@/components/admin/OfficialInvitationForm";
import { OfficialInvitationsList } from "@/components/admin/OfficialInvitationsList";
import { AdminTabHeader } from "./AdminTabShell";

export interface OfficialInvitationsTabProps {
  language: "en" | "fr";
  selectedEventId?: string;
}

export function OfficialInvitationsTab({ language, selectedEventId }: OfficialInvitationsTabProps) {
  return (
    <TabsContent value="official-invitations" className="space-y-6">
      <AdminTabHeader
        title={language === "en" ? "Official Invitations" : "Invitations Officielles"}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <OfficialInvitationForm
            dashboardSelectedEventId={selectedEventId}
            onSuccess={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("invitation-created"));
              }
            }}
            language={language}
          />
        </div>
        <div className="lg:col-span-2">
          <OfficialInvitationsList language={language} selectedEventId={selectedEventId} />
        </div>
      </div>
    </TabsContent>
  );
}

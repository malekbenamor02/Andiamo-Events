/**
 * Admin Dashboard — Official Invitations tab (super_admin only).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { OfficialInvitationForm } from "@/components/admin/OfficialInvitationForm";
import { OfficialInvitationsList } from "@/components/admin/OfficialInvitationsList";

export interface OfficialInvitationsTabProps {
  language: "en" | "fr";
}

export function OfficialInvitationsTab({ language }: OfficialInvitationsTabProps) {
  return (
    <TabsContent value="official-invitations" className="space-y-6">
      <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
        <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
          {language === "en" ? "Official Invitations" : "Invitations Officielles"}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <OfficialInvitationForm
            onSuccess={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("invitation-created"));
              }
            }}
            language={language}
          />
        </div>
        <div className="lg:col-span-2">
          <OfficialInvitationsList language={language} />
        </div>
      </div>
    </TabsContent>
  );
}

/**
 * Admin Dashboard — Contact Messages tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, FileText, Mail, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ContactMessage } from "../types";
import {
  AdminTabHeader,
  AdminTabEmpty,
  AdminTabCard,
  ADMIN_FILTERS_PANEL,
  ADMIN_BTN_EDIT,
  ADMIN_BTN_DELETE,
} from "./AdminTabShell";

export interface ContactTabProps {
  filteredContactMessages: ContactMessage[];
  contactMessages: ContactMessage[];
  contactMessageSearchTerm: string;
  setContactMessageSearchTerm: (v: string) => void;
  messageToDelete: ContactMessage | null;
  isDeleteMessageDialogOpen: boolean;
  setIsDeleteMessageDialogOpen: (v: boolean) => void;
  onOpenDelete: (message: ContactMessage) => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}

export function ContactTab({
  filteredContactMessages,
  contactMessages,
  contactMessageSearchTerm,
  setContactMessageSearchTerm,
  messageToDelete,
  isDeleteMessageDialogOpen,
  setIsDeleteMessageDialogOpen,
  onOpenDelete,
  onCloseDelete,
  onConfirmDelete,
}: ContactTabProps) {
  const { toast } = useToast();

  return (
    <>
      <TabsContent value="contact" className="space-y-6">
        <AdminTabHeader
          title="Contact Messages"
          subtitle={`${filteredContactMessages.length} of ${contactMessages.length} messages`}
        />

        <div className={ADMIN_FILTERS_PANEL}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search messages by name, email, subject, or content..."
              value={contactMessageSearchTerm}
              onChange={(e) => setContactMessageSearchTerm(e.target.value)}
              className="border-border/60 bg-background pl-9"
            />
          </div>
        </div>

        {filteredContactMessages.length > 0 ? (
          <div className="space-y-4">
            {filteredContactMessages.map((message) => (
              <AdminTabCard key={message.id}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{message.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {message.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      {new Date(message.created_at).toLocaleDateString()}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="flex items-center text-sm font-medium text-primary">
                    <FileText className="mr-2 h-4 w-4" />
                    Subject: {message.subject}
                  </h4>

                  <div className="rounded-lg border border-border/60 border-l-[3px] border-l-primary bg-muted/20 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.message}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const messageText = `Name: ${message.name}\nEmail: ${message.email}\nSubject: ${message.subject}\nMessage: ${message.message}\nDate: ${new Date(message.created_at).toLocaleString()}`;
                      navigator.clipboard.writeText(messageText);
                      toast({
                        title: "Copied to clipboard",
                        description: "Message details copied successfully.",
                      });
                    }}
                    className={ADMIN_BTN_EDIT}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Copy Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open(
                        `mailto:${message.email}?subject=Re: ${encodeURIComponent(message.subject)}`,
                        "_blank"
                      );
                    }}
                    className={ADMIN_BTN_EDIT}
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenDelete(message)}
                    className={ADMIN_BTN_DELETE}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </AdminTabCard>
            ))}
          </div>
        ) : contactMessages.length > 0 ? (
          <AdminTabEmpty
            message="No messages found"
            hint="Try adjusting your search terms."
          />
        ) : (
          <AdminTabEmpty
            message="No messages yet"
            hint="Contact messages from the website will appear here."
          />
        )}
      </TabsContent>

      <Dialog
        open={isDeleteMessageDialogOpen}
        onOpenChange={setIsDeleteMessageDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
          </DialogHeader>
          <div>
            <p className="mb-4">
              Are you sure you want to delete this message? This action cannot be
              undone.
            </p>
            {messageToDelete && (
              <div className="mb-4 rounded-lg border border-border/60 border-l-[3px] border-l-primary bg-muted/20 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{messageToDelete.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {messageToDelete.email}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {new Date(
                      messageToDelete.created_at
                    ).toLocaleDateString()}
                  </Badge>
                </div>
                <p className="mb-1 text-sm font-medium text-primary">
                  Subject: {messageToDelete.subject}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {messageToDelete.message}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCloseDelete}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

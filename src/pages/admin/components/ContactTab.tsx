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
  DialogClose,
} from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, FileText, Mail, Trash2, Settings, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ContactMessage } from "../types";

export interface ContactTabProps {
  filteredContactMessages: ContactMessage[];
  contactMessages: ContactMessage[];
  contactMessageSearchTerm: string;
  setContactMessageSearchTerm: (v: string) => void;
  animatedContactMessages: Set<string>;
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
  animatedContactMessages,
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
        <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
          <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
            Contact Messages
          </h2>
          <div className="flex items-center gap-4 animate-in slide-in-from-right-4 duration-1000 delay-300">
            <Badge variant="secondary" className="animate-pulse">
              {filteredContactMessages.length} of {contactMessages.length} messages
            </Badge>
          </div>
        </div>

        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-400">
          <div className="relative group">
            <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
            <Input
              placeholder="Search messages by name, email, subject, or content..."
              value={contactMessageSearchTerm}
              onChange={(e) => setContactMessageSearchTerm(e.target.value)}
              className="pl-10 transition-all duration-300 focus:scale-105 focus:shadow-lg focus:shadow-primary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredContactMessages.map((message, index) => (
            <div
              key={message.id}
              className={`bg-card rounded-xl p-6 shadow-lg transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl hover:shadow-primary/10 ${
                animatedContactMessages.has(message.id)
                  ? "animate-in slide-in-from-bottom-4 fade-in duration-700"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                animationDelay: `${index * 200}ms`,
                transform: animatedContactMessages.has(message.id)
                  ? "translateY(0) scale(1)"
                  : "translateY(20px) scale(0.95)",
              }}
            >
              <div className="flex justify-between items-start mb-4 animate-in slide-in-from-left-4 duration-500 delay-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center animate-in zoom-in-95 duration-500 delay-300">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg animate-in slide-in-from-left-4 duration-500 delay-300">
                      {message.name}
                    </h3>
                    <p className="text-muted-foreground animate-in slide-in-from-left-4 duration-500 delay-400">
                      {message.email}
                    </p>
                  </div>
                </div>
                <div className="text-right animate-in slide-in-from-right-4 duration-500 delay-500">
                  <Badge variant="outline" className="mb-2 animate-in fade-in duration-500 delay-600">
                    {new Date(message.created_at).toLocaleDateString()}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 delay-600">
                <div>
                  <h4 className="font-medium text-primary mb-2 animate-in slide-in-from-left-4 duration-500 delay-700 flex items-center">
                    <FileText className="w-4 h-4 mr-2 animate-pulse" />
                    Subject: {message.subject}
                  </h4>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 animate-in slide-in-from-bottom-4 duration-500 delay-800 border-l-4 border-primary/20">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.message}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-900">
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
                  className="transform hover:scale-105 hover:shadow-md transition-all duration-300 group"
                >
                  <FileText className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-12" />
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
                  className="transform hover:scale-105 hover:shadow-md transition-all duration-300 group"
                >
                  <Mail className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                  Reply
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onOpenDelete(message)}
                  className="transform hover:scale-105 hover:shadow-md transition-all duration-300 group"
                >
                  <Trash2 className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-12" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredContactMessages.length === 0 && contactMessages.length > 0 && (
          <div className="text-center py-12 animate-in fade-in duration-500">
            <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">No messages found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms.
            </p>
          </div>
        )}

        {contactMessages.length === 0 && (
          <div className="text-center py-12 animate-in fade-in duration-500">
            <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-muted-foreground">
              Contact messages from the website will appear here.
            </p>
          </div>
        )}
      </TabsContent>

      <Dialog
        open={isDeleteMessageDialogOpen}
        onOpenChange={setIsDeleteMessageDialogOpen}
      >
        <DialogContent className="animate-in zoom-in-95 duration-300">
          <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
            <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
              Delete Message
            </DialogTitle>
          </DialogHeader>
          <div className="animate-in slide-in-from-bottom-4 duration-500 delay-300">
            <p className="mb-4">
              Are you sure you want to delete this message? This action cannot be
              undone.
            </p>
            {messageToDelete && (
              <div className="bg-muted/50 rounded-lg p-4 mb-4 animate-in slide-in-from-bottom-4 duration-500 delay-400">
                <div className="flex justify-between items-start mb-2">
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
                <p className="text-sm font-medium text-primary mb-1">
                  Subject: {messageToDelete.subject}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {messageToDelete.message}
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-500">
            <Button
              type="button"
              variant="outline"
              onClick={onCloseDelete}
              className="transform hover:scale-105 transition-all duration-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
              className="transform hover:scale-105 transition-all duration-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

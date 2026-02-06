/**
 * Creates EventsTab.tsx from extracted content
 * Run: node scripts/create-events-tab.cjs
 */
const fs = require("fs");
const path = require("path");

const innerPath = path.join(__dirname, "..", "events-tab-raw.txt");
const outputPath = path.join(__dirname, "..", "src", "pages", "admin", "components", "EventsTab.tsx");

const inner = fs.readFileSync(innerPath, "utf8");

const header = `/**
 * Admin Dashboard — Events tab (event list, add/edit dialog, pass management).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/ui/file-upload";
import { Plus, Edit, Trash2, Save, X, Image, Video, Upload, Package, Calendar as CalendarIcon, MapPin, DollarSign, Instagram } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getApiBaseUrl } from "@/lib/api-routes";
import type { Event, EventPass } from "../types";

export interface EventsTabProps {
  language: "en" | "fr";
  t: Record<string, string>;
  events: Event[];
  editingEvent: Event | null;
  setEditingEvent: (e: Event | null | ((prev: Event | null) => Event | null)) => void;
  isEventDialogOpen: boolean;
  setIsEventDialogOpen: (v: boolean) => void;
  pendingGalleryImages: File[];
  setPendingGalleryImages: (f: File[]) => void;
  pendingGalleryVideos: File[];
  setPendingGalleryVideos: (f: File[]) => void;
  passValidationErrors: Record<string, string>;
  setPassValidationErrors: (v: Record<string, string>) => void;
  isInstagramUrl: (url: string) => boolean;
  handleSaveEvent: (event: Event, uploadedFile?: File | null) => Promise<void>;
  handleGalleryFileSelect: (files: File[], type: 'images' | 'videos') => void;
  removeGalleryFile: (index: number, type: 'images' | 'videos') => void;
  removePendingGalleryFile: (index: number, type: 'images' | 'videos') => void;
  isPassManagementDialogOpen: boolean;
  setIsPassManagementDialogOpen: (v: boolean) => void;
  eventForPassManagement: Event | null;
  setEventForPassManagement: (e: Event | null) => void;
  passesForManagement: EventPass[];
  setPassesForManagement: (p: EventPass[]) => void;
  newPassForm: { name: string; price: number; description: string; is_primary: boolean; allowed_payment_methods: string[] } | null;
  setNewPassForm: (f: { name: string; price: number; description: string; is_primary: boolean; allowed_payment_methods: string[] } | null) => void;
  setConfirmDelete: (t: { kind: 'delete-pass'; passId: string; passName: string; eventId: string } | null) => void;
  isPassManagementLoading: boolean;
  setIsPassManagementLoading: (v: boolean) => void;
  animatedEvents: Set<string>;
  handleDeleteEvent: (eventId: string) => void;
}

export function EventsTab(p: EventsTabProps) {
  const { toast } = useToast();

  return (
    <TabsContent value="events" className="space-y-6">
`;

const footer = `
    </TabsContent>
  );
}
`;

const fullContent = header + inner.trim() + footer;
fs.writeFileSync(outputPath, fullContent, "utf8");
console.log("Created EventsTab.tsx at", outputPath);

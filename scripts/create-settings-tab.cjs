/**
 * Creates SettingsTab.tsx from extracted content
 * Run: node scripts/create-settings-tab.cjs
 */
const fs = require("fs");
const path = require("path");

const innerPath = path.join(__dirname, "..", "settings-tab-inner.txt");
const outputPath = path.join(__dirname, "..", "src", "pages", "admin", "components", "SettingsTab.tsx");

const inner = fs.readFileSync(innerPath, "utf8");

const header = `/**
 * Admin Dashboard — Settings tab (sales, maintenance, order expiration, hero/about images, favicon).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import FileUpload from "@/components/ui/file-upload";
import { Settings, CheckCircle, XCircle, Clock, Wrench, RefreshCw, Image, Video, Trash2, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import type { HeroImage, AboutImage } from "../types";
import type { FaviconSettings } from "@/lib/favicon";

export interface ExpirationSetting {
  order_status: string;
  default_expiration_hours?: number;
  is_active?: boolean;
}

export interface SettingsTabProps {
  language: "en" | "fr";
  t: Record<string, string>;
  salesEnabled: boolean;
  updateSalesSettingsData: (enabled: boolean) => void;
  loadingSalesSettings: boolean;
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  allowAmbassadorApplication: boolean;
  updateMaintenanceSettings: (enabled: boolean, message: string, allowApp?: boolean) => void;
  loadingMaintenanceSettings: boolean;
  setMaintenanceMessage: (v: string) => void;
  setAllowAmbassadorApplication: (v: boolean) => void;
  expirationSettings: ExpirationSetting[];
  loadingExpirationSettings: boolean;
  updateExpirationSettings: (settings: ExpirationSetting[]) => void;
  triggerAutoRejectExpired: () => void;
  rejectingExpired: boolean;
  ambassadorApplicationEnabled: boolean;
  ambassadorApplicationMessage: string;
  updateAmbassadorApplicationSettings: (enabled: boolean, message: string) => void;
  loadingAmbassadorApplicationSettings: boolean;
  setAmbassadorApplicationMessage: (v: string) => void;
  heroImages: HeroImage[];
  handleUploadHeroImage: (file: File) => void;
  uploadingHeroImage: boolean;
  loadingHeroImages: boolean;
  handleReorderHeroImages: (images: HeroImage[]) => void;
  handleDeleteHeroImage: (index: number) => void;
  aboutImages: AboutImage[];
  handleUploadAboutImage: (file: File) => void;
  uploadingAboutImage: boolean;
  loadingAboutImages: boolean;
  handleReorderAboutImages: (images: AboutImage[]) => void;
  handleDeleteAboutImage: (index: number) => void;
  faviconSettings: FaviconSettings;
  handleUploadFavicon: (file: File, type: string) => void;
  handleDeleteFavicon: (type: string) => void;
  loadingFaviconSettings: boolean;
  uploadingFavicon: { type: string; loading: boolean };
}

export function SettingsTab(p: SettingsTabProps) {
  return (
    <TabsContent value="settings" className="space-y-6">
`;

const footer = `
    </div>
    </TabsContent>
  );
}
`;

const fullContent = header + inner.trimEnd() + footer;
fs.writeFileSync(outputPath, fullContent, "utf8");
console.log("Created SettingsTab.tsx at", outputPath);

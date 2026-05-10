/**
 * Admin Dashboard — Settings tab (sales, maintenance, order expiration, hero/about images, favicon).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import Loader from "@/components/ui/Loader";
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
  heroTypewriterTexts: { en: string[]; fr: string[] };
  handleUpdateHeroTypewriterTexts: (lang: "en" | "fr", texts: string[]) => void;
  handleSaveHeroTypewriterTexts: () => void;
}

export function SettingsTab(p: SettingsTabProps) {
  return (
    <TabsContent value="settings" className="space-y-6">
      {/* Parameters list (no cards / no toggle buttons) */}
      <div className="w-full px-2">
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Settings className="w-4 h-4 text-primary" />
            <span>{p.language === "en" ? "Settings" : "Paramètres"}</span>
          </div>

          <div className="rounded-xl border border-border bg-background/60">
            {/* Sales */}
            <div className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{p.t.salesSettings}</span>
                  {p.loadingSalesSettings ? <Loader size="sm" /> : null}
                </div>
                <p className="text-xs text-foreground/70 mt-1">
                  {p.salesEnabled
                    ? (p.language === "en" ? "Ambassadors can add sales." : "Les ambassadeurs peuvent ajouter des ventes.")
                    : (p.language === "en" ? "Sales are disabled." : "Les ventes sont désactivées.")}
                </p>
              </div>
              <Switch
                checked={p.salesEnabled}
                disabled={p.loadingSalesSettings}
                onCheckedChange={(checked) => p.updateSalesSettingsData(checked)}
              />
            </div>
            <div className="h-px bg-border" />

            {/* Maintenance */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{p.t.maintenanceSettings}</span>
                    {p.loadingMaintenanceSettings ? <Loader size="sm" /> : null}
                  </div>
                  <p className="text-xs text-foreground/70 mt-1">
                    {p.maintenanceEnabled
                      ? (p.language === "en" ? "Website in maintenance." : "Site en maintenance.")
                      : (p.language === "en" ? "Website accessible." : "Site accessible.")}
                  </p>
                </div>
                <Switch
                  checked={p.maintenanceEnabled}
                  disabled={p.loadingMaintenanceSettings}
                  onCheckedChange={(checked) =>
                    p.updateMaintenanceSettings(checked, p.maintenanceMessage, p.allowAmbassadorApplication)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance-message" className="text-xs text-foreground/70">
                  {p.t.maintenanceMessage}
                </Label>
                <Textarea
                  id="maintenance-message"
                  placeholder={p.t.maintenanceMessagePlaceholder}
                  value={p.maintenanceMessage}
                  onChange={(e) => p.setMaintenanceMessage(e.target.value)}
                  onBlur={() => {
                    p.updateMaintenanceSettings(p.maintenanceEnabled, p.maintenanceMessage, p.allowAmbassadorApplication);
                  }}
                  className="min-h-[80px] text-sm bg-background text-foreground"
                />
              </div>

              {p.maintenanceEnabled ? (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <Checkbox
                    id="allow-ambassador-application"
                    checked={p.allowAmbassadorApplication}
                    onCheckedChange={(checked) => {
                      const newValue = checked === true;
                      p.setAllowAmbassadorApplication(newValue);
                      p.updateMaintenanceSettings(p.maintenanceEnabled, p.maintenanceMessage, newValue);
                    }}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <Label htmlFor="allow-ambassador-application" className="text-sm font-medium text-foreground cursor-pointer">
                      {p.t.allowAmbassadorApplication}
                    </Label>
                    <p className="text-xs text-foreground/60 mt-1">{p.t.allowAmbassadorApplicationDescription}</p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="h-px bg-border" />

            {/* Order expiration (Pending Cash) */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {p.language === "en" ? "Order expiration" : "Expiration des commandes"}
                    </span>
                    {p.loadingExpirationSettings ? <Loader size="sm" /> : null}
                  </div>
                  <p className="text-xs text-foreground/70 mt-1">
                    {p.language === "en"
                      ? "Auto-expire Pending Cash orders after a delay."
                      : "Expiration automatique des commandes en attente d'espèces après un délai."}
                  </p>
                </div>
                <Button
                  onClick={p.triggerAutoRejectExpired}
                  disabled={p.rejectingExpired}
                  variant="destructive"
                  size="sm"
                  className="h-8"
                >
                  {p.rejectingExpired ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      {p.language === "en" ? "Processing..." : "Traitement..."}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      {p.language === "en" ? "Reject expired" : "Rejeter expirées"}
                    </>
                  )}
                </Button>
              </div>

              {p.loadingExpirationSettings ? (
                <div className="flex items-center justify-center py-3">
                  <Loader size="sm" className="[background:hsl(var(--muted-foreground))]" />
                </div>
              ) : (
                (() => {
                  const status = "PENDING_CASH";
                  const setting = p.expirationSettings.find((s) => s.order_status === status);
                  const isActive = setting?.is_active !== false;
                  const hours = setting?.default_expiration_hours || 48;
                  return (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <Label className="text-sm font-medium text-foreground">
                          {p.language === "en" ? "Pending Cash" : "Espèces en attente"}
                        </Label>
                        <Switch
                          checked={isActive}
                          onCheckedChange={(checked) => {
                            const updated = p.expirationSettings.map((s) =>
                              s.order_status === status ? { ...s, is_active: checked } : s
                            );
                            if (!updated.find((s) => s.order_status === status)) {
                              updated.push({
                                order_status: status,
                                default_expiration_hours: hours,
                                is_active: checked
                              });
                            }
                            p.updateExpirationSettings(updated.filter((s) => s.order_status === status));
                          }}
                          disabled={p.loadingExpirationSettings}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Label className="text-xs text-foreground/70">
                            {p.language === "en" ? "Default expiration (hours)" : "Expiration par défaut (heures)"}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={hours}
                            onChange={(e) => {
                              const next = parseInt(e.target.value) || 48;
                              const updated = p.expirationSettings.map((s) =>
                                s.order_status === status ? { ...s, default_expiration_hours: next } : s
                              );
                              if (!updated.find((s) => s.order_status === status)) {
                                updated.push({
                                  order_status: status,
                                  default_expiration_hours: next,
                                  is_active: isActive
                                });
                              }
                              p.updateExpirationSettings(updated.filter((s) => s.order_status === status));
                            }}
                            disabled={p.loadingExpirationSettings}
                            className="w-20"
                          />
                          <span className="text-xs text-foreground/60">{p.language === "en" ? "hours" : "heures"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
            <div className="h-px bg-border" />

            {/* Ambassador application */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{p.t.ambassadorApplicationSettings}</span>
                    {p.loadingAmbassadorApplicationSettings ? <Loader size="sm" /> : null}
                  </div>
                  <p className="text-xs text-foreground/70 mt-1">
                    {p.ambassadorApplicationEnabled
                      ? (p.language === "en" ? "Applications are open." : "Les candidatures sont ouvertes.")
                      : (p.language === "en" ? "Applications are closed." : "Les candidatures sont fermées.")}
                  </p>
                </div>
                <Switch
                  checked={p.ambassadorApplicationEnabled}
                  disabled={p.loadingAmbassadorApplicationSettings}
                  onCheckedChange={(checked) => p.updateAmbassadorApplicationSettings(checked, p.ambassadorApplicationMessage)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ambassador-application-message" className="text-xs text-foreground/70">
                  {p.t.ambassadorApplicationMessage}
                </Label>
                <Textarea
                  id="ambassador-application-message"
                  placeholder={p.t.ambassadorApplicationMessagePlaceholder}
                  value={p.ambassadorApplicationMessage}
                  onChange={(e) => p.setAmbassadorApplicationMessage(e.target.value)}
                  onBlur={() => {
                    p.updateAmbassadorApplicationSettings(p.ambassadorApplicationEnabled, p.ambassadorApplicationMessage);
                  }}
                  className="min-h-[80px] text-sm bg-background text-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Remaining settings sections (keep existing card layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-2">
                  {/* Hero Images Settings Card */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Video className="w-5 h-5 text-primary" />
                          {p.t.heroImagesSettings}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">{p.t.heroImagesSettingsDescription}</p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {p.loadingHeroImages ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader size="md" />
                          </div>
                        ) : (
                          <>
                            {/* Upload Hero Image/Video */}
                            <div className="space-y-2">
                              <Label>{p.t.uploadHeroImage}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    p.handleUploadHeroImage(file);
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/*,video/mp4,video/quicktime,.mp4,.mov"
                                maxSize={50}
                                label={p.uploadingHeroImage ? (p.language === 'en' ? 'Uploading...' : 'Téléversement...') : (p.language === 'en' ? 'Upload Image or Video' : 'Téléverser une image ou une vidéo')}
                              />
                              {p.uploadingHeroImage && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader size="sm" />
                                  {p.language === 'en' ? 'Uploading media...' : 'Téléversement du média...'}
                                </div>
                              )}
                            </div>

                            {/* Hero Images List */}
                            {p.heroImages.length === 0 ? (
                              <div className="flex items-center justify-center py-8 text-center text-muted-foreground">
                                <p>{p.t.noHeroImages}</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Label className="text-sm">{p.t.reorderImages}</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {p.heroImages.map((item, index) => (
                                    <Card key={index} className="relative group overflow-hidden">
                                      <div className="relative aspect-video w-full">
                                        {item.type === 'video' ? (
                                          <video
                                            src={item.src}
                                            poster={item.poster}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                            loop
                                            preload="metadata"
                                            style={{ objectFit: 'cover' }}
                                            onLoadedData={(e) => {
                                              const video = e.currentTarget;
                                              video.muted = true;
                                              video.volume = 0;
                                            }}
                                          />
                                        ) : (
                                          <img
                                            src={item.src}
                                            alt={item.alt}
                                            className="w-full h-full object-cover"
                                          />
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                          <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                              <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => {
                                                  if (index > 0) {
                                                    const newOrder = [...p.heroImages];
                                                    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                                    p.handleReorderHeroImages(newOrder);
                                                  }
                                                }}
                                                disabled={index === 0}
                                                className="shadow-lg"
                                              >
                                                <ArrowUp className="w-4 h-4" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => {
                                                  if (index < p.heroImages.length - 1) {
                                                    const newOrder = [...p.heroImages];
                                                    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                                    p.handleReorderHeroImages(newOrder);
                                                  }
                                                }}
                                                disabled={index === p.heroImages.length - 1}
                                                className="shadow-lg"
                                              >
                                                <ArrowDown className="w-4 h-4" />
                                              </Button>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => p.handleDeleteHeroImage(index)}
                                              className="shadow-lg"
                                            >
                                              <Trash2 className="w-4 h-4 mr-1" />
                                              {p.t.deleteHeroImage}
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                      <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">
                                            {item.type === 'video' 
                                              ? (p.language === 'en' ? 'Video' : 'Vidéo')
                                              : (p.language === 'en' ? 'Image' : 'Image')} {index + 1}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <Badge variant={item.type === 'video' ? 'default' : 'outline'} className="text-xs">
                                              {item.type === 'video' ? <Video className="w-3 h-3 mr-1" /> : <Image className="w-3 h-3 mr-1" />}
                                              {item.type === 'video' ? (p.language === 'en' ? 'Video' : 'Vidéo') : (p.language === 'en' ? 'Image' : 'Image')}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                              {item.alt || 'No alt text'}
                                            </Badge>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Hero Typewriter Texts Card */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {p.language === "en" ? "Hero typing texts" : "Textes tapés du hero"}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === "en"
                            ? "Control the lines used in the hero typewriter effect. You can add, remove and reorder texts for each language."
                            : "Contrôlez les lignes utilisées dans l'effet de texte tapé du hero. Vous pouvez ajouter, supprimer et réorganiser les textes pour chaque langue."}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-6">
                        {(["en", "fr"] as const).map((langKey) => (
                          <div key={langKey} className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                  <span>{langKey === "en" ? "English" : "Français"}</span>
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {p.language === "en"
                                    ? "These lines rotate in the hero."
                                    : "Ces lignes tournent dans le hero."}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const current = p.heroTypewriterTexts[langKey] || [];
                                  p.handleUpdateHeroTypewriterTexts(langKey, [...current, ""]);
                                }}
                                className="shrink-0"
                              >
                                {p.language === "en" ? "Add line" : "Ajouter une ligne"}
                              </Button>
                            </div>

                            {p.heroTypewriterTexts[langKey].length === 0 ? (
                              <div className="rounded-lg border border-border bg-muted/30 p-3">
                                <p className="text-xs text-muted-foreground">
                                  {p.language === "en"
                                    ? "No custom texts yet. The default hardcoded texts will be used."
                                    : "Aucun texte personnalisé pour le moment. Les textes par défaut codés en dur seront utilisés."}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-border bg-background/60 overflow-hidden">
                                {p.heroTypewriterTexts[langKey].map((text, index) => (
                                  <div key={index}>
                                    <div className="flex items-center gap-3 p-3">
                                      <div className="w-8 text-xs text-muted-foreground tabular-nums text-center select-none">
                                        {index + 1}
                                      </div>
                                      <Input
                                        value={text}
                                        onChange={(e) => {
                                          const arr = [...p.heroTypewriterTexts[langKey]];
                                          arr[index] = e.target.value;
                                          p.handleUpdateHeroTypewriterTexts(langKey, arr);
                                        }}
                                        className="text-sm flex-1"
                                        placeholder={
                                          p.language === "en"
                                            ? "Type text to display in hero"
                                            : "Saisir le texte à afficher dans le hero"
                                        }
                                      />
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          disabled={index === 0}
                                          onClick={() => {
                                            if (index === 0) return;
                                            const arr = [...p.heroTypewriterTexts[langKey]];
                                            [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
                                            p.handleUpdateHeroTypewriterTexts(langKey, arr);
                                          }}
                                          className="h-9 w-9"
                                        >
                                          <ArrowUp className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          disabled={index === p.heroTypewriterTexts[langKey].length - 1}
                                          onClick={() => {
                                            const arr = [...p.heroTypewriterTexts[langKey]];
                                            if (index >= arr.length - 1) return;
                                            [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
                                            p.handleUpdateHeroTypewriterTexts(langKey, arr);
                                          }}
                                          className="h-9 w-9"
                                        >
                                          <ArrowDown className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => {
                                            const arr = p.heroTypewriterTexts[langKey].filter((_, i) => i !== index);
                                            p.handleUpdateHeroTypewriterTexts(langKey, arr);
                                          }}
                                          className="h-9 w-9"
                                          title={p.language === "en" ? "Delete line" : "Supprimer la ligne"}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                    {index < p.heroTypewriterTexts[langKey].length - 1 ? (
                                      <div className="h-px bg-border" />
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={p.handleSaveHeroTypewriterTexts}
                          >
                            {p.language === "en" ? "Save texts" : "Enregistrer les textes"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* About Images Settings Card */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'About Page Images' : 'Images de la page À propos'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {p.loadingAboutImages ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader size="md" />
                          </div>
                        ) : (
                          <>
                            {/* Upload About Image */}
                            <div className="space-y-2">
                              <Label>{p.language === 'en' ? 'Upload' : 'Téléverser'}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    p.handleUploadAboutImage(file);
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/*"
                                maxSize={10}
                                label={p.uploadingAboutImage ? (p.language === 'en' ? 'Uploading...' : 'Téléversement...') : (p.language === 'en' ? 'Upload' : 'Téléverser')}
                              />
                              {p.uploadingAboutImage && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader size="sm" />
                                  {p.language === 'en' ? 'Uploading image...' : "Téléversement de l'image..."}
                                </div>
                              )}
                            </div>

                            {/* About Images List */}
                            {p.aboutImages.length === 0 ? (
                              <div className="flex items-center justify-center py-8 text-center text-muted-foreground">
                                <p>{p.language === 'en' ? 'No about images uploaded yet' : 'Aucune image À propos téléversée'}</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Label className="text-sm">{p.language === 'en' ? 'Reorder Images' : 'Réorganiser les images'}</Label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {p.aboutImages.map((image, index) => (
                                    <Card key={index} className="relative group overflow-hidden">
                                      <div className="relative aspect-square w-full">
                                        <img
                                          src={image.src}
                                          alt={image.alt || `About image ${index + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                          <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                              <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => {
                                                  if (index > 0) {
                                                    const newOrder = [...p.aboutImages];
                                                    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                                    p.handleReorderAboutImages(newOrder);
                                                  }
                                                }}
                                                disabled={index === 0}
                                                className="shadow-lg"
                                              >
                                                <ArrowUp className="w-4 h-4" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => {
                                                  if (index < p.aboutImages.length - 1) {
                                                    const newOrder = [...p.aboutImages];
                                                    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                                    p.handleReorderAboutImages(newOrder);
                                                  }
                                                }}
                                                disabled={index === p.aboutImages.length - 1}
                                                className="shadow-lg"
                                              >
                                                <ArrowDown className="w-4 h-4" />
                                              </Button>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => p.handleDeleteAboutImage(index)}
                                              className="shadow-lg"
                                            >
                                              <Trash2 className="w-4 h-4 mr-1" />
                                              {p.language === 'en' ? 'Delete' : 'Supprimer'}
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                      <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">
                                            {p.language === 'en' ? 'Image' : 'Image'} {index + 1}
                                          </span>
                                          <Badge variant="outline" className="text-xs">
                                            {image.alt || 'No alt text'}
                                          </Badge>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

      </div>
    </TabsContent>
  );
}

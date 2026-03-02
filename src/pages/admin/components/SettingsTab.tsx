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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-2">
                  {/* Sales Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <Card className="shadow-lg h-full flex flex-col">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                        <Settings className="w-5 h-5 text-primary" />
                        {p.t.salesSettings}
                      </CardTitle>
                      <p className="text-sm text-foreground/70 mt-2">{p.t.salesSettingsDescription}</p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                            p.salesEnabled 
                              ? 'bg-green-500 shadow-md shadow-green-500/50' 
                              : 'bg-gray-500'
                          }`}>
                            {p.salesEnabled ? (
                              <CheckCircle className="w-5 h-5 text-white" />
                            ) : (
                              <XCircle className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">
                              {p.salesEnabled ? p.t.salesEnabled : p.t.salesDisabled}
                            </p>
                            <p className="text-xs text-foreground/60 line-clamp-2">
                              {p.salesEnabled 
                                ? (p.language === 'en' ? 'Ambassadors can add sales' : 'Les ambassadeurs peuvent ajouter des ventes')
                                : (p.language === 'en' ? 'Sales are disabled' : 'Les ventes sont dÃ©sactivÃ©es')
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => p.updateSalesSettingsData(!p.salesEnabled)}
                          disabled={p.loadingSalesSettings}
                          variant={p.salesEnabled ? "default" : "destructive"}
                          size="sm"
                          className="ml-2 flex-shrink-0 transition-all duration-300"
                        >
                          {p.loadingSalesSettings ? (
                            <Loader size="sm" />
                          ) : p.salesEnabled ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  </div>

                  {/* Maintenance Mode Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <Card className="shadow-lg h-full flex flex-col">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                        <Settings className="w-5 h-5 text-primary" />
                        {p.t.maintenanceSettings}
                      </CardTitle>
                      <p className="text-sm text-foreground/70 mt-2">{p.t.maintenanceSettingsDescription}</p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                            p.maintenanceEnabled 
                              ? 'bg-orange-500 shadow-md shadow-orange-500/50' 
                              : 'bg-gray-500'
                          }`}>
                            {p.maintenanceEnabled ? (
                              <Wrench className="w-5 h-5 text-white" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">
                              {p.maintenanceEnabled ? p.t.maintenanceEnabled : p.t.maintenanceDisabled}
                            </p>
                            <p className="text-xs text-foreground/60 line-clamp-2">
                              {p.maintenanceEnabled 
                                ? (p.language === 'en' ? 'Website in maintenance' : 'Site en maintenance')
                                : (p.language === 'en' ? 'Website accessible' : 'Site accessible')
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => p.updateMaintenanceSettings(!p.maintenanceEnabled, p.maintenanceMessage)}
                          disabled={p.loadingMaintenanceSettings}
                          variant={p.maintenanceEnabled ? "default" : "destructive"}
                          size="sm"
                          className="ml-2 flex-shrink-0 transition-all duration-300"
                        >
                          {p.loadingMaintenanceSettings ? (
                            <Loader size="sm" />
                          ) : p.maintenanceEnabled ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Maintenance Message Input */}
                      <div className="space-y-2">
                        <Label htmlFor="maintenance-message" className="text-sm text-foreground">{p.t.maintenanceMessage}</Label>
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

                      {/* Allow Ambassador Application Checkbox */}
                      {p.maintenanceEnabled && (
                        <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-start space-x-3">
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
                            <div className="flex-1 space-y-1">
                              <Label 
                                htmlFor="allow-ambassador-application" 
                                className="text-sm font-medium text-foreground cursor-pointer"
                              >
                                {p.t.allowAmbassadorApplication}
                              </Label>
                              <p className="text-xs text-foreground/60">
                                {p.t.allowAmbassadorApplicationDescription}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  </div>

                  {/* Order Expiration Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Clock className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'Order Expiration Settings' : 'ParamÃ¨tres d\'Expiration des Commandes'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === 'en' 
                            ? 'Set default expiration time for Pending Cash orders. Orders will be automatically rejected when expired. Use external cron service to call /api/auto-reject-expired-orders every 5 minutes.' 
                            : 'DÃ©finir le dÃ©lai d\'expiration par dÃ©faut pour les commandes Pending Cash. Les commandes seront automatiquement rejetÃ©es Ã  l\'expiration. Utilisez un service cron externe pour appeler /api/auto-reject-expired-orders toutes les 5 minutes.'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Manual trigger section - Dark theme compatible */}
                        <div className="mb-4 p-4 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-10 h-10 rounded-full bg-red-500/20 dark:bg-red-500/30 flex items-center justify-center border border-red-500/30">
                                <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold text-foreground">
                                  {p.language === 'en' ? 'Manual Rejection' : 'Rejet Manuel'}
                                </h4>
                                <Badge variant="outline" className="text-xs bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">
                                  {p.language === 'en' ? 'Instant Action' : 'Action ImmÃ©diate'}
                                </Badge>
                              </div>
                              <p className="text-xs text-foreground/70 mb-3 leading-relaxed">
                                {p.language === 'en' 
                                  ? 'Click the button below to immediately reject all expired PENDING_CASH orders. Stock will be automatically released and orders will be marked as REJECTED.' 
                                  : 'Cliquez sur le bouton ci-dessous pour rejeter immÃ©diatement toutes les commandes PENDING_CASH expirÃ©es. Le stock sera automatiquement libÃ©rÃ© et les commandes seront marquÃ©es comme REJETÃ‰ES.'}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                  onClick={p.triggerAutoRejectExpired}
                                  disabled={p.rejectingExpired}
                                  variant="destructive"
                                  size="sm"
                                  className="shadow-md hover:shadow-lg transition-all duration-200"
                                >
                                  {p.rejectingExpired ? (
                                    <>
                                      <Loader size="sm" className="mr-2" />
                                      {p.language === 'en' ? 'Processing...' : 'Traitement...'}
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 mr-2" />
                                      {p.language === 'en' ? 'Reject Expired Orders' : 'Rejeter les Commandes ExpirÃ©es'}
                                    </>
                                  )}
                                </Button>
                                <span className="text-xs text-foreground/50">
                                  {p.language === 'en' ? 'For automatic rejection every 5 minutes, set up an external cron service' : 'Pour un rejet automatique toutes les 5 minutes, configurez un service cron externe'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {p.loadingExpirationSettings ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader size="sm" className="[background:hsl(var(--muted-foreground))]" />
                          </div>
                        ) : (
                          <>
                            {['PENDING_CASH'].map((status) => {
                              const setting = p.expirationSettings.find(s => s.order_status === status);
                              const statusLabel = {
                                'PENDING_CASH': p.language === 'en' ? 'Pending Cash' : 'EspÃ¨ces en Attente'
                              }[status] || status;
                              
                              return (
                                <div key={status} className="p-4 bg-muted/30 rounded-lg border border-border">
                                  <div className="flex items-center justify-between mb-3">
                                    <Label className="text-sm font-semibold text-foreground">{statusLabel}</Label>
                                    <Switch
                                      checked={setting?.is_active !== false}
                                      onCheckedChange={(checked) => {
                                        const updated = p.expirationSettings.map(s =>
                                          s.order_status === status
                                            ? { ...s, is_active: checked }
                                            : s
                                        );
                                        if (!updated.find(s => s.order_status === status)) {
                                          updated.push({
                                            order_status: status,
                                            default_expiration_hours: setting?.default_expiration_hours || 48,
                                            is_active: checked
                                          });
                                        }
                                        // Only send PENDING_CASH settings
                                        const pendingCashOnly = updated.filter(s => s.order_status === 'PENDING_CASH');
                                        p.updateExpirationSettings(pendingCashOnly);
                                      }}
                                      disabled={p.loadingExpirationSettings}
                                    />
                                  </div>
                                  {/* Always show time input, even when inactive */}
                                  <div className="space-y-2">
                                    <Label className="text-xs text-foreground/70">
                                      {p.language === 'en' ? 'Default Expiration (hours)' : 'Expiration par DÃ©faut (heures)'}
                                    </Label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        min="1"
                                        value={setting?.default_expiration_hours || 48}
                                        onChange={(e) => {
                                          const hours = parseInt(e.target.value) || 48;
                                          const updated = p.expirationSettings.map(s =>
                                            s.order_status === status
                                              ? { ...s, default_expiration_hours: hours }
                                              : s
                                          );
                                          if (!updated.find(s => s.order_status === status)) {
                                            updated.push({
                                              order_status: status,
                                              default_expiration_hours: hours,
                                              is_active: setting?.is_active !== false
                                            });
                                          }
                                          // Only send PENDING_CASH settings
                                          const pendingCashOnly = updated.filter(s => s.order_status === 'PENDING_CASH');
                                          p.updateExpirationSettings(pendingCashOnly);
                                        }}
                                        disabled={p.loadingExpirationSettings}
                                        className="w-20"
                                      />
                                      <span className="text-xs text-foreground/60">
                                        {p.language === 'en' ? 'hours' : 'heures'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Ambassador Application Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <Card className="shadow-lg h-full flex flex-col">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                        <Settings className="w-5 h-5 text-primary" />
                        {p.t.ambassadorApplicationSettings}
                      </CardTitle>
                      <p className="text-sm text-foreground/70 mt-2">{p.t.ambassadorApplicationSettingsDescription}</p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                            p.ambassadorApplicationEnabled 
                              ? 'bg-blue-500 shadow-md shadow-blue-500/50' 
                              : 'bg-gray-500'
                          }`}>
                            {p.ambassadorApplicationEnabled ? (
                              <CheckCircle className="w-5 h-5 text-white" />
                            ) : (
                              <XCircle className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">
                              {p.ambassadorApplicationEnabled ? p.t.ambassadorApplicationEnabled : p.t.ambassadorApplicationDisabled}
                            </p>
                            <p className="text-xs text-foreground/60 line-clamp-2">
                              {p.ambassadorApplicationEnabled 
                                ? (p.language === 'en' ? 'Applications are open' : 'Les candidatures sont ouvertes')
                                : (p.language === 'en' ? 'Applications are closed' : 'Les candidatures sont fermÃ©es')
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            p.updateAmbassadorApplicationSettings(!p.ambassadorApplicationEnabled, p.ambassadorApplicationMessage);
                          }}
                          disabled={p.loadingAmbassadorApplicationSettings}
                          variant={p.ambassadorApplicationEnabled ? "default" : "destructive"}
                          size="sm"
                          className="ml-2 flex-shrink-0 transition-all duration-300"
                        >
                          {p.loadingAmbassadorApplicationSettings ? (
                            <Loader size="sm" />
                          ) : p.ambassadorApplicationEnabled ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Ambassador Application Closed Message Input */}
                      <div className="space-y-2">
                        <Label htmlFor="ambassador-application-message" className="text-sm text-foreground">{p.t.ambassadorApplicationMessage}</Label>
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
                    </CardContent>
                  </Card>
                  </div>

                  {/* Hero Images Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
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
                                label={p.uploadingHeroImage ? (p.language === 'en' ? 'Uploading...' : 'TÃ©lÃ©chargement...') : (p.language === 'en' ? 'Upload Image or Video' : 'TÃ©lÃ©charger une Image ou une VidÃ©o')}
                              />
                              {p.uploadingHeroImage && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader size="sm" />
                                  {p.language === 'en' ? 'Uploading media...' : 'TÃ©lÃ©chargement du mÃ©dia...'}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {p.language === 'en' 
                                  ? 'Supports images (JPG, PNG) and videos (MP4, MOV). Recommended: MP4 (H.264), 5-10 seconds, under 2MB for fast loading. Videos will auto-play muted and loop.' 
                                  : 'Prend en charge les images (JPG, PNG) et les vidÃ©os (MP4, MOV). RecommandÃ©: MP4 (H.264), 5-10 secondes, moins de 2MB pour un chargement rapide. Les vidÃ©os se liront automatiquement en muet et en boucle.'}
                              </p>
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
                                              ? (p.language === 'en' ? 'Video' : 'VidÃ©o') 
                                              : (p.language === 'en' ? 'Image' : 'Image')} {index + 1}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <Badge variant={item.type === 'video' ? 'default' : 'outline'} className="text-xs">
                                              {item.type === 'video' ? <Video className="w-3 h-3 mr-1" /> : <Image className="w-3 h-3 mr-1" />}
                                              {item.type === 'video' ? (p.language === 'en' ? 'Video' : 'VidÃ©o') : (p.language === 'en' ? 'Image' : 'Image')}
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
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
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
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <span>{langKey === "en" ? "English" : "Français"}</span>
                              </Label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const current = p.heroTypewriterTexts[langKey] || [];
                                  p.handleUpdateHeroTypewriterTexts(langKey, [...current, ""]);
                                }}
                              >
                                {p.language === "en" ? "Add line" : "Ajouter une ligne"}
                              </Button>
                            </div>
                            {p.heroTypewriterTexts[langKey].length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {p.language === "en"
                                  ? "No custom texts yet. The default hardcoded texts will be used."
                                  : "Aucun texte personnalisé pour le moment. Les textes par défaut codés en dur seront utilisés."}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {p.heroTypewriterTexts[langKey].map((text, index) => (
                                  <div key={index} className="flex gap-2 items-start">
                                    <div className="flex flex-col gap-1 flex-1">
                                      <Input
                                        value={text}
                                        onChange={(e) => {
                                          const arr = [...p.heroTypewriterTexts[langKey]];
                                          arr[index] = e.target.value;
                                          p.handleUpdateHeroTypewriterTexts(langKey, arr);
                                        }}
                                        className="text-sm"
                                        placeholder={
                                          p.language === "en"
                                            ? "Type text to display in hero"
                                            : "Saisir le texte à afficher dans le hero"
                                        }
                                      />
                                      <p className="text-[11px] text-muted-foreground">
                                        {p.language === "en"
                                          ? "This line will appear in the typing animation."
                                          : "Cette ligne apparaîtra dans l’animation de texte tapé."}
                                      </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
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
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
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
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {p.language === 'en' ? 'About Page Images' : 'Images de la Page Ã€ Propos'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {p.language === 'en' 
                            ? 'Manage images displayed on the About page. Upload, reorder, or remove images. Recommended: 4 images for best display.' 
                            : 'GÃ©rez les images affichÃ©es sur la page Ã€ propos. TÃ©lÃ©chargez, rÃ©organisez ou supprimez des images. RecommandÃ©: 4 images pour un meilleur affichage.'}
                        </p>
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
                              <Label>{p.language === 'en' ? 'Upload About Image' : 'TÃ©lÃ©charger une Image'}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    p.handleUploadAboutImage(file);
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/*"
                                maxSize={10}
                                label={p.uploadingAboutImage ? (p.language === 'en' ? 'Uploading...' : 'TÃ©lÃ©chargement...') : (p.language === 'en' ? 'Upload About Image' : 'TÃ©lÃ©charger une Image')}
                              />
                              {p.uploadingAboutImage && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader size="sm" />
                                  {p.language === 'en' ? 'Uploading image...' : 'TÃ©lÃ©chargement de l\'image...'}
                                </div>
                              )}
                            </div>

                            {/* About Images List */}
                            {p.aboutImages.length === 0 ? (
                              <div className="flex items-center justify-center py-8 text-center text-muted-foreground">
                                <p>{p.language === 'en' ? 'No about images uploaded yet' : 'Aucune image Ã€ propos tÃ©lÃ©chargÃ©e'}</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Label className="text-sm">{p.language === 'en' ? 'Reorder Images' : 'RÃ©organiser les Images'}</Label>
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

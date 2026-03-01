/**
 * Admin Dashboard — Events tab (event list, add/edit dialog, pass management).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import Loader from "@/components/ui/Loader";
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
import { Plus, Edit, Trash2, Save, X, Image, Video, Upload, Package, Calendar as CalendarIcon, MapPin, DollarSign, Instagram, ImagePlus, RefreshCw } from "lucide-react";
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
<div className="flex justify-between items-center mb-4 animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">Events Management</h2>
                  <Dialog open={p.isEventDialogOpen} onOpenChange={p.setIsEventDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          // Initialize with empty passes and default event_type - admin must add at least one pass
                          p.setEditingEvent({
                            passes: [],
                            event_type: 'upcoming',
                            featured: false
                          } as Event);
                          // Clear pending files and validation errors when opening dialog
                          p.setPendingGalleryImages([]);
                          p.setPendingGalleryVideos([]);
                          p.setPassValidationErrors({});
                          p.setIsEventDialogOpen(true);
                        }}
                        className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
                      >
                        <Plus className="w-4 h-4 mr-2 animate-pulse" />
                        {p.t.add}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                      <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                        <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                          {p.editingEvent?.id ? 'Edit Event' : 'Add New Event'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                            <Label htmlFor="eventName">{p.t.eventName}</Label>
                            <Input
                              id="eventName"
                              value={p.editingEvent?.name || ''}
                              onChange={(e) => p.setEditingEvent(prev => ({ ...prev, name: e.target.value }))}
                              className="transition-all duration-300 focus:scale-105"
                            />
                          </div>
                          <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                            <Label htmlFor="eventDate">{p.t.eventDate}</Label>
                            <Input
                              id="eventDate"
                              type="datetime-local"
                              value={p.editingEvent?.date ? p.editingEvent.date.slice(0, 16) : ''}
                              onChange={(e) => p.setEditingEvent(prev => ({ ...prev, date: e.target.value }))}
                              className="transition-all duration-300 focus:scale-105"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="eventVenue">{p.t.eventVenue}</Label>
                            <Input
                              id="eventVenue"
                              value={p.editingEvent?.venue || ''}
                              onChange={(e) => p.setEditingEvent(prev => ({ ...prev, venue: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="eventCity">{p.t.eventCity}</Label>
                            <Input
                              id="eventCity"
                              value={p.editingEvent?.city || ''}
                              onChange={(e) => p.setEditingEvent(prev => ({ ...prev, city: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="eventDescription">{p.t.eventDescription}</Label>
                          <Textarea
                            id="eventDescription"
                            value={p.editingEvent?.description || ''}
                            onChange={(e) => p.setEditingEvent(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="eventInstagramLink" className="flex items-center gap-2">
                            <Instagram className="w-4 h-4" />
                            {p.t.eventInstagramLink} *
                          </Label>
                          <Input
                            id="eventInstagramLink"
                            type="url"
                            value={p.editingEvent?.instagram_link || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              p.setEditingEvent(prev => ({ ...prev, instagram_link: value }));
                            }}
                            placeholder="https://www.instagram.com/username"
                            className={p.editingEvent?.instagram_link && !p.isInstagramUrl(p.editingEvent.instagram_link) ? 'border-red-500' : ''}
                            required
                          />
                          {p.editingEvent?.instagram_link && !p.isInstagramUrl(p.editingEvent.instagram_link) && (
                            <p className="text-sm text-red-500 mt-1">
                              {p.language === 'en' 
                                ? 'Must be a valid Instagram URL (e.g., https://www.instagram.com/username)' 
                                : 'Doit Ãªtre une URL Instagram valide (ex: https://www.instagram.com/username)'}
                            </p>
                          )}
                          {!p.editingEvent?.instagram_link && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {p.language === 'en' 
                                ? 'Must start with https://www.instagram.com/ or https://instagram.com/' 
                                : 'Doit commencer par https://www.instagram.com/ ou https://instagram.com/'}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="eventType">{p.t.eventType}</Label>
                          <Select value={p.editingEvent?.event_type || 'upcoming'} onValueChange={(value: 'upcoming' | 'gallery') => p.setEditingEvent(prev => ({ ...prev, event_type: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upcoming">{p.t.eventTypeUpcoming}</SelectItem>
                              <SelectItem value="gallery">{p.t.eventTypeGallery}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{p.t.eventPoster}</Label>
                          <FileUpload
                            onFileSelect={(file) => p.setEditingEvent(prev => ({ ...prev, _uploadFile: file }))}
                            onUrlChange={(url) => p.setEditingEvent(prev => ({ ...prev, poster_url: url }))}
                            currentUrl={p.editingEvent?.poster_url}
                            accept="image/*"
                          />
                        </div>
                        {/* Gallery Images & Videos - Only show for Gallery Events */}
                        {p.editingEvent?.event_type === 'gallery' && (
                          <div className="space-y-6 border-t pt-6">
                            {/* Gallery Images Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-lg font-semibold flex items-center gap-2">
                                  <Image className="w-5 h-5" />
                                  {p.t.galleryImages}
                                </Label>
                                <div className="relative">
                                  <input
                                    type="file"
                                    id="gallery-images-upload"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (files.length > 0) {
                                        p.handleGalleryFileSelect(files, 'images');
                                      }
                                      // Reset input
                                      e.target.value = '';
                                    }}
                                    className="hidden"
                                  />
                                  <Label
                                    htmlFor="gallery-images-upload"
                                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                  >
                                    <Upload className="w-4 h-4" />
                                    {p.t.addGalleryFile}
                                  </Label>
                                </div>
                              </div>
                              {/* Existing uploaded images */}
                              {p.editingEvent?.gallery_images && p.editingEvent.gallery_images.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {p.language === 'en' ? 'Uploaded Images' : 'Images TÃ©lÃ©chargÃ©es'}
                                  </Label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {p.editingEvent.gallery_images.map((url, index) => (
                                      <div key={`uploaded-${index}`} className="relative group">
                                        <img
                                          src={url}
                                          alt={`Gallery image ${index + 1}`}
                                          className="w-full h-32 object-cover rounded-lg border border-border"
                                        />
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => p.removeGalleryFile(index, 'images')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Pending images (to be uploaded on save) */}
                              {p.pendingGalleryImages.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {p.language === 'en' ? `Pending Images (${p.pendingGalleryImages.length}) - Will upload on save` : `Images en Attente (${p.pendingGalleryImages.length}) - Sera tÃ©lÃ©chargÃ© lors de l'enregistrement`}
                                  </Label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {p.pendingGalleryImages.map((file, index) => (
                                      <div key={`pending-${index}`} className="relative group">
                                        <img
                                          src={URL.createObjectURL(file)}
                                          alt={`Pending image ${index + 1}`}
                                          className="w-full h-32 object-cover rounded-lg border border-dashed border-primary"
                                        />
                                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Badge variant="secondary" className="text-xs">
                                            {p.language === 'en' ? 'Pending' : 'En Attente'}
                                          </Badge>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => p.removePendingGalleryFile(index, 'images')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(!p.editingEvent?.gallery_images || p.editingEvent.gallery_images.length === 0) && p.pendingGalleryImages.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  {p.language === 'en' 
                                    ? 'No gallery images. Select images to upload when you save.' 
                                    : 'Aucune image de galerie. SÃ©lectionnez des images Ã  tÃ©lÃ©charger lors de l\'enregistrement.'}
                                </p>
                              )}
                            </div>

                            {/* Gallery Videos Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-lg font-semibold flex items-center gap-2">
                                  <Video className="w-5 h-5" />
                                  {p.t.galleryVideos}
                                </Label>
                                <div className="relative">
                                  <input
                                    type="file"
                                    id="gallery-videos-upload"
                                    multiple
                                    accept="video/*"
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (files.length > 0) {
                                        p.handleGalleryFileSelect(files, 'videos');
                                      }
                                      // Reset input
                                      e.target.value = '';
                                    }}
                                    className="hidden"
                                  />
                                  <Label
                                    htmlFor="gallery-videos-upload"
                                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                  >
                                    <Upload className="w-4 h-4" />
                                    {p.t.addGalleryFile}
                                  </Label>
                                </div>
                              </div>
                              {/* Existing uploaded videos */}
                              {p.editingEvent?.gallery_videos && p.editingEvent.gallery_videos.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {p.language === 'en' ? 'Uploaded Videos' : 'VidÃ©os TÃ©lÃ©chargÃ©es'}
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {p.editingEvent.gallery_videos.map((url, index) => (
                                      <div key={`uploaded-video-${index}`} className="relative group">
                                        <video
                                          src={url}
                                          controls
                                          className="w-full h-48 object-cover rounded-lg border border-border"
                                        />
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => p.removeGalleryFile(index, 'videos')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Pending videos (to be uploaded on save) */}
                              {p.pendingGalleryVideos.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {p.language === 'en' ? `Pending Videos (${p.pendingGalleryVideos.length}) - Will upload on save` : `VidÃ©os en Attente (${p.pendingGalleryVideos.length}) - Sera tÃ©lÃ©chargÃ© lors de l'enregistrement`}
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {p.pendingGalleryVideos.map((file, index) => (
                                      <div key={`pending-video-${index}`} className="relative group">
                                        <video
                                          src={URL.createObjectURL(file)}
                                          controls
                                          className="w-full h-48 object-cover rounded-lg border border-dashed border-primary"
                                        />
                                        <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded text-xs">
                                          <Badge variant="secondary">
                                            {p.language === 'en' ? 'Pending' : 'En Attente'}
                                          </Badge>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => p.removePendingGalleryFile(index, 'videos')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(!p.editingEvent?.gallery_videos || p.editingEvent.gallery_videos.length === 0) && p.pendingGalleryVideos.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  {p.language === 'en' 
                                    ? 'No gallery videos. Select videos to upload when you save.' 
                                    : 'Aucune vidÃ©o de galerie. SÃ©lectionnez des vidÃ©os Ã  tÃ©lÃ©charger lors de l\'enregistrement.'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-800">
                        <DialogClose asChild>
                          <Button 
                            variant="outline"
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            {p.t.cancel}
                          </Button>
                        </DialogClose>
                        <Button 
                          onClick={async () => {
                            await p.handleSaveEvent(p.editingEvent, p.editingEvent._uploadFile);
                            p.setIsEventDialogOpen(false);
                          }}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Save className="w-4 h-4 mr-2 animate-pulse" />
                          {p.t.save}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Pass Management Dialog */}
                  <Dialog open={p.isPassManagementDialogOpen} onOpenChange={p.setIsPassManagementDialogOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <DialogTitle className="flex items-center gap-2">
                              <Package className="w-5 h-5" />
                              {p.language === 'en' ? 'Pass Stock Management' : 'Gestion des Stocks de Passes'}
                            </DialogTitle>
                            {p.eventForPassManagement && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {p.eventForPassManagement.name} â€¢ {new Date(p.eventForPassManagement.date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              p.setNewPassForm({
                                name: '',
                                price: 0,
                                description: '',
                                is_primary: p.passesForManagement.length === 0 || !p.passesForManagement.some(p => p.is_primary),
                                allowed_payment_methods: [] // Empty = all methods allowed (NULL in DB)
                              });
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {p.language === 'en' ? 'Add Pass' : 'Ajouter Pass'}
                          </Button>
                        </div>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        {/* New Pass Form */}
                        {p.newPassForm !== null && (
                          <Card className="border-primary/50 bg-primary/5">
                            <CardContent className="p-5 space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-semibold">{p.language === 'en' ? 'Add New Pass' : 'Ajouter un Nouveau Pass'}</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => p.setNewPassForm(null)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label>{p.language === 'en' ? 'Pass Name' : 'Nom du Pass'} *</Label>
                                  <Input
                                    value={p.newPassForm.name}
                                    onChange={(e) => p.setNewPassForm({ ...p.newPassForm, name: e.target.value })}
                                    placeholder={p.language === 'en' ? 'e.g., VIP, Standard' : 'ex: VIP, Standard'}
                                  />
                                </div>
                                <div>
                                  <Label>{p.language === 'en' ? 'Price (TND)' : 'Prix (TND)'} *</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={p.newPassForm.price || ''}
                                    onChange={(e) => p.setNewPassForm({ ...p.newPassForm, price: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label>{p.language === 'en' ? 'Description' : 'Description'}</Label>
                                <Textarea
                                  value={p.newPassForm.description}
                                  onChange={(e) => p.setNewPassForm({ ...p.newPassForm, description: e.target.value })}
                                  placeholder={p.language === 'en' ? 'Optional description' : 'Description optionnelle'}
                                  rows={2}
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={p.newPassForm.is_primary}
                                  onChange={(e) => {
                                    const isPrimary = e.target.checked;
                                    p.setNewPassForm({ ...p.newPassForm, is_primary: isPrimary });
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label className="text-sm font-medium cursor-pointer">
                                  {p.language === 'en' ? 'Mark as primary pass' : 'Marquer comme pass principal'}
                                </Label>
                              </div>
                              <div className="space-y-2">
                                <Label>{p.language === 'en' ? 'Allowed Payment Methods' : 'MÃ©thodes de Paiement AutorisÃ©es'}</Label>
                                <p className="text-xs text-muted-foreground">
                                  {p.language === 'en' 
                                    ? 'If none selected, all payment methods are allowed. Select specific methods to restrict this pass.'
                                    : 'Si aucune n\'est sÃ©lectionnÃ©e, toutes les mÃ©thodes de paiement sont autorisÃ©es. SÃ©lectionnez des mÃ©thodes spÃ©cifiques pour restreindre ce pass.'}
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="pm-online"
                                      checked={p.newPassForm.allowed_payment_methods.includes('online')}
                                      onCheckedChange={(checked) => {
                                        const methods = checked
                                          ? [...p.newPassForm.allowed_payment_methods, 'online']
                                          : p.newPassForm.allowed_payment_methods.filter(m => m !== 'online');
                                        p.setNewPassForm({ ...p.newPassForm, allowed_payment_methods: methods });
                                      }}
                                    />
                                    <Label htmlFor="pm-online" className="text-sm font-normal cursor-pointer">
                                      {p.language === 'en' ? 'Online Payment' : 'Paiement en ligne'}
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="pm-external-app"
                                      checked={p.newPassForm.allowed_payment_methods.includes('external_app')}
                                      onCheckedChange={(checked) => {
                                        const methods = checked
                                          ? [...p.newPassForm.allowed_payment_methods, 'external_app']
                                          : p.newPassForm.allowed_payment_methods.filter(m => m !== 'external_app');
                                        p.setNewPassForm({ ...p.newPassForm, allowed_payment_methods: methods });
                                      }}
                                    />
                                    <Label htmlFor="pm-external-app" className="text-sm font-normal cursor-pointer">
                                      {p.language === 'en' ? 'External App' : 'Application externe'}
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="pm-ambassador-cash"
                                      checked={p.newPassForm.allowed_payment_methods.includes('ambassador_cash')}
                                      onCheckedChange={(checked) => {
                                        const methods = checked
                                          ? [...p.newPassForm.allowed_payment_methods, 'ambassador_cash']
                                          : p.newPassForm.allowed_payment_methods.filter(m => m !== 'ambassador_cash');
                                        p.setNewPassForm({ ...p.newPassForm, allowed_payment_methods: methods });
                                      }}
                                    />
                                    <Label htmlFor="pm-ambassador-cash" className="text-sm font-normal cursor-pointer">
                                      {p.language === 'en' ? 'Cash on Delivery (Ambassador)' : 'Paiement Ã  la livraison (Ambassadeur)'}
                                    </Label>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => p.setNewPassForm(null)}
                                >
                                  {p.language === 'en' ? 'Cancel' : 'Annuler'}
                                </Button>
                                <Button
                                  onClick={async () => {
                                    if (!p.eventForPassManagement?.id) return;
                                    if (!p.newPassForm.name.trim()) {
                                      toast({
                                        title: p.t.error,
                                        description: p.language === 'en' ? 'Pass name is required' : 'Le nom du pass est requis',
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    if (!p.newPassForm.price || p.newPassForm.price <= 0) {
                                      toast({
                                        title: p.t.error,
                                        description: p.language === 'en' ? 'Price must be greater than 0' : 'Le prix doit Ãªtre supÃ©rieur Ã  0',
                                        variant: "destructive",
                                      });
                                      return;
                                    }

                                    try {
                                      // If setting as primary, unset all other primary passes first
                                      if (p.newPassForm.is_primary) {
                                        const passesToUpdate = p.passesForManagement
                                          .filter(p => p.id && p.is_primary)
                                          .map(p => p.id);
                                        
                                        for (const passId of passesToUpdate) {
                                          await supabase
                                            .from('event_passes')
                                            .update({ is_primary: false })
                                            .eq('id', passId);
                                        }
                                      }

                                      // Insert new pass
                                      // Normalize allowed_payment_methods: empty array = NULL (all methods allowed)
                                      const allowedPaymentMethods = p.newPassForm.allowed_payment_methods.length > 0
                                        ? p.newPassForm.allowed_payment_methods
                                        : null;

                                      const { data: newPass, error: insertError } = await supabase
                                        .from('event_passes')
                                        .insert({
                                          event_id: p.eventForPassManagement.id,
                                          name: p.newPassForm.name.trim(),
                                          price: Number(p.newPassForm.price.toFixed(2)),
                                          description: p.newPassForm.description || '',
                                          is_primary: p.newPassForm.is_primary,
                                          allowed_payment_methods: allowedPaymentMethods
                                        })
                                        .select()
                                        .single();

                                      if (insertError) throw insertError;

                                      // Refresh passes list
                                      // Use getApiBaseUrl() for consistent API routing
                                      const apiBase = getApiBaseUrl();
                                      const passesResponse = await fetch(`${apiBase}/api/admin/passes/${p.eventForPassManagement.id}`, {
                                        credentials: 'include'
                                      });
                                      
                                      if (passesResponse.ok) {
                                        const passesResult = await passesResponse.json();
                                        const passesWithStock = (passesResult.passes || []).map((p: any) => ({
                                          id: p.id,
                                          name: p.name || '',
                                          price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
                                          description: p.description || '',
                                          is_primary: p.is_primary || false,
                                          max_quantity: p.max_quantity,
                                          sold_quantity: p.sold_quantity || 0,
                                          remaining_quantity: p.remaining_quantity,
                                          is_unlimited: p.is_unlimited || false,
                                          is_active: p.is_active !== undefined ? p.is_active : true,
                                          is_sold_out: p.is_sold_out || false,
                                          allowed_payment_methods: p.allowed_payment_methods || null
                                        }));
                                        p.setPassesForManagement(passesWithStock);
                                      }

                                      p.setNewPassForm(null);
                                      toast({
                                        title: p.t.success || (p.language === 'en' ? 'Success' : 'SuccÃ¨s'),
                                        description: p.language === 'en' ? 'Pass created successfully' : 'Pass crÃ©Ã© avec succÃ¨s',
                                      });
                                    } catch (error: any) {
                                      toast({
                                        title: p.t.error,
                                        description: error.message || (p.language === 'en' ? 'Failed to create pass' : 'Ã‰chec de la crÃ©ation du pass'),
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  <Save className="w-4 h-4 mr-2" />
                                  {p.language === 'en' ? 'Create Pass' : 'CrÃ©er Pass'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {p.isPassManagementLoading ? (
                          <div className="text-center py-8">
                            <Loader size="lg" className="mx-auto mb-4" />
                            <p className="text-muted-foreground">{p.language === 'en' ? 'Loading passes...' : 'Chargement des passes...'}</p>
                          </div>
                        ) : p.passesForManagement.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>{p.language === 'en' ? 'No passes found for this event' : 'Aucun pass trouvÃ© pour cet Ã©vÃ©nement'}</p>
                          </div>
                        ) : (
                          p.passesForManagement.map((pass, index) => (
                            <Card key={pass.id || index} className="border-border">
                              <CardContent className="p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      {pass.is_primary && (
                                        <Badge variant="default" className="text-xs">
                                          {p.language === 'en' ? 'PRIMARY' : 'PRINCIPAL'}
                                        </Badge>
                                      )}
                                      <h4 className="text-lg font-semibold">{pass.name}</h4>
                                      <span className="text-lg font-bold text-primary">{pass.price.toFixed(2)} TND</span>
                                    </div>
                                    {pass.description && (
                                      <p className="text-sm text-muted-foreground mb-3">{pass.description}</p>
                                    )}
                                  </div>
                                  {pass.id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        if (!pass.id || !p.eventForPassManagement?.id) return;
                                        
                                        // Check if pass has sold tickets
                                        if (pass.sold_quantity && pass.sold_quantity > 0) {
                                          toast({
                                            title: p.t.error,
                                            description: p.language === 'en' 
                                              ? `Cannot delete pass "${pass.name}" - ${pass.sold_quantity} ticket(s) already sold. Deactivate it instead.`
                                              : `Impossible de supprimer le pass "${pass.name}" - ${pass.sold_quantity} billet(s) dÃ©jÃ  vendu(s). DÃ©sactivez-le plutÃ´p.t.`,
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        
                                        p.setConfirmDelete({ kind: 'delete-pass', passId: pass.id, passName: pass.name, eventId: p.eventForPassManagement.id });
                                      }}
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                
                                {/* Stock Display */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      {p.language === 'en' ? 'Sold' : 'Vendus'}
                                    </Label>
                                    <p className="text-lg font-bold">{pass.sold_quantity || 0}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      {p.language === 'en' ? 'Remaining' : 'Restants'}
                                    </Label>
                                    <p className="text-lg font-bold text-primary">
                                      {pass.is_unlimited 
                                        ? (p.language === 'en' ? 'Unlimited' : 'IllimitÃ©')
                                        : (pass.remaining_quantity ?? 0)}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      {p.language === 'en' ? 'Status' : 'Statut'}
                                    </Label>
                                    <div className="flex items-center gap-2 mt-1">
                                      {pass.is_sold_out && (
                                        <Badge variant="destructive" className="text-xs">
                                          {p.language === 'en' ? 'Sold Out' : 'Ã‰puisÃ©'}
                                        </Badge>
                                      )}
                                      {pass.is_unlimited && (
                                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                          {p.language === 'en' ? 'Unlimited' : 'IllimitÃ©'}
                                        </Badge>
                                      )}
                                      {!pass.is_active && (
                                        <Badge variant="secondary" className="text-xs">
                                          {p.language === 'en' ? 'Inactive' : 'Inactif'}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Payment Method Restrictions */}
                                {pass.id && (
                                  <div className="space-y-2 p-3 bg-muted/20 rounded-lg border">
                                    <Label className="text-sm font-semibold">
                                      {p.language === 'en' ? 'Allowed Payment Methods' : 'MÃ©thodes de Paiement AutorisÃ©es'}
                                    </Label>
                                    <p className="text-xs text-muted-foreground mb-2">
                                      {p.language === 'en' 
                                        ? 'If none selected, all payment methods are allowed. Select specific methods to restrict this pass.'
                                        : 'Si aucune n\'est sÃ©lectionnÃ©e, toutes les mÃ©thodes de paiement sont autorisÃ©es. SÃ©lectionnez des mÃ©thodes spÃ©cifiques pour restreindre ce pass.'}
                                    </p>
                                    <div className="space-y-2">
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`pm-online-${pass.id}`}
                                          checked={(pass.allowed_payment_methods || []).includes('online')}
                                          onCheckedChange={async (checked) => {
                                            if (!pass.id) return;
                                            const currentMethods = pass.allowed_payment_methods || [];
                                            const newMethods = checked
                                              ? [...currentMethods, 'online']
                                              : currentMethods.filter(m => m !== 'online');
                                            
                                            try {
                                              const apiBase = getApiBaseUrl();
                                              const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/payment-methods`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ 
                                                  allowed_payment_methods: newMethods.length > 0 ? newMethods : null 
                                                })
                                              });
                                              
                                              if (!response.ok) {
                                                const error = await response.json();
                                                toast({
                                                  title: p.t.error,
                                                  description: error.error || error.details || (p.language === 'en' ? 'Failed to update payment methods' : 'Ã‰chec de la mise Ã  jour des mÃ©thodes de paiement'),
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              
                                              const result = await response.json();
                                              const updatedPasses = [...p.passesForManagement];
                                              updatedPasses[index] = {
                                                ...pass,
                                                allowed_payment_methods: result.pass.allowed_payment_methods || null
                                              };
                                              p.setPassesForManagement(updatedPasses);
                                              
                                              toast({
                                                title: p.t.success || (p.language === 'en' ? 'Success' : 'SuccÃ¨s'),
                                                description: p.language === 'en' ? 'Payment methods updated' : 'MÃ©thodes de paiement mises Ã  jour',
                                              });
                                            } catch (error: any) {
                                              toast({
                                                title: p.t.error,
                                                description: error.message || (p.language === 'en' ? 'Failed to update payment methods' : 'Ã‰chec de la mise Ã  jour des mÃ©thodes de paiement'),
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                        />
                                        <Label htmlFor={`pm-online-${pass.id}`} className="text-sm font-normal cursor-pointer">
                                          {p.language === 'en' ? 'Online Payment' : 'Paiement en ligne'}
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`pm-external-app-${pass.id}`}
                                          checked={(pass.allowed_payment_methods || []).includes('external_app')}
                                          onCheckedChange={async (checked) => {
                                            if (!pass.id) return;
                                            const currentMethods = pass.allowed_payment_methods || [];
                                            const newMethods = checked
                                              ? [...currentMethods, 'external_app']
                                              : currentMethods.filter(m => m !== 'external_app');
                                            
                                            try {
                                              const apiBase = getApiBaseUrl();
                                              const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/payment-methods`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ 
                                                  allowed_payment_methods: newMethods.length > 0 ? newMethods : null 
                                                })
                                              });
                                              
                                              if (!response.ok) {
                                                const error = await response.json();
                                                toast({
                                                  title: p.t.error,
                                                  description: error.error || error.details || (p.language === 'en' ? 'Failed to update payment methods' : 'Ã‰chec de la mise Ã  jour des mÃ©thodes de paiement'),
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              
                                              const result = await response.json();
                                              const updatedPasses = [...p.passesForManagement];
                                              updatedPasses[index] = {
                                                ...pass,
                                                allowed_payment_methods: result.pass.allowed_payment_methods || null
                                              };
                                              p.setPassesForManagement(updatedPasses);
                                              
                                              toast({
                                                title: p.t.success || (p.language === 'en' ? 'Success' : 'SuccÃ¨s'),
                                                description: p.language === 'en' ? 'Payment methods updated' : 'MÃ©thodes de paiement mises Ã  jour',
                                              });
                                            } catch (error: any) {
                                              toast({
                                                title: p.t.error,
                                                description: error.message || (p.language === 'en' ? 'Failed to update payment methods' : 'Ã‰chec de la mise Ã  jour des mÃ©thodes de paiement'),
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                        />
                                        <Label htmlFor={`pm-external-app-${pass.id}`} className="text-sm font-normal cursor-pointer">
                                          {p.language === 'en' ? 'External App' : 'Application externe'}
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`pm-ambassador-cash-${pass.id}`}
                                          checked={(pass.allowed_payment_methods || []).includes('ambassador_cash')}
                                          onCheckedChange={async (checked) => {
                                            if (!pass.id) return;
                                            const currentMethods = pass.allowed_payment_methods || [];
                                            const newMethods = checked
                                              ? [...currentMethods, 'ambassador_cash']
                                              : currentMethods.filter(m => m !== 'ambassador_cash');
                                            
                                            try {
                                              const apiBase = getApiBaseUrl();
                                              const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/payment-methods`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ 
                                                  allowed_payment_methods: newMethods.length > 0 ? newMethods : null 
                                                })
                                              });
                                              
                                              if (!response.ok) {
                                                const error = await response.json();
                                                toast({
                                                  title: p.t.error,
                                                  description: error.error || error.details || (p.language === 'en' ? 'Failed to update payment methods' : 'Ã‰chec de la mise Ã  jour des mÃ©thodes de paiement'),
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              
                                              const result = await response.json();
                                              const updatedPasses = [...p.passesForManagement];
                                              updatedPasses[index] = {
                                                ...pass,
                                                allowed_payment_methods: result.pass.allowed_payment_methods || null
                                              };
                                              p.setPassesForManagement(updatedPasses);
                                              
                                              toast({
                                                title: p.t.success || (p.language === 'en' ? 'Success' : 'SuccÃ¨s'),
                                                description: p.language === 'en' ? 'Payment methods updated' : 'MÃ©thodes de paiement mises Ã  jour',
                                              });
                                            } catch (error: any) {
                                              toast({
                                                title: p.t.error,
                                                description: error.message || (p.language === 'en' ? 'Failed to update payment methods' : 'Ã‰chec de la mise Ã  jour des mÃ©thodes de paiement'),
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                        />
                                        <Label htmlFor={`pm-ambassador-cash-${pass.id}`} className="text-sm font-normal cursor-pointer">
                                          {p.language === 'en' ? 'Cash on Delivery (Ambassador)' : 'Paiement Ã  la livraison (Ambassadeur)'}
                                        </Label>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Stock Limit Control */}
                                <div className="space-y-4">
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      id={`pm-unlimited-${pass.id}-${index}`}
                                      checked={pass.is_unlimited || false}
                                      disabled={!pass.id}
                                      onCheckedChange={async (checked) => {
                                        if (!pass.id) return;
                                        
                                        try {
                                          // Use getApiBaseUrl() for consistent API routing
                                          const apiBase = getApiBaseUrl();
                                          const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/stock`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({ max_quantity: checked ? null : 100 })
                                          });
                                          
                                          if (!response.ok) {
                                            const error = await response.json();
                                            toast({
                                              title: p.t.error,
                                              description: error.error || error.details || (p.language === 'en' ? 'Failed to update stock' : 'Ã‰chec de la mise Ã  jour du stock'),
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          
                                          const result = await response.json();
                                          const updatedPass = result.pass;
                                          
                                          // Update local state
                                          const updatedPasses = [...p.passesForManagement];
                                          updatedPasses[index] = {
                                            ...pass,
                                            max_quantity: updatedPass.max_quantity,
                                            remaining_quantity: updatedPass.remaining_quantity,
                                            is_unlimited: updatedPass.is_unlimited
                                          };
                                          p.setPassesForManagement(updatedPasses);
                                          
                                          toast({
                                            title: p.t.success || (p.language === 'en' ? 'Success' : 'SuccÃ¨s'),
                                            description: p.language === 'en' 
                                              ? 'Stock limit updated' 
                                              : 'Limite de stock mise Ã  jour',
                                          });
                                        } catch (error: any) {
                                          toast({
                                            title: p.t.error,
                                            description: error.message || (p.language === 'en' ? 'Failed to update stock' : 'Ã‰chec de la mise Ã  jour du stock'),
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`pm-unlimited-${pass.id}-${index}`} className="text-sm font-medium cursor-pointer">
                                      {p.language === 'en' ? 'Unlimited Stock' : 'Stock IllimitÃ©'}
                                    </Label>
                                  </div>
                                  
                                  {!pass.is_unlimited && (
                                    <div>
                                      <Label htmlFor={`pm-max-quantity-${pass.id}-${index}`}>
                                        {p.language === 'en' ? 'Max Stock' : 'Stock Maximum'}
                                      </Label>
                                      <div className="flex gap-2">
                                        <Input
                                          id={`pm-max-quantity-${pass.id}-${index}`}
                                          type="number"
                                          min={pass.sold_quantity || 0}
                                          value={pass.max_quantity !== null && pass.max_quantity !== undefined ? pass.max_quantity : ''}
                                          disabled={!pass.id}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            const numValue = value === '' ? null : parseInt(value);
                                            const updatedPasses = [...p.passesForManagement];
                                            updatedPasses[index] = {
                                              ...pass,
                                              max_quantity: numValue,
                                              is_unlimited: numValue === null
                                            };
                                            p.setPassesForManagement(updatedPasses);
                                          }}
                                          placeholder={p.language === 'en' ? 'Enter max stock' : 'Entrez le stock max'}
                                          className="flex-1"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={!pass.id}
                                          onClick={async () => {
                                            if (!pass.id) return;
                                            const maxQty = pass.max_quantity;
                                            
                                            if (maxQty !== null && maxQty !== undefined && maxQty < (pass.sold_quantity || 0)) {
                                              toast({
                                                title: p.t.error,
                                                description: p.language === 'en' 
                                                  ? `Cannot set max stock below sold quantity (${pass.sold_quantity})` 
                                                  : `Impossible de dÃ©finir le stock max en dessous de la quantitÃ© vendue (${pass.sold_quantity})`,
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            
                                            try {
                                              // Use getApiBaseUrl() for consistent API routing
                                              const apiBase = getApiBaseUrl();
                                              const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/stock`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ max_quantity: maxQty })
                                              });
                                              
                                              if (!response.ok) {
                                                const error = await response.json();
                                                toast({
                                                  title: p.t.error,
                                                  description: error.error || error.details || (p.language === 'en' ? 'Failed to update stock' : 'Ã‰chec de la mise Ã  jour du stock'),
                                                  variant: "destructive",
                                                });
                                                return;
                                              }
                                              
                                              const result = await response.json();
                                              const updatedPass = result.pass;
                                              
                                              // Update local state
                                              const updatedPasses = [...p.passesForManagement];
                                              updatedPasses[index] = {
                                                ...pass,
                                                max_quantity: updatedPass.max_quantity,
                                                remaining_quantity: updatedPass.remaining_quantity,
                                                is_unlimited: updatedPass.is_unlimited
                                              };
                                              p.setPassesForManagement(updatedPasses);
                                              
                                              toast({
                                                title: p.t.success || (p.language === 'en' ? 'Success' : 'SuccÃ¨s'),
                                                description: p.language === 'en' 
                                                  ? 'Stock limit updated successfully' 
                                                  : 'Limite de stock mise Ã  jour avec succÃ¨s',
                                              });
                                            } catch (error: any) {
                                              toast({
                                                title: p.t.error,
                                                description: error.message || (p.language === 'en' ? 'Failed to update stock' : 'Ã‰chec de la mise Ã  jour du stock'),
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                        >
                                          <Save className="w-4 h-4 mr-2" />
                                          {p.language === 'en' ? 'Save' : 'Enregistrer'}
                                        </Button>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {p.language === 'en' 
                                          ? `Minimum: ${pass.sold_quantity || 0} (cannot be below sold quantity)` 
                                          : `Minimum: ${pass.sold_quantity || 0} (ne peut pas Ãªtre en dessous de la quantitÃ© vendue)`}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Activate/Deactivate Pass */}
                                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div>
                                      <Label className="text-sm font-medium">
                                        {p.language === 'en' ? 'Pass Status' : 'Statut du Pass'}
                                      </Label>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {pass.is_active 
                                          ? (p.language === 'en' ? 'Active - visible to customers' : 'Actif - visible par les clients')
                                          : (p.language === 'en' ? 'Inactive - hidden from customers' : 'Inactif - cachÃ© aux clients')}
                                      </p>
                                    </div>
                                    <Switch
                                      checked={pass.is_active !== false}
                                      disabled={!pass.id}
                                      onCheckedChange={async (checked) => {
                                        if (!pass.id) return;
                                        
                                        try {
                                          // Use getApiBaseUrl() for consistent API routing
                                          const apiBase = getApiBaseUrl();
                                          const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/activate`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({ is_active: checked })
                                          });
                                          
                                          if (!response.ok) {
                                            const error = await response.json();
                                            toast({
                                              title: p.t.error,
                                              description: error.error || error.details || (p.language === 'en' ? 'Failed to update pass status' : 'Ã‰chec de la mise Ã  jour du statut'),
                                              variant: "destructive",
                                            });
                                            return;
                                          }
                                          
                                          // Update local state
                                          const updatedPasses = [...p.passesForManagement];
                                          updatedPasses[index] = {
                                            ...pass,
                                            is_active: checked
                                          };
                                          p.setPassesForManagement(updatedPasses);
                                          
                                          toast({
                                            title: p.t.success || (p.language === 'en' ? 'Success' : 'SuccÃ¨s'),
                                            description: p.language === 'en' 
                                              ? `Pass ${checked ? 'activated' : 'deactivated'} successfully` 
                                              : `Pass ${checked ? 'activÃ©' : 'dÃ©sactivÃ©'} avec succÃ¨s`,
                                          });
                                        } catch (error: any) {
                                          toast({
                                            title: p.t.error,
                                            description: error.message || (p.language === 'en' ? 'Failed to update pass status' : 'Ã‰chec de la mise Ã  jour du statut'),
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                      <div className="flex justify-end gap-2 mt-6">
                        <DialogClose asChild>
                          <Button variant="outline">
                            {p.language === 'en' ? 'Close' : 'Fermer'}
                          </Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {p.events.map((event, index) => (
                    <Card 
                      key={event.id}
                      className={`transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg ${
                        p.animatedEvents.has(event.id) 
                          ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                          : 'opacity-0 translate-y-8'
                      } ${event.featured ? 'ring-2 ring-primary/20 shadow-lg' : ''}`}
                    >
                      <CardContent className="p-6">
                        {event.poster_url && (
                          <div className="relative">
                            <img 
                              src={event.poster_url} 
                              alt={event.name} 
                              className="w-full h-48 object-cover rounded-lg mb-4 transform transition-transform duration-300 hover:scale-105" 
                            />
                            {event.featured && (
                              <Badge className="absolute top-2 right-2 bg-gradient-primary animate-pulse">
                                Featured
                              </Badge>
                            )}
                          </div>
                        )}
                        <h3 className="text-lg font-semibold mb-2 animate-in slide-in-from-left-4 duration-500 delay-200">
                          {event.name}
                        </h3>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-300">
                            <CalendarIcon className="w-4 h-4 animate-pulse" />
                            <span>{new Date(event.date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-400">
                            <MapPin className="w-4 h-4 animate-pulse" />
                            <span>{event.venue}, {event.city}</span>
                          </div>
                          {event.passes && event.passes.length > 0 && (
                            <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-500">
                              <DollarSign className="w-4 h-4 animate-pulse" />
                              <span>
                                {event.passes.length} {p.language === 'en' ? 'pass(es)' : 'pass(es)'} available
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-stretch gap-3 mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-700">
                          {/* Row 1: Edit + Convert to Gallery (modify event) */}
                          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 p-2 shadow-sm">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 min-w-[7rem] px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground rounded-sm transition-all duration-200"
                              onClick={async () => {
                              // Always fetch fresh passes from database to get current values
                              const { data: passesData, error: passesError } = await supabase
                                .from('event_passes')
                                .select('*')
                                .eq('event_id', event.id)
                                .order('is_primary', { ascending: false })
                                .order('created_at', { ascending: true });
                              
                              
                              // Handle 404 errors gracefully (table might not exist yet)
                              if (passesError && passesError.code !== 'PGRST116' && passesError.message !== 'relation "public.event_passes" does not exist') {
                                console.error(`Error fetching passes for event ${event.id}:`, passesError);
                              }
                              
                              // Map database passes to EventPass format with all current values
                              const mappedPasses = (passesData || []).map((p: any) => {
                                const mapped = {
                                  id: p.id,
                                  name: p.name || '',
                                  price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
                                  description: p.description || '',
                                  is_primary: p.is_primary || false
                                };
                                return mapped;
                              });
                              
                              const finalPasses = mappedPasses;
                              
                              // Create event with all current pass values from database
                              // Create a new object without the passes property first, then add it explicitly
                              const { passes: _, ...eventWithoutPasses } = event;
                              const eventWithPasses: Event = { 
                                ...eventWithoutPasses,
                                passes: finalPasses, // Explicitly set passes - this ensures it's not empty
                                instagram_link: event.instagram_link || event.whatsapp_link
                              };
                              
                              
                              // Clear pending files and validation errors when opening edit dialog
                              p.setPendingGalleryImages([]);
                              p.setPendingGalleryVideos([]);
                              p.setPassValidationErrors({});
                              
                              // Set p.editingEvent first, then open dialog after a microtask
                              // This ensures the state is set before the dialog renders
                              p.setEditingEvent(eventWithPasses);
                              
                              
                              // Use setTimeout to ensure state update completes before dialog opens
                              // This prevents the dialog from rendering with stale/empty passes
                              setTimeout(() => {
                                p.setIsEventDialogOpen(true);
                              }, 0);
                            }}
                          >
                            <Edit className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            {p.t.edit}
                          </Button>
                          {(() => {
                            const isUpcoming = event.event_type === 'upcoming' || !event.event_type;
                            const eventDate = new Date(event.date);
                            const now = new Date();
                            const eventHasPassed = eventDate.getTime() < now.getTime();
                            return isUpcoming && eventHasPassed;
                          })() && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 min-w-[7rem] px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground rounded-sm transition-all duration-200"
                              title={p.t.convertToGalleryTooltip || (p.language === 'en' ? 'Move to gallery and add images/videos. Orders and statistics are kept.' : 'DÃ©placer vers la galerie. Commandes et statistiques conservÃ©es.')}
                              onClick={async () => {
                                const { data: passesData, error: passesError } = await supabase
                                  .from('event_passes')
                                  .select('*')
                                  .eq('event_id', event.id)
                                  .order('is_primary', { ascending: false })
                                  .order('created_at', { ascending: true });
                                if (passesError && passesError.code !== 'PGRST116' && passesError.message !== 'relation "public.event_passes" does not exist') {
                                  console.error(`Error fetching passes for event ${event.id}:`, passesError);
                                }
                                const mappedPasses = (passesData || []).map((p: any) => ({
                                  id: p.id,
                                  name: p.name || '',
                                  price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
                                  description: p.description || '',
                                  is_primary: p.is_primary || false
                                }));
                                const { passes: _, ...eventWithoutPasses } = event;
                                const eventWithPasses: Event = {
                                  ...eventWithoutPasses,
                                  passes: mappedPasses,
                                  instagram_link: event.instagram_link || event.whatsapp_link,
                                  event_type: 'gallery',
                                  gallery_images: event.gallery_images || [],
                                  gallery_videos: event.gallery_videos || []
                                };
                                p.setPendingGalleryImages([]);
                                p.setPendingGalleryVideos([]);
                                p.setPassValidationErrors({});
                                p.setEditingEvent(eventWithPasses);
                                setTimeout(() => p.setIsEventDialogOpen(true), 0);
                              }}
                            >
                              <ImagePlus className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                              {p.t.convertToGallery || (p.language === 'en' ? 'Convert to Gallery' : 'Convertir en Galerie')}
                            </Button>
                          )}
                          </div>
                          {/* Row 2: Pass Stock (stock management - separate task) */}
                          <div className="rounded-md border border-border/50 bg-muted/30 p-2 shadow-sm">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-full min-w-[7rem] px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground rounded-sm transition-all duration-200 justify-start"
                              onClick={async () => {
                              p.setIsPassManagementLoading(true);
                              try {
                                // Fetch passes with stock info from admin API
                                // Use getApiBaseUrl() for consistent API routing
                                const apiBase = getApiBaseUrl();
                                const passesResponse = await fetch(`${apiBase}/api/admin/passes/${event.id}`, {
                                  credentials: 'include'
                                });
                                
                                if (passesResponse.ok) {
                                  const passesResult = await passesResponse.json();
                                  const passesWithStock = (passesResult.passes || []).map((p: any) => ({
                                    id: p.id,
                                    name: p.name || '',
                                    price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
                                    description: p.description || '',
                                    is_primary: p.is_primary || false,
                                    max_quantity: p.max_quantity,
                                    sold_quantity: p.sold_quantity || 0,
                                    remaining_quantity: p.remaining_quantity,
                                    is_unlimited: p.is_unlimited || false,
                                    is_active: p.is_active !== undefined ? p.is_active : true,
                                    is_sold_out: p.is_sold_out || false
                                  }));
                                  p.setPassesForManagement(passesWithStock);
                                  p.setEventForPassManagement(event);
                                  p.setIsPassManagementDialogOpen(true);
                                } else {
                                  toast({
                                    title: p.t.error,
                                    description: p.language === 'en' ? 'Failed to load passes' : 'Ã‰chec du chargement des passes',
                                    variant: "destructive",
                                  });
                                }
                              } catch (error: any) {
                                toast({
                                  title: p.t.error,
                                  description: error.message || (p.language === 'en' ? 'Failed to load passes' : 'Ã‰chec du chargement des passes'),
                                  variant: "destructive",
                                });
                              } finally {
                                p.setIsPassManagementLoading(false);
                              }
                            }}
                          >
                            <Package className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                            {p.language === 'en' ? 'Pass Stock' : 'Stock Passes'}
                          </Button>
                          </div>
                          {/* Row 3: Delete (critical action - isolated) */}
                          <div className="rounded-md border border-border/50 border-destructive/30 bg-muted/30 p-2 shadow-sm">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => p.handleDeleteEvent(event.id)}
                              className="h-8 w-full min-w-[7rem] px-3 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-sm transition-all duration-200 justify-start"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                              {p.t.delete}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {p.events.length === 0 && (
                  <div className="text-center py-8 animate-in fade-in duration-500">
                    <p className="text-muted-foreground animate-pulse">{p.t.noEvents}</p>
                  </div>
                )}
    </TabsContent>
  );
}

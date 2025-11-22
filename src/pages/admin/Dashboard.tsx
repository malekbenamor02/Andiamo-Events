import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FileUpload from "@/components/ui/file-upload";
import { uploadImage, uploadHeroImage, deleteHeroImage } from "@/lib/upload";
import { uploadFavicon, deleteFavicon, fetchFaviconSettings } from "@/lib/favicon";
import { uploadOGImage, deleteOGImage, fetchOGImageSettings } from "@/lib/og-image";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createApprovalEmail, createRejectionEmail, generatePassword, sendEmail } from "@/lib/email";
import {
  CheckCircle, XCircle, Clock, Users, TrendingUp, DollarSign, LogOut,
  Plus, Edit, Trash2, Calendar, MapPin, Phone, Mail, User, Settings,
  Eye, EyeOff, Save, X, Image, Video, Upload,
  Instagram, BarChart3, FileText, Building2, Users2, MessageCircle,
  PieChart, Download, RefreshCw, Copy, Wrench, ArrowUp, ArrowDown, 
  Send, Megaphone, PhoneCall, CreditCard, AlertCircle, CheckCircle2, Activity, Filter, Search,
  Shield, AlertTriangle, TrendingDown, Database, Zap, Monitor
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import bcrypt from 'bcryptjs';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useIsMobile } from "@/hooks/use-mobile";


interface AdminDashboardProps {
  language: 'en' | 'fr';
}

interface AmbassadorApplication {
  id: string;
  full_name: string;
  age: number;
  phone_number: string;
  email?: string; // Make email optional since it might not exist in database yet
  city: string;
  social_link?: string;
  motivation?: string;
  status: string;
  created_at: string;
}

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  city: string;
  description?: string;
  poster_url?: string;
  whatsapp_link?: string;
  ticket_link?: string;
  featured?: boolean;
  standard_price?: number;
  vip_price?: number;
  event_type?: 'upcoming' | 'gallery'; // New field to distinguish event types
  gallery_images?: string[]; // Array of gallery image URLs
  gallery_videos?: string[]; // Array of gallery video URLs
  created_at: string;
  updated_at: string;
  _uploadFile?: File | null;
  _galleryFiles?: File[]; // Temporary storage for gallery files
}



interface Ambassador {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  city: string;
  status: string;
  commission_rate: number;
  password?: string;
  created_at: string;
  updated_at: string;
}

interface PassPurchase {
  id: string;
  event_id: string;
  pass_type: 'standard' | 'vip';
  quantity: number;
  total_price: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_city?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded';
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  event?: {
    name: string;
    date: string;
    venue: string;
    city: string;
  };
}

const AdminDashboard = ({ language }: AdminDashboardProps) => {
  const isMobile = useIsMobile();
  const [applications, setApplications] = useState<AmbassadorApplication[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [passPurchases, setPassPurchases] = useState<PassPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Add state for email recovery
  const [emailFailedApplications, setEmailFailedApplications] = useState<Set<string>>(new Set());
  const [ambassadorCredentials, setAmbassadorCredentials] = useState<Record<string, { username: string; password: string }>>({});

  const [editingAmbassador, setEditingAmbassador] = useState<Ambassador | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [ambassadorSales, setAmbassadorSales] = useState<Record<string, { standard: number; vip: number }>>({});
  const [ambassadorToDelete, setAmbassadorToDelete] = useState<Ambassador | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isAmbassadorDialogOpen, setIsAmbassadorDialogOpen] = useState(false);

  const [sponsors, setSponsors] = useState([]);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [isSponsorDialogOpen, setIsSponsorDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sponsorToDelete, setSponsorToDelete] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  
  // Sales settings state
  const [salesEnabled, setSalesEnabled] = useState(true);
  const [loadingSalesSettings, setLoadingSalesSettings] = useState(false);

  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [loadingMaintenanceSettings, setLoadingMaintenanceSettings] = useState(false);

  // Ambassador application settings state
  const [ambassadorApplicationEnabled, setAmbassadorApplicationEnabled] = useState(true);
  const [ambassadorApplicationMessage, setAmbassadorApplicationMessage] = useState("");
  const [loadingAmbassadorApplicationSettings, setLoadingAmbassadorApplicationSettings] = useState(false);

  // Hero images state
  interface HeroImage {
    type: string;
    src: string;
    alt: string;
    path?: string;
  }
  const [heroImages, setHeroImages] = useState<HeroImage[]>([]);
  const [loadingHeroImages, setLoadingHeroImages] = useState(false);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);

  // Favicon state
  const [faviconSettings, setFaviconSettings] = useState<{
    favicon_ico?: string;
    favicon_32x32?: string;
    favicon_16x16?: string;
    apple_touch_icon?: string;
  }>({});
  const [loadingFaviconSettings, setLoadingFaviconSettings] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState<string | null>(null);

  // OG Image state
  const [ogImageSettings, setOGImageSettings] = useState<{
    og_image?: string;
  }>({});
  const [loadingOGImageSettings, setLoadingOGImageSettings] = useState(false);
  const [uploadingOGImage, setUploadingOGImage] = useState(false);

  // Marketing/SMS state
  const [phoneSubscribers, setPhoneSubscribers] = useState<Array<{id: string; phone_number: string; subscribed_at: string}>>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkPhonesInput, setBulkPhonesInput] = useState("");
  const [addingBulkPhones, setAddingBulkPhones] = useState(false);
  const [smsBalance, setSmsBalance] = useState<any>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [smsLogs, setSmsLogs] = useState<Array<{id: string; phone_number: string; message: string; status: string; error_message?: string; sent_at?: string; created_at: string}>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // --- Team Members State ---
  const [teamMembers, setTeamMembers] = useState([]);
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isDeleteTeamDialogOpen, setIsDeleteTeamDialogOpen] = useState(false);
  const [teamMemberToDelete, setTeamMemberToDelete] = useState(null);

  // Animation states
  const [hasAnimated, setHasAnimated] = useState(false);
  const [animatedCards, setAnimatedCards] = useState<Set<number>>(new Set());
  const [animatedEvents, setAnimatedEvents] = useState<Set<string>>(new Set());
  const [hasEventsAnimated, setHasEventsAnimated] = useState(false);
  const [animatedAmbassadors, setAnimatedAmbassadors] = useState<Set<string>>(new Set());
  const [hasAmbassadorsAnimated, setHasAmbassadorsAnimated] = useState(false);
  const [animatedApplications, setAnimatedApplications] = useState<Set<string>>(new Set());
  const [hasApplicationsAnimated, setHasApplicationsAnimated] = useState(false);
  const [applicationSearchTerm, setApplicationSearchTerm] = useState('');
  const [animatedSponsors, setAnimatedSponsors] = useState<Set<string>>(new Set());
  const [hasSponsorsAnimated, setHasSponsorsAnimated] = useState(false);
  const [animatedTeamMembers, setAnimatedTeamMembers] = useState<Set<string>>(new Set());
  const [hasTeamAnimated, setHasTeamAnimated] = useState(false);
  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [animatedContactMessages, setAnimatedContactMessages] = useState<Set<string>>(new Set());
  const [hasContactMessagesAnimated, setHasContactMessagesAnimated] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<any>(null);
  const [isDeleteMessageDialogOpen, setIsDeleteMessageDialogOpen] = useState(false);
  const [contactMessageSearchTerm, setContactMessageSearchTerm] = useState('');
              const [tickets, setTickets] = useState<any[]>([]);
            const [animatedTickets, setAnimatedTickets] = useState<Set<string>>(new Set());
            const [hasTicketsAnimated, setHasTicketsAnimated] = useState(false);
            const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
            const [editingTicket, setEditingTicket] = useState<any>(null);
            const [isDeleteTicketDialogOpen, setIsDeleteTicketDialogOpen] = useState(false);
            const [ticketToDelete, setTicketToDelete] = useState<any>(null);
            const [selectedEventId, setSelectedEventId] = useState<string>('');
            const [ticketStats, setTicketStats] = useState<any>({
              totalTickets: 0,
              soldTickets: 0,
              availableTickets: 0,
              revenue: 0,
              topAmbassadors: [],
              totalSold: 0,
              totalRevenue: 0,
              averagePrice: 0,
              topSellingEvent: '',
              topAmbassador: '',
              monthlySales: [],
              ticketTypeDistribution: [],
              ambassadorPerformance: []
            });

  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(2 * 60 * 60); // 2 hours in seconds

  // Site logs state
  const [siteLogs, setSiteLogs] = useState<any[]>([]);
  const [loadingSiteLogs, setLoadingSiteLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'success' | 'action'>('all');
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('all');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  
  // Analytics state
  const [logStatistics, setLogStatistics] = useState<any>(null);
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [suspiciousActivity, setSuspiciousActivity] = useState<any>(null);
  const [loadingSuspicious, setLoadingSuspicious] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleaningLogs, setCleaningLogs] = useState(false);

  const content = {
    en: {
      title: "Admin Dashboard",
      subtitle: "Manage everything - events, ambassadors, applications",
      overview: "Overview",
      events: "Events",
      ambassadors: "Ambassadors",
      applications: "Applications",
      pendingApplications: "Pending Applications",
      approvedApplications: "Approved Applications",
      totalEvents: "Total Events",
      totalRevenue: "Total Revenue",
      approve: "Approve",
      reject: "Reject",
      edit: "Edit",
      delete: "Delete",
      add: "Add New",
      save: "Save",
      cancel: "Cancel",
      approved: "Approved",
      rejected: "Rejected",
      pending: "Pending",
      processing: "Processing...",
      noApplications: "No applications found",
      noEvents: "No events found",
      noAmbassadors: "No ambassadors found",
      approvalSuccess: "Application approved successfully!",
      rejectionSuccess: "Application rejected successfully!",
      eventSaved: "Event saved successfully!",
      ambassadorSaved: "Ambassador saved successfully!",
      emailSent: "Email notification sent",
      error: "An error occurred",
      logout: "Logout",
      eventName: "Event Name",
      eventDate: "Event Date",
      eventVenue: "Venue",
      eventCity: "City",
      eventDescription: "Description",
      eventPoster: "Poster URL",
      eventWhatsappLink: "WhatsApp Link",
      eventFeatured: "Featured Event",
      eventStandardPrice: "Standard Price (TND)",
      eventVipPrice: "VIP Price (TND)",
      eventType: "Event Type",
      eventTypeUpcoming: "Upcoming Event",
      eventTypeGallery: "Gallery Event (Past Event)",
      galleryImages: "Gallery Images",
      galleryVideos: "Gallery Videos",
      uploadGalleryFiles: "Upload Gallery Files",
      addGalleryFile: "Add File",
      removeGalleryFile: "Remove",
      ambassadorName: "Full Name",
      ambassadorPhone: "Phone",
      ambassadorEmail: "Email",
      ambassadorCity: "City",
      ambassadorStatus: "Status",
      ambassadorCommission: "Commission Rate (%)",
      ambassadorPassword: "Password",
      approvedAmbassadors: "Total Ambassadors",
      passPurchases: "Pass Purchases",
      totalPurchases: "Total Purchases",
      purchaseDetails: "Purchase Details",
      customerInfo: "Customer Information",
      purchaseStatus: "Purchase Status",
      noPurchases: "No purchases found",
      settings: "Settings",
      salesSettings: "Sales Settings",
      enableSales: "Enable Sales",
      disableSales: "Disable Sales",
      salesEnabled: "Sales are currently enabled",
      salesDisabled: "Sales are currently disabled",
      salesSettingsDescription: "Control whether ambassadors can add sales. When disabled, ambassadors will see a message that sales are not open yet.",
      maintenanceSettings: "Maintenance Mode",
      enableMaintenance: "Enable Maintenance Mode",
      disableMaintenance: "Disable Maintenance Mode",
      maintenanceEnabled: "Maintenance mode is currently active",
      maintenanceDisabled: "Maintenance mode is currently inactive",
      maintenanceSettingsDescription: "Control website maintenance mode. When enabled, users will see a maintenance message and cannot access the site. Admin access is always allowed.",
      maintenanceMessage: "Maintenance Message",
      maintenanceMessagePlaceholder: "Enter a custom maintenance message (optional)",
      ambassadorApplicationSettings: "Ambassador Application Settings",
      ambassadorApplicationSettingsDescription: "Control whether users can submit ambassador applications. When disabled, users will see a message that applications are closed.",
      ambassadorApplicationEnabled: "Applications are currently open",
      ambassadorApplicationDisabled: "Applications are currently closed",
      enableAmbassadorApplication: "Enable Applications",
      disableAmbassadorApplication: "Disable Applications",
      ambassadorApplicationMessage: "Application Closed Message",
      ambassadorApplicationMessagePlaceholder: "Enter a custom message for when applications are closed (optional)",
      heroImagesSettings: "Hero Images",
      heroImagesSettingsDescription: "Manage hero images displayed on the home page. You can add, delete, and reorder images.",
      uploadHeroImage: "Upload Hero Image",
      deleteHeroImage: "Delete",
      noHeroImages: "No hero images yet. Upload an image to get started.",
      heroImageAlt: "Image Alt Text",
      reorderImages: "Reorder by dragging",
      faviconSettings: "Favicon Settings",
      faviconSettingsDescription: "Upload and manage favicon images that appear in browser tabs. Images are saved in the 'favicon' folder in storage.",
      uploadFavicon: "Upload Favicon",
      faviconIco: "Favicon (.ico)",
      favicon32x32: "Favicon 32x32",
      favicon16x16: "Favicon 16x16",
      appleTouchIcon: "Apple Touch Icon (180x180)",
      currentFavicon: "Current Favicon",
      noFavicon: "No favicon uploaded yet",
      faviconUploaded: "Favicon uploaded successfully!",
      faviconError: "Failed to upload favicon",
      deleteFavicon: "Delete Favicon",
      faviconDeleted: "Favicon deleted successfully!",
      ogImageSettings: "Social Media Preview Image",
      ogImageSettingsDescription: "Upload an image that appears when sharing your website link on social media (WhatsApp, Facebook, Twitter, etc.). Recommended size: 1200x630px.",
      uploadOGImage: "Upload Preview Image",
      currentOGImage: "Current Preview Image",
      noOGImage: "No preview image uploaded yet",
      ogImageUploaded: "Preview image uploaded successfully!",
      ogImageError: "Failed to upload preview image",
      deleteOGImage: "Delete Preview Image",
      ogImageDeleted: "Preview image deleted successfully!",
      logs: "Site Logs",
      logsTitle: "Site Activity Logs",
      logsDescription: "View all website activities, errors, and events",
      allLogs: "All Logs",
      logType: "Type",
      logCategory: "Category",
      logMessage: "Message",
      logDetails: "Details",
      logTime: "Time",
      logUser: "User",
      logPage: "Page",
      noLogs: "No logs found",
      filterByType: "Filter by Type",
      filterByCategory: "Filter by Category",
      searchLogs: "Search logs..."
    },
    fr: {
      title: "Tableau de Bord Admin",
      subtitle: "Gérer tout - événements, ambassadeurs, candidatures",
      overview: "Aperçu",
      events: "Événements",
      ambassadors: "Ambassadeurs",
      applications: "Candidatures",
      pendingApplications: "Candidatures en Attente",
      approvedApplications: "Candidatures Approuvées",
      totalEvents: "Total Événements",
      totalRevenue: "Revenus Totaux",
      approve: "Approuver",
      reject: "Rejeter",
      edit: "Modifier",
      delete: "Supprimer",
      add: "Ajouter",
      save: "Enregistrer",
      cancel: "Annuler",
      approved: "Approuvé",
      rejected: "Rejeté",
      pending: "En Attente",
      processing: "Traitement...",
      noApplications: "Aucune candidature trouvée",
      noEvents: "Aucun événement trouvé",
      noAmbassadors: "Aucun ambassadeur trouvé",
      approvalSuccess: "Candidature approuvée avec succès!",
      rejectionSuccess: "Candidature rejetée avec succès!",
      eventSaved: "Événement enregistré avec succès!",
      ambassadorSaved: "Ambassadeur enregistré avec succès!",
      emailSent: "Email de notification envoyé",
      error: "Une erreur s'est produite",
      logout: "Déconnexion",
      eventName: "Nom de l'Événement",
      eventDate: "Date de l'Événement",
      eventVenue: "Lieu",
      eventCity: "Ville",
      eventDescription: "Description",
      eventPoster: "URL de l'Affiche",
      eventWhatsappLink: "Lien WhatsApp",
      eventFeatured: "Événement en Vedette",
      eventStandardPrice: "Prix Standard (TND)",
      eventVipPrice: "Prix VIP (TND)",
      eventType: "Type d'Événement",
      eventTypeUpcoming: "Événement à Venir",
      eventTypeGallery: "Événement Galerie (Événement Passé)",
      galleryImages: "Images de Galerie",
      galleryVideos: "Vidéos de Galerie",
      uploadGalleryFiles: "Télécharger des Fichiers de Galerie",
      addGalleryFile: "Ajouter un Fichier",
      removeGalleryFile: "Supprimer",
      ambassadorName: "Nom Complet",
      ambassadorPhone: "Téléphone",
      ambassadorEmail: "Email",
      ambassadorCity: "Ville",
      ambassadorStatus: "Statut",
      ambassadorCommission: "Taux de Commission (%)",
      ambassadorPassword: "Mot de Passe",
      approvedAmbassadors: "Ambassadeurs Totaux",
      passPurchases: "Achats de Passes",
      totalPurchases: "Total des Achats",
      purchaseDetails: "Détails de l'Achat",
      customerInfo: "Informations Client",
      purchaseStatus: "Statut de l'Achat",
      noPurchases: "Aucun achat trouvé",
      settings: "Paramètres",
      salesSettings: "Paramètres de Ventes",
      enableSales: "Activer les Ventes",
      disableSales: "Désactiver les Ventes",
      salesEnabled: "Les ventes sont actuellement activées",
      salesDisabled: "Les ventes sont actuellement désactivées",
      salesSettingsDescription: "Contrôlez si les ambassadeurs peuvent ajouter des ventes. Lorsqu'elle est désactivée, les ambassadeurs verront un message indiquant que les ventes ne sont pas encore ouvertes.",
      maintenanceSettings: "Mode Maintenance",
      enableMaintenance: "Activer le Mode Maintenance",
      disableMaintenance: "Désactiver le Mode Maintenance",
      maintenanceEnabled: "Le mode maintenance est actuellement actif",
      maintenanceDisabled: "Le mode maintenance est actuellement inactif",
      maintenanceSettingsDescription: "Contrôlez le mode maintenance du site web. Lorsqu'il est activé, les utilisateurs verront un message de maintenance et ne pourront pas accéder au site. L'accès administrateur est toujours autorisé.",
      maintenanceMessage: "Message de Maintenance",
      maintenanceMessagePlaceholder: "Entrez un message de maintenance personnalisé (optionnel)",
      ambassadorApplicationSettings: "Paramètres de Candidature d'Ambassadeur",
      ambassadorApplicationSettingsDescription: "Contrôlez si les utilisateurs peuvent soumettre des candidatures d'ambassadeur. Lorsqu'elle est désactivée, les utilisateurs verront un message indiquant que les candidatures sont fermées.",
      ambassadorApplicationEnabled: "Les candidatures sont actuellement ouvertes",
      ambassadorApplicationDisabled: "Les candidatures sont actuellement fermées",
      enableAmbassadorApplication: "Ouvrir les Candidatures",
      disableAmbassadorApplication: "Fermer les Candidatures",
      ambassadorApplicationMessage: "Message de Candidature Fermée",
      ambassadorApplicationMessagePlaceholder: "Entrez un message personnalisé lorsque les candidatures sont fermées (optionnel)",
      heroImagesSettings: "Images Hero",
      heroImagesSettingsDescription: "Gérez les images hero affichées sur la page d'accueil. Vous pouvez ajouter, supprimer et réorganiser les images.",
      uploadHeroImage: "Télécharger une Image Hero",
      deleteHeroImage: "Supprimer",
      noHeroImages: "Aucune image hero pour le moment. Téléchargez une image pour commencer.",
      heroImageAlt: "Texte Alternatif de l'Image",
      reorderImages: "Réorganiser en faisant glisser",
      faviconSettings: "Paramètres du Favicon",
      faviconSettingsDescription: "Téléchargez et gérez les images de favicon qui apparaissent dans les onglets du navigateur. Les images sont enregistrées dans le dossier 'favicon' dans le stockage.",
      uploadFavicon: "Télécharger le Favicon",
      faviconIco: "Favicon (.ico)",
      favicon32x32: "Favicon 32x32",
      favicon16x16: "Favicon 16x16",
      appleTouchIcon: "Icône Apple Touch (180x180)",
      currentFavicon: "Favicon Actuel",
      noFavicon: "Aucun favicon téléchargé",
      faviconUploaded: "Favicon téléchargé avec succès !",
      faviconError: "Échec du téléchargement du favicon",
      deleteFavicon: "Supprimer le Favicon",
      faviconDeleted: "Favicon supprimé avec succès !",
      ogImageSettings: "Image d'Aperçu des Réseaux Sociaux",
      ogImageSettingsDescription: "Téléchargez une image qui apparaît lors du partage du lien de votre site sur les réseaux sociaux (WhatsApp, Facebook, Twitter, etc.). Taille recommandée: 1200x630px.",
      uploadOGImage: "Télécharger l'Image d'Aperçu",
      currentOGImage: "Image d'Aperçu Actuelle",
      noOGImage: "Aucune image d'aperçu téléchargée",
      ogImageUploaded: "Image d'aperçu téléchargée avec succès !",
      ogImageError: "Échec du téléchargement de l'image d'aperçu",
      deleteOGImage: "Supprimer l'Image d'Aperçu",
      ogImageDeleted: "Image d'aperçu supprimée avec succès !",
      logs: "Journaux du Site",
      logsTitle: "Journaux d'Activité du Site",
      logsDescription: "Voir toutes les activités, erreurs et événements du site",
      allLogs: "Tous les Journaux",
      logType: "Type",
      logCategory: "Catégorie",
      logMessage: "Message",
      logDetails: "Détails",
      logTime: "Heure",
      logUser: "Utilisateur",
      logPage: "Page",
      noLogs: "Aucun journal trouvé",
      filterByType: "Filtrer par Type",
      filterByCategory: "Filtrer par Catégorie",
      searchLogs: "Rechercher dans les journaux..."
    }
  };

  const t = content[language];

  useEffect(() => {
    fetchAllData();
  }, []);

  // Animation effect for overview cards
  useEffect(() => {
    if (activeTab === "overview" && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
        // Animate cards one by one
        const cards = [0, 1, 2, 3];
        cards.forEach((cardIndex, index) => {
          setTimeout(() => {
            setAnimatedCards(prev => new Set([...prev, cardIndex]));
          }, index * 200); // 200ms delay between each card
        });
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Reset animation when switching away from overview
    if (activeTab !== "overview") {
      setHasAnimated(false);
      setAnimatedCards(new Set());
    }
  }, [activeTab, hasAnimated]);

  // Animation effect for events
  useEffect(() => {
    if (activeTab === "events" && !hasEventsAnimated) {
      const timer = setTimeout(() => {
        setHasEventsAnimated(true);
        // Animate events one by one
        events.forEach((event, index) => {
          setTimeout(() => {
            setAnimatedEvents(prev => new Set([...prev, event.id]));
          }, index * 150); // 150ms delay between each event
        });
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Reset animation when switching away from events
    if (activeTab !== "events") {
      setHasEventsAnimated(false);
      setAnimatedEvents(new Set());
    }
  }, [activeTab, hasEventsAnimated, events]);

  // Animation effect for ambassadors
  useEffect(() => {
    if (activeTab === "ambassadors" && !hasAmbassadorsAnimated) {
      const timer = setTimeout(() => {
        setHasAmbassadorsAnimated(true);
        // Animate ambassadors one by one
        ambassadors.forEach((ambassador, index) => {
          setTimeout(() => {
            setAnimatedAmbassadors(prev => new Set([...prev, ambassador.id]));
          }, index * 150); // 150ms delay between each ambassador
        });
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Reset animation when switching away from ambassadors
    if (activeTab !== "ambassadors") {
      setHasAmbassadorsAnimated(false);
      setAnimatedAmbassadors(new Set());
    }
  }, [activeTab, hasAmbassadorsAnimated, ambassadors]);

  // Animation effect for applications
  useEffect(() => {
    if (activeTab === "applications" && !hasApplicationsAnimated) {
      const timer = setTimeout(() => {
        setHasApplicationsAnimated(true);
        // Animate applications one by one
        filteredApplications.forEach((application, index) => {
          setTimeout(() => {
            setAnimatedApplications(prev => new Set([...prev, application.id]));
          }, index * 150); // 150ms delay between each application
        });
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Reset animation when switching away from applications
    if (activeTab !== "applications") {
      setHasApplicationsAnimated(false);
      setAnimatedApplications(new Set());
    }
  }, [activeTab, hasApplicationsAnimated, applications, applicationSearchTerm]);

  // Filter applications based on search term
  const filteredApplications = applications.filter(application => {
    const searchLower = applicationSearchTerm.toLowerCase();
    return (
      application.full_name.toLowerCase().includes(searchLower) ||
      (application.email && application.email.toLowerCase().includes(searchLower)) ||
      application.phone_number.includes(searchLower) ||
      application.city.toLowerCase().includes(searchLower)
    );
  });

  // Animation effect for sponsors
  useEffect(() => {
    if (activeTab === "sponsors" && !hasSponsorsAnimated) {
      const timer = setTimeout(() => {
        setHasSponsorsAnimated(true);
        // Animate sponsors one by one
        sponsors.forEach((sponsor, index) => {
          setTimeout(() => {
            setAnimatedSponsors(prev => new Set([...prev, sponsor.id]));
          }, index * 150); // 150ms delay between each sponsor
        });
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Reset animation when switching away from sponsors
    if (activeTab !== "sponsors") {
      setHasSponsorsAnimated(false);
      setAnimatedSponsors(new Set());
    }
  }, [activeTab, hasSponsorsAnimated, sponsors]);

  // Animation effect for team members
  useEffect(() => {
    if (activeTab === "team" && !hasTeamAnimated) {
      const timer = setTimeout(() => {
        setHasTeamAnimated(true);
        // Animate team members one by one
        teamMembers.forEach((member, index) => {
          setTimeout(() => {
            setAnimatedTeamMembers(prev => new Set([...prev, member.id]));
          }, index * 150); // 150ms delay between each member
        });
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Reset animation when switching away from team
    if (activeTab !== "team") {
      setHasTeamAnimated(false);
      setAnimatedTeamMembers(new Set());
    }
  }, [activeTab, hasTeamAnimated, teamMembers]);

  // Animation effect for contact messages
  useEffect(() => {
    if (activeTab === "contact" && !hasContactMessagesAnimated) {
      const timer = setTimeout(() => {
        setHasContactMessagesAnimated(true);
        // Enhanced staggered animation for contact messages
        filteredContactMessages.forEach((message, index) => {
          setTimeout(() => {
            setAnimatedContactMessages(prev => new Set([...prev, message.id]));
          }, index * 200); // Increased delay for more dramatic effect
        });
      }, 500); // Increased initial delay
      return () => clearTimeout(timer);
    }
    
    // Reset animation when switching away from contact
    if (activeTab !== "contact") {
      setHasContactMessagesAnimated(false);
      setAnimatedContactMessages(new Set());
    }
  }, [activeTab, hasContactMessagesAnimated, contactMessages, contactMessageSearchTerm]);

  // Filter contact messages based on search term
  const filteredContactMessages = contactMessages.filter(message => {
    const searchLower = contactMessageSearchTerm.toLowerCase();
    return (
      message.name.toLowerCase().includes(searchLower) ||
      message.email.toLowerCase().includes(searchLower) ||
      message.subject.toLowerCase().includes(searchLower) ||
      message.message.toLowerCase().includes(searchLower)
    );
  });

  // Enhanced animation effect for tickets
  useEffect(() => {
    if (activeTab === "tickets" && !hasTicketsAnimated) {
      const timer = setTimeout(() => {
        setHasTicketsAnimated(true);
        // Enhanced staggered animation for tickets with different timing
        tickets.forEach((ticket, index) => {
          setTimeout(() => {
            setAnimatedTickets(prev => new Set([...prev, ticket.id]));
          }, index * 250); // Increased delay for more dramatic effect
        });
      }, 600); // Increased initial delay for more impact
      return () => clearTimeout(timer);
    }

    // Reset animation when switching away from tickets
    if (activeTab !== "tickets") {
      setHasTicketsAnimated(false);
      setAnimatedTickets(new Set());
    }
  }, [activeTab, hasTicketsAnimated, tickets]);

  // Fetch logs and analytics when logs tab is active
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchSiteLogs();
      fetchLogStatistics();
      fetchSuspiciousActivity();
    }
  }, [activeTab, logFilter, logCategoryFilter, logSearchTerm]);

  // Set default selected event to upcoming event
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      const upcomingEvent = events.find(event => event.event_type === 'upcoming');
      if (upcomingEvent) {
        setSelectedEventId(upcomingEvent.id);
      } else {
        setSelectedEventId(events[0].id);
      }
    }
  }, [events, selectedEventId]);

  // Update ticket stats when selected event changes
  useEffect(() => {
    if (selectedEventId && tickets.length > 0) {
      const eventTickets = tickets.filter(ticket => ticket.event_id === selectedEventId);
      const totalTickets = eventTickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
      const soldTickets = eventTickets.reduce((sum, ticket) => sum + (ticket.quantity - ticket.available_quantity), 0);
      const revenue = eventTickets.reduce((sum, ticket) => sum + ((ticket.quantity - ticket.available_quantity) * ticket.price), 0);
      
      // Get top ambassadors for this event
      const ambassadorSales = ambassadors.map(ambassador => {
        const ambassadorTickets = eventTickets.filter(ticket => ticket.ambassador_id === ambassador.id);
        const ticketsSold = ambassadorTickets.reduce((sum, ticket) => sum + (ticket.quantity - ticket.available_quantity), 0);
        return {
          ...ambassador,
          ticketsSold
        };
      }).filter(ambassador => ambassador.ticketsSold > 0)
        .sort((a, b) => b.ticketsSold - a.ticketsSold)
        .slice(0, 5);

      setTicketStats({
        totalTickets,
        soldTickets,
        availableTickets: totalTickets - soldTickets,
        revenue,
        topAmbassadors: ambassadorSales
      });
    }
  }, [selectedEventId, tickets, ambassadors]);

  // Fetch functions - defined before fetchAllData to avoid hoisting issues
  const fetchSalesSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'sales_settings')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching sales settings:', error);
        return;
      }

      if (data && data.content) {
        const settings = data.content as { enabled?: boolean };
        setSalesEnabled(settings.enabled !== false); // Default to true if not set
      } else {
        // Default to enabled if no setting exists
        setSalesEnabled(true);
      }
    } catch (error) {
      console.error('Error fetching sales settings:', error);
    }
  };

  const fetchMaintenanceSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'maintenance_settings')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching maintenance settings:', error);
        return;
      }

      if (data && data.content) {
        const settings = data.content as { enabled?: boolean; message?: string };
        setMaintenanceEnabled(settings.enabled === true);
        setMaintenanceMessage(settings.message || "");
      } else {
        // Default to disabled if no setting exists
        setMaintenanceEnabled(false);
        setMaintenanceMessage("");
      }
    } catch (error) {
      console.error('Error fetching maintenance settings:', error);
    }
  };

  const fetchAmbassadorApplicationSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'ambassador_application_settings')
        .single();

      if (error) {
        // PGRST116 means no rows found - this is expected if settings don't exist yet
        if (error.code === 'PGRST116') {
          // Default to enabled if no setting exists
          setAmbassadorApplicationEnabled(true);
          setAmbassadorApplicationMessage("");
          return;
        }
        console.error('Error fetching ambassador application settings:', error);
        // Set defaults on error to prevent loading state
        setAmbassadorApplicationEnabled(true);
        setAmbassadorApplicationMessage("");
        return;
      }

      if (data && data.content) {
        const settings = data.content as { enabled?: boolean; message?: string };
        setAmbassadorApplicationEnabled(settings.enabled !== false); // Default to true if not set
        setAmbassadorApplicationMessage(settings.message || "");
      } else {
        // Default to enabled if no setting exists
        setAmbassadorApplicationEnabled(true);
        setAmbassadorApplicationMessage("");
      }
    } catch (error) {
      console.error('Error fetching ambassador application settings:', error);
      // Set defaults on error to prevent loading state
      setAmbassadorApplicationEnabled(true);
      setAmbassadorApplicationMessage("");
    }
  };

  // Fetch hero images
  const fetchHeroImages = async () => {
    try {
      setLoadingHeroImages(true);
      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'hero_section')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching hero images:', error);
        setHeroImages([]);
        return;
      }

      if (data && data.content) {
        const content = data.content as any;
        if (content.images && Array.isArray(content.images)) {
          setHeroImages(content.images);
        } else {
          setHeroImages([]);
        }
      } else {
        setHeroImages([]);
      }
    } catch (error) {
      console.error('Error fetching hero images:', error);
      setHeroImages([]);
    } finally {
      setLoadingHeroImages(false);
    }
  };

  // Save hero images to site_content
  const saveHeroImages = async (images: HeroImage[]) => {
    try {
      // Get existing hero_section content
      const { data: existingData } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'hero_section')
        .single();

      let existingContent = existingData?.content || {};
      if (typeof existingContent !== 'object') {
        existingContent = {};
      }

      // Update images array
      const updatedContent = {
        ...existingContent,
        images: images
      };

      // Upsert hero_section with updated images
      const { error } = await supabase
        .from('site_content')
        .upsert({
          key: 'hero_section',
          content: updatedContent,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      setHeroImages(images);
      toast({
        title: language === 'en' ? 'Hero Images Updated' : 'Images Hero Mises à Jour',
        description: language === 'en' 
          ? 'Hero images have been updated successfully' 
          : 'Les images hero ont été mises à jour avec succès',
      });
    } catch (error) {
      console.error('Error saving hero images:', error);
      toast({
        title: t.error,
        description: language === 'en' 
          ? 'Failed to save hero images' 
          : 'Échec de la sauvegarde des images hero',
        variant: 'destructive',
      });
    }
  };

  // Handle hero image upload
  const handleUploadHeroImage = async (file: File) => {
    try {
      setUploadingHeroImage(true);
      
      // Upload to hero-images bucket
      const uploadResult = await uploadHeroImage(file);
      
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      // Create new hero image object
      const newImage: HeroImage = {
        type: 'image',
        src: uploadResult.url,
        alt: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for alt text
        path: uploadResult.path
      };

      // Add to hero images array
      const updatedImages = [...heroImages, newImage];
      await saveHeroImages(updatedImages);
    } catch (error) {
      console.error('Error uploading hero image:', error);
      toast({
        title: t.error,
        description: language === 'en' 
          ? 'Failed to upload hero image' 
          : 'Échec du téléchargement de l\'image hero',
        variant: 'destructive',
      });
    } finally {
      setUploadingHeroImage(false);
    }
  };

  // Handle hero image delete
  const handleDeleteHeroImage = async (index: number) => {
    try {
      const imageToDelete = heroImages[index];
      
      // Delete from storage if path exists
      if (imageToDelete.path) {
        await deleteHeroImage(imageToDelete.path);
      }

      // Remove from array
      const updatedImages = heroImages.filter((_, i) => i !== index);
      await saveHeroImages(updatedImages);
    } catch (error) {
      console.error('Error deleting hero image:', error);
      toast({
        title: t.error,
        description: language === 'en' 
          ? 'Failed to delete hero image' 
          : 'Échec de la suppression de l\'image hero',
        variant: 'destructive',
      });
    }
  };

  // Handle reorder hero images
  const handleReorderHeroImages = async (newOrder: HeroImage[]) => {
    await saveHeroImages(newOrder);
  };

  // Fetch favicon settings
  const loadFaviconSettings = async () => {
    try {
      setLoadingFaviconSettings(true);
      const settings = await fetchFaviconSettings();
      setFaviconSettings(settings);
    } catch (error) {
      console.error('Error fetching favicon settings:', error);
      setFaviconSettings({});
    } finally {
      setLoadingFaviconSettings(false);
    }
  };

  // Handle favicon upload
  const handleUploadFavicon = async (file: File, type: 'favicon_ico' | 'favicon_32x32' | 'favicon_16x16' | 'apple_touch_icon') => {
    try {
      setUploadingFavicon(type);
      const result = await uploadFavicon(file, type);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Reload favicon settings
      await loadFaviconSettings();

      toast({
        title: language === 'en' ? 'Favicon Uploaded' : 'Favicon Téléchargé',
        description: language === 'en' 
          ? `Favicon ${type} uploaded successfully` 
          : `Favicon ${type} téléchargé avec succès`,
      });
    } catch (error) {
      console.error('Error uploading favicon:', error);
      toast({
        title: language === 'en' ? 'Upload Failed' : 'Échec du Téléchargement',
        description: language === 'en' 
          ? `Failed to upload favicon: ${error instanceof Error ? error.message : 'Unknown error'}` 
          : `Échec du téléchargement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        variant: 'destructive',
      });
    } finally {
      setUploadingFavicon(null);
    }
  };

  // Handle favicon delete
  const handleDeleteFavicon = async (type: 'favicon_ico' | 'favicon_32x32' | 'favicon_16x16' | 'apple_touch_icon') => {
    try {
      const currentUrl = faviconSettings[type];
      if (!currentUrl) {
        toast({
          title: language === 'en' ? 'No Favicon' : 'Aucun Favicon',
          description: language === 'en' ? 'No favicon to delete' : 'Aucun favicon à supprimer',
          variant: 'destructive',
        });
        return;
      }

      const result = await deleteFavicon(type, currentUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete favicon');
      }

      // Reload favicon settings
      await loadFaviconSettings();

      toast({
        title: language === 'en' ? 'Favicon Deleted' : 'Favicon Supprimé',
        description: language === 'en' 
          ? `Favicon ${type} deleted successfully` 
          : `Favicon ${type} supprimé avec succès`,
      });
    } catch (error) {
      console.error('Error deleting favicon:', error);
      toast({
        title: language === 'en' ? 'Delete Failed' : 'Échec de la Suppression',
        description: language === 'en' 
          ? `Failed to delete favicon: ${error instanceof Error ? error.message : 'Unknown error'}` 
          : `Échec de la suppression: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        variant: 'destructive',
      });
    }
  };

  // Fetch OG image settings
  const loadOGImageSettings = async () => {
    try {
      setLoadingOGImageSettings(true);
      const settings = await fetchOGImageSettings();
      setOGImageSettings(settings);
    } catch (error) {
      console.error('Error fetching OG image settings:', error);
      setOGImageSettings({});
    } finally {
      setLoadingOGImageSettings(false);
    }
  };

  // Handle OG image upload
  const handleUploadOGImage = async (file: File) => {
    try {
      setUploadingOGImage(true);
      const result = await uploadOGImage(file);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Reload OG image settings
      await loadOGImageSettings();

      toast({
        title: language === 'en' ? 'Preview Image Uploaded' : 'Image d\'Aperçu Téléchargée',
        description: language === 'en' 
          ? 'Preview image uploaded successfully' 
          : 'Image d\'aperçu téléchargée avec succès',
      });
    } catch (error) {
      console.error('Error uploading OG image:', error);
      toast({
        title: language === 'en' ? 'Upload Failed' : 'Échec du Téléchargement',
        description: language === 'en' 
          ? `Failed to upload preview image: ${error instanceof Error ? error.message : 'Unknown error'}` 
          : `Échec du téléchargement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        variant: 'destructive',
      });
    } finally {
      setUploadingOGImage(false);
    }
  };

  // Handle OG image delete
  const handleDeleteOGImage = async () => {
    try {
      const currentUrl = ogImageSettings.og_image;
      if (!currentUrl) {
        toast({
          title: language === 'en' ? 'No Preview Image' : 'Aucune Image d\'Aperçu',
          description: language === 'en' ? 'No preview image to delete' : 'Aucune image d\'aperçu à supprimer',
          variant: 'destructive',
        });
        return;
      }

      const result = await deleteOGImage(currentUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete preview image');
      }

      // Reload OG image settings
      await loadOGImageSettings();

      toast({
        title: language === 'en' ? 'Preview Image Deleted' : 'Image d\'Aperçu Supprimée',
        description: language === 'en' 
          ? 'Preview image deleted successfully' 
          : 'Image d\'aperçu supprimée avec succès',
      });
    } catch (error) {
      console.error('Error deleting OG image:', error);
      toast({
        title: language === 'en' ? 'Delete Failed' : 'Échec de la Suppression',
        description: language === 'en' 
          ? `Failed to delete preview image: ${error instanceof Error ? error.message : 'Unknown error'}` 
          : `Échec de la suppression: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        variant: 'destructive',
      });
    }
  };

  // Fetch phone subscribers
  const fetchPhoneSubscribers = async () => {
    try {
      setLoadingSubscribers(true);
      const { data, error } = await supabase
        .from('phone_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });

      if (error) throw error;
      setPhoneSubscribers(data || []);
    } catch (error) {
      console.error('Error fetching phone subscribers:', error);
      setPhoneSubscribers([]);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  // Fetch SMS logs
  const fetchSmsLogs = async () => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Handle case where table doesn't exist (404) or other errors
      if (error) {
        // P42P01 = relation does not exist (table not found)
        // 404 = Not Found
        if (error.code === 'P42P01' || error.message?.includes('404') || error.message?.includes('does not exist')) {
          console.warn('SMS logs table does not exist yet. Please run migration: 20250120000000-create-sms-logs-table.sql');
          setSmsLogs([]);
          return;
        }
        throw error;
      }
      setSmsLogs(data || []);
    } catch (error) {
      console.error('Error fetching SMS logs:', error);
      setSmsLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Fetch SMS balance
  // Fetch log statistics
  const fetchLogStatistics = async () => {
    try {
      setLoadingStatistics(true);
      // @ts-ignore - RPC function may not be in types yet
      const { data, error } = await supabase.rpc('get_log_statistics', {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      });

      if (error) {
        // Don't show error if function doesn't exist (migration not run)
        if (error.code === '42883' || error.message?.includes('does not exist')) {
          console.warn('get_log_statistics function not found. Please run migration 20250130000002-add-log-cleanup-and-analytics.sql');
          setLogStatistics(null);
          return;
        }
        throw error;
      }
      setLogStatistics(data);
    } catch (error) {
      console.error('Error fetching log statistics:', error);
      setLogStatistics(null);
    } finally {
      setLoadingStatistics(false);
    }
  };

  // Fetch suspicious activity
  const fetchSuspiciousActivity = async () => {
    try {
      setLoadingSuspicious(true);
      // @ts-ignore - RPC function may not be in types yet
      const { data, error } = await supabase.rpc('detect_suspicious_activity', {
        lookback_hours: 24
      });

      if (error) {
        // Don't show error if function doesn't exist (migration not run)
        if (error.code === '42883' || error.message?.includes('does not exist')) {
          console.warn('detect_suspicious_activity function not found. Please run migration 20250130000002-add-log-cleanup-and-analytics.sql');
          setSuspiciousActivity(null);
          return;
        }
        throw error;
      }
      setSuspiciousActivity(data);
    } catch (error) {
      console.error('Error fetching suspicious activity:', error);
      setSuspiciousActivity(null);
    } finally {
      setLoadingSuspicious(false);
    }
  };

  // Cleanup old logs
  const cleanupOldLogs = async () => {
    try {
      setCleaningLogs(true);
      // @ts-ignore
      const { data, error } = await supabase.rpc('cleanup_old_logs', {
        days_to_keep: cleanupDays
      });

      if (error) throw error;
      
      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' 
          ? `Cleaned up ${data} old log entries` 
          : `${data} anciennes entrées de journal nettoyées`,
      });
      
      // Refresh logs and statistics
      await fetchSiteLogs();
      await fetchLogStatistics();
    } catch (error) {
      console.error('Error cleaning up logs:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' ? 'Failed to cleanup logs' : 'Échec du nettoyage des journaux',
        variant: 'destructive',
      });
    } finally {
      setCleaningLogs(false);
    }
  };

  const fetchSiteLogs = async () => {
    try {
      setLoadingSiteLogs(true);
      let query = supabase
        // @ts-ignore - site_logs table may not be in types yet
      .from('site_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); // Limit to most recent 1000 logs

      // Apply filters
      if (logFilter !== 'all') {
        query = query.eq('log_type', logFilter);
      }
      if (logCategoryFilter !== 'all') {
        query = query.eq('category', logCategoryFilter);
      }
      if (logSearchTerm.trim()) {
        query = query.or(`message.ilike.%${logSearchTerm}%,details.ilike.%${logSearchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSiteLogs(data || []);
    } catch (error) {
      console.error('Error fetching site logs:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' ? 'Failed to load logs' : 'Échec du chargement des journaux',
        variant: 'destructive',
      });
    } finally {
      setLoadingSiteLogs(false);
    }
  };

  const fetchSmsBalance = async () => {
    try {
      setLoadingBalance(true);
      const response = await fetch('/api/sms-balance');
      
      // Check if response is OK
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${text.substring(0, 200)}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSmsBalance(data);
      } else {
        console.error('Error fetching SMS balance:', data.error);
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: data.error || (language === 'en' ? 'Failed to fetch SMS balance' : 'Échec de la récupération du solde SMS'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching SMS balance:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error ? error.message : (language === 'en' ? 'Failed to fetch SMS balance. Make sure the server is running on port 8082.' : 'Échec de la récupération du solde SMS. Assurez-vous que le serveur est en cours d\'exécution sur le port 8082.'),
        variant: 'destructive',
      });
    } finally {
      setLoadingBalance(false);
    }
  };

  // Add bulk phone numbers
  const handleAddBulkPhones = async () => {
    if (!bulkPhonesInput.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter phone numbers' 
          : 'Veuillez entrer des numéros de téléphone',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAddingBulkPhones(true);
      
      // Parse phone numbers (split by newline or comma)
      const phones = bulkPhonesInput
        .split(/[\n,]/)
        .map(phone => phone.trim())
        .filter(phone => phone.length > 0);

      if (phones.length === 0) {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'No valid phone numbers found' 
            : 'Aucun numéro de téléphone valide trouvé',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/bulk-phones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers: phones }),
      });

      // Check if response is OK
      if (!response.ok) {
        const text = await response.text();
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          errorMsg = language === 'en' 
            ? 'API route not found. Please restart the backend server (npm run server) to load the new routes.'
            : 'Route API introuvable. Veuillez redémarrer le serveur backend (npm run server) pour charger les nouvelles routes.';
        } else {
          errorMsg += `. ${text.substring(0, 200)}`;
        }
        throw new Error(errorMsg);
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        let errorMsg = language === 'en'
          ? 'API route not found. Please restart the backend server (npm run server) to load the new routes.'
          : 'Route API introuvable. Veuillez redémarrer le serveur backend (npm run server) pour charger les nouvelles routes.';
        if (!text.includes('<!DOCTYPE') && !text.includes('<html')) {
          errorMsg = `Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (data.success) {
        toast({
          title: language === 'en' ? 'Success' : 'Succès',
          description: language === 'en' 
            ? `${data.inserted} phone numbers added. ${data.duplicates} duplicates skipped. ${data.invalid} invalid numbers.`
            : `${data.inserted} numéros ajoutés. ${data.duplicates} doublons ignorés. ${data.invalid} numéros invalides.`,
        });
        setBulkPhonesInput('');
        await fetchPhoneSubscribers();
      } else {
        throw new Error(data.error || 'Failed to add phone numbers');
      }
    } catch (error) {
      console.error('Error adding bulk phones:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error ? error.message : (language === 'en' ? 'Failed to add phone numbers' : 'Échec de l\'ajout des numéros'),
        variant: 'destructive',
      });
    } finally {
      setAddingBulkPhones(false);
    }
  };

  // Send SMS broadcast
  const handleSendSmsBroadcast = async () => {
    if (!smsMessage.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter a message' 
          : 'Veuillez entrer un message',
        variant: 'destructive',
      });
      return;
    }

    // Get selected phones or all subscribers if none selected
    const phonesToSend = selectedPhones.size > 0 
      ? Array.from(selectedPhones)
      : phoneSubscribers.map(sub => sub.phone_number);

    if (phonesToSend.length === 0) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'No phone numbers selected' 
          : 'Aucun numéro de téléphone sélectionné',
        variant: 'destructive',
      });
      return;
    }

    // Check balance before sending
    if (smsBalance?.balanceValue === 0 || smsBalance?.balance === 0 || smsBalance?.balance === '0') {
      const confirmSend = window.confirm(
        language === 'en' 
          ? '⚠️ Warning: Your SMS balance appears to be 0. Messages may fail to send. Do you want to continue?'
          : '⚠️ Avertissement: Votre solde SMS semble être de 0. Les messages peuvent échouer. Voulez-vous continuer?'
      );
      if (!confirmSend) {
        return;
      }
    }

    try {
      setSendingSms(true);
      
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumbers: phonesToSend, 
          message: smsMessage.trim() 
        }),
      });

      // Check if response is OK
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${text.substring(0, 200)}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
      }

      const data = await response.json();

      if (data.success) {
        toast({
          title: language === 'en' ? 'SMS Broadcast Sent' : 'Diffusion SMS Envoyée',
          description: language === 'en' 
            ? `Sent: ${data.sent}, Failed: ${data.failed} out of ${data.total}`
            : `Envoyé: ${data.sent}, Échoué: ${data.failed} sur ${data.total}`,
        });
        
        // Refresh logs (balance is refreshed manually via button)
        await fetchSmsLogs();
        
        // Clear message
        setSmsMessage('');
        setSelectedPhones(new Set());
      } else {
        throw new Error(data.error || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('Error sending SMS broadcast:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error ? error.message : (language === 'en' ? 'Failed to send SMS' : 'Échec de l\'envoi du SMS'),
        variant: 'destructive',
      });
    } finally {
      setSendingSms(false);
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch applications
      const { data: appsData, error: appsError } = await supabase
        .from('ambassador_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error fetching applications:', appsError);
        console.error('Error details:', {
          message: appsError.message,
          details: appsError.details,
          hint: appsError.hint,
          code: appsError.code
        });
      } else {
        setApplications(appsData || []);
      }

      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false });

      if (eventsError) console.error('Error fetching events:', eventsError);
      else setEvents(eventsData || []);



      // Fetch ambassadors
      const { data: ambassadorsData, error: ambassadorsError } = await supabase
        .from('ambassadors')
        .select('*')
        .order('created_at', { ascending: false });

      if (ambassadorsError) console.error('Error fetching ambassadors:', ambassadorsError);
      else setAmbassadors(ambassadorsData || []);

      // Fetch sales for all ambassadors
      if (ambassadorsData && ambassadorsData.length > 0) {
        const { data: salesData, error: salesError } = await supabase
          .from('clients')
          .select('ambassador_id, standard_tickets, vip_tickets');
        if (salesError) {
          console.error('Error fetching ambassador sales:', salesError);
          setAmbassadorSales({});
        } else {
          // Aggregate sales by ambassador_id
          const salesMap: Record<string, { standard: number; vip: number }> = {};
          for (const sale of salesData) {
            if (!sale.ambassador_id) continue;
            if (!salesMap[sale.ambassador_id]) salesMap[sale.ambassador_id] = { standard: 0, vip: 0 };
            salesMap[sale.ambassador_id].standard += sale.standard_tickets || 0;
            salesMap[sale.ambassador_id].vip += sale.vip_tickets || 0;
          }
          setAmbassadorSales(salesMap);
        }
      } else {
        setAmbassadorSales({});
      }

      // Fetch sales settings
      await fetchSalesSettings();
      await fetchMaintenanceSettings();
      await fetchAmbassadorApplicationSettings();
      await fetchHeroImages();
      await loadFaviconSettings();
      await loadOGImageSettings();
      await fetchPhoneSubscribers();
      await fetchSmsLogs();
      // SMS balance is now fetched manually via button, not automatically
      if (activeTab === 'logs') {
        await fetchSiteLogs();
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to load data" : "Échec du chargement des données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (application: AmbassadorApplication) => {
    setProcessingId(application.id);
    
    try {
      // Generate username and password
      const username = application.phone_number; // Use phone as username
      const password = generatePassword();

      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(password, 10);

      // Check if ambassador already exists
      const { data: existingAmbassador } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('phone', application.phone_number)
        .maybeSingle();

      let ambassadorId: string;

      if (existingAmbassador) {
        // Update their info
        const { error: updateAmbassadorError } = await supabase
          .from('ambassadors')
          .update({
            full_name: application.full_name,
            email: application.email,
            city: application.city,
            password: hashedPassword, // Store hashed password
            status: 'approved',
            commission_rate: 10,
            updated_at: new Date().toISOString()
          })
          .eq('phone', application.phone_number);
        if (updateAmbassadorError) throw updateAmbassadorError;
        ambassadorId = existingAmbassador.id;
      } else {
        // Create ambassador account
        const { data: newAmbassador, error: createError } = await supabase
          .from('ambassadors')
          .insert({
            full_name: application.full_name,
            phone: application.phone_number,
            email: application.email,
            city: application.city,
            password: hashedPassword, // Store hashed password
            status: 'approved',
            commission_rate: 10,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        if (createError) throw createError;
        if (!newAmbassador) throw new Error('Failed to create ambassador account');
        ambassadorId = newAmbassador.id;
      }

      // Update application status
      const { error: updateError } = await supabase
        .from('ambassador_applications')
        .update({ status: 'approved' })
        .eq('id', application.id);

      if (updateError) throw updateError;

      // Send approval email with credentials (plain password)
      const emailConfig = createApprovalEmail(
        {
          fullName: application.full_name,
          phone: application.phone_number,
          email: application.email,
          city: application.city,
          password: password // Send plain password
        },
        `${window.location.origin}/ambassador/auth`,
        ambassadorId // Pass ambassador ID for tracking
      );

      const emailSent = await sendEmail(emailConfig);

      // Store credentials for potential resend
      setAmbassadorCredentials(prev => ({
        ...prev,
        [application.id]: {
          username: username,
          password: password
        }
      }));

      if (!emailSent) {
        // Track failed email applications
        setEmailFailedApplications(prev => new Set([...prev, application.id]));
      }

      toast({
        title: t.approvalSuccess,
        description: emailSent 
          ? `${t.emailSent} - Credentials sent to ${application.email}`
          : "Approval successful, but email failed to send",
      });

      fetchAllData();

    } catch (error) {
      console.error('Error approving application:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to approve application" : "Échec de l'approbation",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Function to resend approval email
  const resendEmail = async (application: AmbassadorApplication) => {
    setProcessingId(application.id);
    
    try {
      const credentials = ambassadorCredentials[application.id];
      if (!credentials) {
        toast({
          title: t.error,
          description: language === 'en' ? "No credentials found for this application" : "Aucune information d'identification trouvée",
          variant: "destructive",
        });
        return;
      }

      const emailConfig = createApprovalEmail(
        {
          fullName: application.full_name,
          phone: application.phone_number,
          email: application.email,
          city: application.city,
          password: credentials.password
        },
        `${window.location.origin}/ambassador/auth`
      );

      const emailSent = await sendEmail(emailConfig);

      if (emailSent) {
        setEmailFailedApplications(prev => {
          const newSet = new Set(prev);
          newSet.delete(application.id);
          return newSet;
        });
        
        toast({
          title: language === 'en' ? "Email sent successfully" : "Email envoyé avec succès",
          description: language === 'en' ? `Credentials sent to ${application.email}` : `Informations d'identification envoyées à ${application.email}`,
        });
      } else {
        toast({
          title: language === 'en' ? "Email failed to send" : "Échec de l'envoi d'email",
          description: language === 'en' ? "Please try again or copy credentials manually" : "Veuillez réessayer ou copier les informations manuellement",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error resending email:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to resend email" : "Échec de la nouvelle tentative d'envoi",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };


  // Update sales settings - using direct Supabase (old method)
  const updateSalesSettings = async (enabled: boolean) => {
    setLoadingSalesSettings(true);
    try {
      const { error } = await supabase
        .from('site_content')
        .upsert({
          key: 'sales_settings',
          content: { enabled },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        // If RLS blocks it, provide helpful error
        if (error.code === '42501' || error.message?.includes('policy')) {
          throw new Error('Permission denied. Please run FIX_SALES_SETTINGS.sql in Supabase SQL Editor to enable admin updates.');
        }
        throw error;
      }

      setSalesEnabled(enabled);
      toast({
        title: language === 'en' ? 'Settings Updated' : 'Paramètres Mis à Jour',
        description: enabled
          ? (language === 'en' ? 'Sales are now enabled for ambassadors' : 'Les ventes sont maintenant activées pour les ambassadeurs')
          : (language === 'en' ? 'Sales are now disabled for ambassadors' : 'Les ventes sont maintenant désactivées pour les ambassadeurs'),
      });
      
      // Refresh the settings to ensure sync
      await fetchSalesSettings();
    } catch (error: any) {
      console.error('Error updating sales settings:', error);
      const errorMessage = error.message || (language === 'en' ? 'Failed to update settings' : 'Échec de la mise à jour des paramètres');
      toast({
        title: t.error,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoadingSalesSettings(false);
    }
  };

  const updateMaintenanceSettings = async (enabled: boolean, message?: string) => {
    setLoadingMaintenanceSettings(true);
    try {
      const { error } = await supabase
        .from('site_content')
        .upsert({
          key: 'maintenance_settings',
          content: { enabled, message: message || "" },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        // If RLS blocks it, provide helpful error
        if (error.code === '42501' || error.message?.includes('policy')) {
          throw new Error('Permission denied. Please run the maintenance settings migration in Supabase SQL Editor to enable admin updates.');
        }
        throw error;
      }

      setMaintenanceEnabled(enabled);
      if (message !== undefined) {
        setMaintenanceMessage(message);
      }
      toast({
        title: language === 'en' ? 'Settings Updated' : 'Paramètres Mis à Jour',
        description: enabled
          ? (language === 'en' ? 'Maintenance mode is now enabled. Users will see the maintenance message.' : 'Le mode maintenance est maintenant activé. Les utilisateurs verront le message de maintenance.')
          : (language === 'en' ? 'Maintenance mode is now disabled. The site is accessible to all users.' : 'Le mode maintenance est maintenant désactivé. Le site est accessible à tous les utilisateurs.'),
      });
      
      // Refresh the settings to ensure sync
      await fetchMaintenanceSettings();
    } catch (error: any) {
      console.error('Error updating maintenance settings:', error);
      const errorMessage = error.message || (language === 'en' ? 'Failed to update settings' : 'Échec de la mise à jour des paramètres');
      toast({
        title: t.error,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoadingMaintenanceSettings(false);
    }
  };

  const updateAmbassadorApplicationSettings = async (enabled: boolean, message?: string) => {
    // Prevent multiple simultaneous updates
    if (loadingAmbassadorApplicationSettings) {
      // Update already in progress, skipping...
      return;
    }

    // Use functional update to ensure we're using the latest state
    setLoadingAmbassadorApplicationSettings(true);
    const previousEnabled = ambassadorApplicationEnabled;
    const previousMessage = ambassadorApplicationMessage;

    // Safety timeout to ensure loading state is always cleared
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      console.warn('Ambassador application settings update timed out, clearing loading state');
      setLoadingAmbassadorApplicationSettings(false);
    }, 10000); // 10 second timeout

    try {
      // Update local state immediately for better UX
      setAmbassadorApplicationEnabled(enabled);
      if (message !== undefined) {
        setAmbassadorApplicationMessage(message);
      }

      const { data, error } = await supabase
        .from('site_content')
        .upsert({
          key: 'ambassador_application_settings',
          content: { enabled, message: message || "" },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        // Revert local state on error
        setAmbassadorApplicationEnabled(previousEnabled);
        setAmbassadorApplicationMessage(previousMessage);
        
        console.error('Error updating ambassador application settings:', error);
        
        // If RLS blocks it, provide helpful error
        if (error.code === '42501' || error.message?.includes('policy')) {
          toast({
            title: t.error,
            description: language === 'en' 
              ? 'Permission denied. Please run INIT_AMBASSADOR_APPLICATION_SETTINGS.sql in Supabase SQL Editor.'
              : 'Permission refusée. Veuillez exécuter INIT_AMBASSADOR_APPLICATION_SETTINGS.sql dans l\'éditeur SQL Supabase.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: t.error,
            description: error.message || (language === 'en' ? 'Failed to update settings' : 'Échec de la mise à jour des paramètres'),
            variant: 'destructive',
          });
        }
        // Continue to finally block to clear loading state
      } else {
        toast({
          title: language === 'en' ? 'Settings Updated' : 'Paramètres Mis à Jour',
          description: enabled
            ? (language === 'en' ? 'Ambassador applications are now open. Users can submit applications.' : 'Les candidatures ambassadeur sont maintenant ouvertes. Les utilisateurs peuvent soumettre des candidatures.')
            : (language === 'en' ? 'Ambassador applications are now closed. Users will see the closed message.' : 'Les candidatures ambassadeur sont maintenant fermées. Les utilisateurs verront le message de fermeture.'),
        });
        
        // Refresh the settings to ensure sync (don't await to avoid blocking)
        setTimeout(() => {
          fetchAmbassadorApplicationSettings().catch(err => {
            console.error('Error refreshing settings:', err);
          });
        }, 100);
      }
    } catch (error: any) {
      console.error('Unexpected error updating ambassador application settings:', error);
      // Revert local state on error
      setAmbassadorApplicationEnabled(previousEnabled);
      setAmbassadorApplicationMessage(previousMessage);
      
      toast({
        title: t.error,
        description: error?.message || (language === 'en' ? 'Failed to update settings' : 'Échec de la mise à jour des paramètres'),
        variant: 'destructive',
      });
    } finally {
      // Always clear loading state and timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Force state update using functional form
      setLoadingAmbassadorApplicationSettings(() => false);
    }
  };

  // Function to copy credentials to clipboard
  const copyCredentials = async (application: AmbassadorApplication) => {
    try {
      const credentials = ambassadorCredentials[application.id];
      if (!credentials) {
        toast({
          title: t.error,
          description: language === 'en' ? "No credentials found for this application" : "Aucune information d'identification trouvée",
          variant: "destructive",
        });
        return;
      }

      const credentialsText = `Username: ${credentials.username}\nPassword: ${credentials.password}\nLogin URL: ${window.location.origin}/ambassador/auth`;
      
      await navigator.clipboard.writeText(credentialsText);
      
      toast({
        title: language === 'en' ? "Credentials copied" : "Informations d'identification copiées",
        description: language === 'en' ? "Credentials copied to clipboard. You can now paste them in a message." : "Informations copiées dans le presse-papiers. Vous pouvez maintenant les coller dans un message.",
      });
    } catch (error) {
      console.error('Error copying credentials:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to copy credentials" : "Échec de la copie des informations",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (application: AmbassadorApplication) => {
    setProcessingId(application.id);
    
    try {
      const { error } = await supabase
        .from('ambassador_applications')
        .update({ status: 'rejected' })
        .eq('id', application.id);

      if (error) throw error;

      const emailConfig = createRejectionEmail({
        fullName: application.full_name,
        phone: application.phone_number,
        email: application.email,
        city: application.city
      });

      const emailSent = await sendEmail(emailConfig);

      toast({
        title: t.rejectionSuccess,
        description: emailSent ? t.emailSent : "Rejection successful, but email failed to send",
      });

      fetchAllData();

    } catch (error) {
      console.error('Error rejecting application:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to reject application" : "Échec du rejet",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveEvent = async (event: Event, uploadedFile?: File | null) => {
    try {
      let posterUrl = event.poster_url;

      // Upload image if file is provided
      if (uploadedFile) {
        setUploadingImage(true);
        const uploadResult = await uploadImage(uploadedFile, 'posters');
        
        if (uploadResult.error) {
          toast({
            title: t.error,
            description: language === 'en' ? `Failed to upload image: ${uploadResult.error}` : `Échec du téléchargement: ${uploadResult.error}`,
            variant: "destructive",
          });
          setUploadingImage(false);
          return;
        }
        
        posterUrl = uploadResult.url;
        setUploadingImage(false);
      }

      if (event.id) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update({
            name: event.name,
            date: event.date,
            venue: event.venue,
            city: event.city,
            description: event.description,
            poster_url: posterUrl,
            ticket_link: event.ticket_link,
            whatsapp_link: event.whatsapp_link,
            featured: event.featured,
            standard_price: event.standard_price,
            vip_price: event.vip_price,
            event_type: event.event_type || 'upcoming',
            gallery_images: event.gallery_images || [],
            gallery_videos: event.gallery_videos || [],
            updated_at: new Date().toISOString()
          })
          .eq('id', event.id);

        if (error) throw error;
      } else {
        // Create new event
        const { error } = await supabase
          .from('events')
          .insert({
            name: event.name,
            date: event.date,
            venue: event.venue,
            city: event.city,
            description: event.description,
            poster_url: posterUrl,
            ticket_link: event.ticket_link,
            whatsapp_link: event.whatsapp_link,
            featured: event.featured,
            standard_price: event.standard_price,
            vip_price: event.vip_price,
            event_type: event.event_type || 'upcoming',
            gallery_images: event.gallery_images || [],
            gallery_videos: event.gallery_videos || []
          });

        if (error) throw error;
      }

      toast({
        title: t.eventSaved,
        description: language === 'en' ? "Event saved successfully" : "Événement enregistré avec succès",
      });

      setEditingEvent(null);
      fetchAllData();

    } catch (error) {
      console.error('Error saving event:', error, error?.message, error?.details);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to save event" : "Échec de l'enregistrement",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveAmbassador = async (ambassador: Ambassador) => {
    try {
      if (ambassador.id) {
        // Update existing ambassador
        const { error } = await supabase
          .from('ambassadors')
          .update({
            full_name: ambassador.full_name,
            phone: ambassador.phone,
            email: ambassador.email,
            city: ambassador.city,
            status: ambassador.status,
            commission_rate: ambassador.commission_rate,
            updated_at: new Date().toISOString()
          })
          .eq('id', ambassador.id);

        if (error) throw error;
      } else {
        // Create new ambassador
        const { error } = await supabase
          .from('ambassadors')
          .insert({
            full_name: ambassador.full_name,
            phone: ambassador.phone,
            email: ambassador.email,
            city: ambassador.city,
            password: ambassador.password || generatePassword(),
            status: ambassador.status,
            commission_rate: ambassador.commission_rate
          });

        if (error) throw error;
      }

      toast({
        title: t.ambassadorSaved,
        description: language === 'en' ? "Ambassador saved successfully" : "Ambassadeur enregistré avec succès",
      });

      setEditingAmbassador(null);
      fetchAllData();

    } catch (error) {
      console.error('Error saving ambassador:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to save ambassador" : "Échec de l'enregistrement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setEventToDelete(event);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      const { data, error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete.id)
        .select();

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      // Verify deletion by checking if the event still exists
      const { data: verifyData, error: verifyError } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventToDelete.id)
        .single();

      if (verifyError && verifyError.code === 'PGRST116') {
        // Event was successfully deleted (not found)
        toast({
          title: language === 'en' ? "Event deleted" : "Événement supprimé",
          description: language === 'en' ? "Event deleted successfully" : "Événement supprimé avec succès",
        });
      } else if (verifyData) {
        // Event still exists - deletion failed
        console.error('Event still exists after deletion attempt');
        toast({
          title: t.error,
          description: language === 'en' ? "Event deletion failed - please check RLS policies" : "Échec de la suppression - vérifiez les politiques RLS",
          variant: "destructive",
        });
      }

      fetchAllData();

    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: t.error,
        description: language === 'en' ? `Failed to delete event: ${error.message}` : `Échec de la suppression: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setEventToDelete(null);
    }
  };

  const handleDeleteAmbassador = async (ambassadorId: string) => {
    // This will now be called only after confirmation
    try {
      // First, get the ambassador details to find the corresponding application
      const { data: ambassador, error: fetchError } = await supabase
        .from('ambassadors')
        .select('phone, email')
        .eq('id', ambassadorId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the ambassador
      const { error: deleteError } = await supabase
        .from('ambassadors')
        .delete()
        .eq('id', ambassadorId);

      if (deleteError) throw deleteError;

      // Delete the corresponding application completely
      if (ambassador) {
        const { error: deleteAppError } = await supabase
          .from('ambassador_applications')
          .delete()
          .or(`phone_number.eq.${ambassador.phone},email.eq.${ambassador.email}`);

        if (deleteAppError) {
          console.error('Error deleting application:', deleteAppError);
          // Don't throw here as the ambassador was already deleted
        }
      }

      toast({
        title: language === 'en' ? "Ambassador deleted" : "Ambassadeur supprimé",
        description: language === 'en' ? "Ambassador and application deleted successfully" : "Ambassadeur et candidature supprimés avec succès",
      });
      fetchAllData();
    } catch (error) {
      console.error('Error deleting ambassador:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to delete ambassador" : "Échec de la suppression",
        variant: "destructive",
      });
    }
    setAmbassadorToDelete(null);
  };

  // Add/Edit Sponsor Dialog logic
  const openSponsorDialog = (sponsor = null) => {
    setEditingSponsor(
      sponsor
        ? { ...sponsor, id: sponsor.id }
        : { name: '', logo_url: '', description: '', website_url: '', category: 'other', is_global: false }
    );
    setIsSponsorDialogOpen(true);
  };
  const closeSponsorDialog = () => {
    setEditingSponsor(null);
    setIsSponsorDialogOpen(false);
  };
  const handleSponsorSave = async (e) => {
    e.preventDefault();
    const isNew = !editingSponsor?.id;
    let sponsorId = editingSponsor?.id;
    let logo_url = editingSponsor?.logo_url;
    
    // Handle file upload if there's a new file
    if (editingSponsor?._uploadFile) {
      try {
        const uploadResult = await uploadImage(editingSponsor._uploadFile, 'sponsors');
        if (uploadResult.error) {
          throw new Error(uploadResult.error);
        }
        logo_url = uploadResult.url;
      } catch (error) {
        console.error('Logo upload error:', error);
        toast({
          title: 'Error',
          description: 'Failed to upload logo. Please try again.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    const sponsorData = {
      name: editingSponsor.name,
      logo_url,
      description: editingSponsor.description,
      website_url: editingSponsor.website_url,
      category: editingSponsor.category,
      is_global: true, // Always global
    };
    let error;
    try {
      let affectedRows = 0;
      if (isNew) {
        const { data, error: insertError } = await supabase.from('sponsors').insert(sponsorData).select().single();
        error = insertError;
        if (data && data.id) {
          sponsorId = data.id;
          affectedRows = 1;
        }
      } else {
        const { data: updateData, error: updateError } = await supabase.from('sponsors').update(sponsorData).eq('id', sponsorId).select();
        error = updateError;
        affectedRows = Array.isArray(updateData) ? updateData.length : 0;
      }
      // Refresh sponsors
      const { data: sponsorsData } = await supabase.from('sponsors').select('*').order('created_at', { ascending: true });
      setSponsors(sponsorsData);
      if ((isNew && affectedRows > 0) || (!isNew && affectedRows > 0)) {
        closeSponsorDialog();
        toast({
          title: 'Sponsor saved',
          description: 'Sponsor details updated successfully.',
        });
      } else {
        toast({
          title: 'Error',
          description: 'No sponsor was updated. Please check your data.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Sponsor save error:', err);
      toast({
        title: 'Error',
        description: 'Failed to save sponsor. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Delete Sponsor logic
  const openDeleteDialog = (sponsor) => {
    setSponsorToDelete(sponsor);
    setIsDeleteDialogOpen(true);
  };
  const closeDeleteDialog = () => {
    setSponsorToDelete(null);
    setIsDeleteDialogOpen(false);
  };
  const handleDeleteSponsor = async () => {
    if (!sponsorToDelete) return;
    await supabase.from('sponsors').delete().eq('id', sponsorToDelete.id);
    await supabase.from('event_sponsors').delete().eq('sponsor_id', sponsorToDelete.id);
    setSponsors(sponsors.filter(s => s.id !== sponsorToDelete.id));
    closeDeleteDialog();
  };


  const handleLogout = async () => {
    try {
      // Call Vercel API route to clear JWT cookie
      await fetch('/api/admin-logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      toast({
        title: language === 'en' ? "Logged Out" : "Déconnecté",
        description: language === 'en' 
          ? "You have been successfully logged out."
          : "Vous avez été déconnecté avec succès.",
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Navigate to login page
      navigate('/admin/login');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">✅ {t.approved}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">❌ {t.rejected}</Badge>;
      default:
        return <Badge className="bg-yellow-500">⏳ {t.pending}</Badge>;
    }
  };

  // Helper function to detect Instagram URLs
  const isInstagramUrl = (url: string) => {
    return url.includes('instagram.com') || url.includes('ig.com');
  };

  // Social link component with icon
  const SocialLink = ({ url }: { url: string }) => {
    if (isInstagramUrl(url)) {
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors duration-300 transform hover:scale-105"
        >
          <Instagram className="w-4 h-4" />
          <span className="text-sm">Instagram Profile</span>
        </a>
      );
    }
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-primary hover:underline text-sm transition-colors duration-300"
      >
        {url}
      </a>
    );
  };

  const handleGalleryFileUpload = async (files: File[]) => {
    setUploadingGallery(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of files) {
        const uploadResult = await uploadImage(file, 'gallery');
        
        if (uploadResult.error) {
          throw new Error(uploadResult.error);
        }
        
        uploadedUrls.push(uploadResult.url);
      }
      
      setEditingEvent(prev => ({
        ...prev!,
        gallery_images: [...(prev?.gallery_images || []), ...uploadedUrls]
      }));
      
      toast({
        title: "Gallery files uploaded successfully!",
        description: `${files.length} file(s) uploaded`,
      });
    } catch (error) {
      console.error('Error uploading gallery files:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload gallery files",
        variant: "destructive",
      });
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryFile = (index: number, type: 'images' | 'videos') => {
    setEditingEvent(prev => {
      if (!prev) return prev;
      
      if (type === 'images') {
        const newImages = [...(prev.gallery_images || [])];
        newImages.splice(index, 1);
        return { ...prev, gallery_images: newImages };
      } else {
        const newVideos = [...(prev.gallery_videos || [])];
        newVideos.splice(index, 1);
        return { ...prev, gallery_videos: newVideos };
      }
    });
  };

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const approvedCount = applications.filter(app => app.status === 'approved').length;
  const rejectedCount = applications.filter(app => app.status === 'rejected').length;

  useEffect(() => {
    const fetchSponsors = async () => {
      const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) setSponsors(data);
    };
    fetchSponsors();
  }, []);



  // Fetch team members on mount
  useEffect(() => {
    const fetchTeamMembers = async () => {
      const { data, error } = await supabase.from('team_members').select('*').order('created_at', { ascending: true });
      if (!error && data) setTeamMembers(data);
    };
    fetchTeamMembers();
  }, []);

  // Fetch contact messages on mount
  useEffect(() => {
    const fetchContactMessages = async () => {
      const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });
      if (!error && data) setContactMessages(data);
    };
    fetchContactMessages();
  }, []);

  // Generate tickets and stats when events or ambassadors change
  useEffect(() => {
    if (events.length > 0 && ambassadors.length > 0) {
      // Create mock ticket data based on events
      const mockTickets = events.map((event, index) => ({
        id: `ticket-${index + 1}`,
        event_id: event.id,
        event_name: event.name,
        ticket_type: index % 3 === 0 ? 'VIP' : index % 3 === 1 ? 'Standard' : 'Premium',
        price: event.standard_price || 50 + (index * 10),
        quantity: 100,
        available_quantity: 100 - (Math.floor(Math.random() * 80) + 10),
        description: `${index % 3 === 0 ? 'VIP' : index % 3 === 1 ? 'Standard' : 'Premium'} ticket for ${event.name}`,
        is_active: true,
        created_at: new Date().toISOString()
      }));
      setTickets(mockTickets);
      
      // Calculate ticket statistics
      const totalSold = mockTickets.reduce((sum, ticket) => sum + (ticket.quantity - ticket.available_quantity), 0);
      const totalRevenue = mockTickets.reduce((sum, ticket) => sum + ((ticket.quantity - ticket.available_quantity) * ticket.price), 0);
      const averagePrice = mockTickets.length > 0 ? totalRevenue / totalSold : 0;
      
      setTicketStats({
        totalSold,
        totalRevenue,
        averagePrice: Math.round(averagePrice),
        topSellingEvent: events[0]?.name || '',
        topAmbassador: ambassadors[0]?.full_name || '',
        monthlySales: [],
        ticketTypeDistribution: [],
        ambassadorPerformance: ambassadors.slice(0, 5).map((amb, index) => ({
          id: amb.id,
          name: amb.full_name,
          city: amb.city,
          ticketsSold: 85 - (index * 15)
        }))
      });
    }
  }, [events, ambassadors]);

  // --- Team Members CRUD Handlers ---
  const openTeamDialog = (member = null) => {
    setEditingTeamMember(member ? { ...member } : { name: '', role: '', photo_url: '', bio: '', social_url: '' });
    setIsTeamDialogOpen(true);
  };
  const closeTeamDialog = () => {
    setEditingTeamMember(null);
    setIsTeamDialogOpen(false);
  };
  const openDeleteTeamDialog = (member) => {
    setTeamMemberToDelete(member);
    setIsDeleteTeamDialogOpen(true);
  };
  const closeDeleteTeamDialog = () => {
    setTeamMemberToDelete(null);
    setIsDeleteTeamDialogOpen(false);
  };
  const handleTeamSave = async (e) => {
    e.preventDefault();
    const isNew = !editingTeamMember?.id;
    let teamMemberId = editingTeamMember?.id;
    const teamData = {
      name: editingTeamMember.name,
      role: editingTeamMember.role,
      photo_url: editingTeamMember.photo_url || null,
      bio: editingTeamMember.bio || null,
      social_url: editingTeamMember.social_url || null,
    };
    let error;
    try {
      let affectedRows = 0;
      if (isNew) {
        const { data, error: insertError } = await supabase.from('team_members').insert(teamData).select().single();
        error = insertError;
        if (data && data.id) {
          teamMemberId = data.id;
          affectedRows = 1;
        }
      } else {
        const { data: updateData, error: updateError } = await supabase.from('team_members').update(teamData).eq('id', teamMemberId).select();
        error = updateError;
        affectedRows = Array.isArray(updateData) ? updateData.length : 0;
      }
      // Refresh team members
      const { data: teamDataList } = await supabase.from('team_members').select('*').order('created_at', { ascending: true });
      setTeamMembers(teamDataList);
      if ((isNew && affectedRows > 0) || (!isNew && affectedRows > 0)) {
        closeTeamDialog();
        toast({
          title: 'Team member saved',
          description: 'Team member details updated successfully.',
        });
      } else {
        toast({
          title: 'Error',
          description: 'No team member was updated. Please check your data.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Team member save error:', err);
      toast({
        title: 'Error',
        description: 'Failed to save team member. Please try again.',
        variant: 'destructive',
      });
    }
  };
  const handleDeleteTeamMember = async () => {
    if (!teamMemberToDelete) return;
    try {
      await supabase.from('team_members').delete().eq('id', teamMemberToDelete.id);
      setTeamMembers(teamMembers.filter(m => m.id !== teamMemberToDelete.id));
      closeDeleteTeamDialog();
      toast({
        title: 'Team member deleted',
        description: 'Team member removed successfully.',
      });
    } catch (err) {
      console.error('Delete team member error:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete team member. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Contact Messages handlers
  const openDeleteMessageDialog = (message: any) => {
    setMessageToDelete(message);
    setIsDeleteMessageDialogOpen(true);
  };

  const closeDeleteMessageDialog = () => {
    setMessageToDelete(null);
    setIsDeleteMessageDialogOpen(false);
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    try {
      await supabase.from('contact_messages').delete().eq('id', messageToDelete.id);
      setContactMessages(contactMessages.filter(m => m.id !== messageToDelete.id));
      closeDeleteMessageDialog();
      toast({
        title: 'Message deleted',
        description: 'Contact message removed successfully.',
      });
    } catch (err) {
      console.error('Delete message error:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Ticket Management handlers (placeholder for now)
  const openTicketDialog = (ticket = null) => {
    toast({
      title: 'Coming Soon',
      description: 'Ticket management will be available once the database table is created.',
    });
  };

  const closeTicketDialog = () => {
    setIsTicketDialogOpen(false);
  };

  const openDeleteTicketDialog = (ticket) => {
    toast({
      title: 'Coming Soon',
      description: 'Ticket deletion will be available once the database table is created.',
    });
  };

  const closeDeleteTicketDialog = () => {
    setIsDeleteTicketDialogOpen(false);
  };

  const handleTicketSave = async (e) => {
    e.preventDefault();
    toast({
      title: 'Coming Soon',
      description: 'Ticket saving will be available once the database table is created.',
    });
  };

  const handleDeleteTicket = async () => {
    toast({
      title: 'Coming Soon',
      description: 'Ticket deletion will be available once the database table is created.',
    });
  };

  const tabsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tabsListRef.current) {
      tabsListRef.current.scrollLeft = 0;
    }
  }, []);

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTimeLeft(prev => {
        if (prev <= 1) {
          // Session expired
          toast({
            title: language === 'en' ? "Session Expired" : "Session expirée",
            description: language === 'en' 
              ? "Your session has expired. Please login again."
              : "Votre session a expiré. Veuillez vous reconnecter.",
            variant: "destructive",
          });
          navigate('/admin/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, toast, language]);

  // Add JWT expiration handling
  useEffect(() => {
    const handleApiError = (response: Response) => {
      if (response.status === 401) {
        // Token expired - redirect to login
        toast({
          title: language === 'en' ? "Session Expired" : "Session expirée",
          description: language === 'en' 
            ? "Your session has expired. Please login again."
            : "Votre session a expiré. Veuillez vous reconnecter.",
          variant: "destructive",
        });
        navigate('/admin/login');
        return true; // Error handled
      }
      return false; // Not a 401 error
    };

    // Override fetch to handle 401 errors globally
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        handleApiError(response);
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [navigate, toast, language]);

  if (loading) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text="Loading dashboard..."
      />
    );
  }

  // Check if accessed on mobile device
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="max-w-md w-full glass border-border/50 shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-gradient-to-r from-primary via-secondary to-accent rounded-full flex items-center justify-center relative overflow-hidden animate-pulse-glow">
              <Monitor className="w-10 h-10 text-primary-foreground relative z-10" />
            </div>
            <div>
              <h2 className="text-2xl font-orbitron font-bold text-gradient-neon mb-2">
                {language === 'en' ? 'Desktop Only' : 'Ordinateur Seulement'}
              </h2>
              <p className="text-muted-foreground">
                {language === 'en' 
                  ? 'The admin dashboard is only available on desktop computers. Please access it from a PC or laptop for the best experience.'
                  : 'Le tableau de bord admin est uniquement disponible sur les ordinateurs de bureau. Veuillez y accéder depuis un PC ou un ordinateur portable pour une meilleure expérience.'}
              </p>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {language === 'en'
                  ? 'For security and usability reasons, the admin dashboard requires a larger screen.'
                  : 'Pour des raisons de sécurité et d\'utilisabilité, le tableau de bord admin nécessite un écran plus grand.'}
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate('/')}
              className="btn-gradient w-full"
            >
              {language === 'en' ? 'Back to Home' : 'Retour à l\'accueil'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="pt-16 min-h-screen bg-background min-w-0">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border/20 min-h-screen flex flex-col">
          <div className="p-4 border-b border-border/20">
            <h2 className="text-lg font-semibold">Navigation</h2>
          </div>
          <div className="p-2 flex-1">
            <div className="space-y-1 animate-in slide-in-from-left-4 duration-700">
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-100 ${
                  activeTab === "overview" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <BarChart3 className={`w-4 h-4 transition-transform duration-300 ${activeTab === "overview" ? "animate-pulse" : ""}`} />
                <span>{t.overview}</span>
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-200 ${
                  activeTab === "events" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <Calendar className={`w-4 h-4 transition-transform duration-300 ${activeTab === "events" ? "animate-pulse" : ""}`} />
                <span>{t.events}</span>
              </button>
              <button
                onClick={() => setActiveTab("ambassadors")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-300 ${
                  activeTab === "ambassadors" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <Users className={`w-4 h-4 transition-transform duration-300 ${activeTab === "ambassadors" ? "animate-pulse" : ""}`} />
                <span>{t.ambassadors}</span>
              </button>
              <button
                onClick={() => setActiveTab("applications")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-400 ${
                  activeTab === "applications" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <FileText className={`w-4 h-4 transition-transform duration-300 ${activeTab === "applications" ? "animate-pulse" : ""}`} />
                <span>{t.applications}</span>
              </button>
              <button
                onClick={() => setActiveTab("sponsors")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-500 ${
                  activeTab === "sponsors" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <Building2 className={`w-4 h-4 transition-transform duration-300 ${activeTab === "sponsors" ? "animate-pulse" : ""}`} />
                <span>Sponsors</span>
              </button>
              <button
                onClick={() => setActiveTab("team")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-600 ${
                  activeTab === "team" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <Users2 className={`w-4 h-4 transition-transform duration-300 ${activeTab === "team" ? "animate-pulse" : ""}`} />
                <span>Team</span>
              </button>
              <button
                onClick={() => setActiveTab("contact")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-700 ${
                  activeTab === "contact" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <MessageCircle className={`w-4 h-4 transition-transform duration-300 ${activeTab === "contact" ? "animate-pulse" : ""}`} />
                <span>Contact Messages</span>
              </button>
              <button
                onClick={() => setActiveTab("tickets")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-800 ${
                  activeTab === "tickets" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <DollarSign className={`w-4 h-4 transition-transform duration-300 ${activeTab === "tickets" ? "animate-pulse" : ""}`} />
                <span>Ticket Management</span>
              </button>
              <button
                onClick={() => setActiveTab("marketing")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-850 ${
                  activeTab === "marketing" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <Megaphone className={`w-4 h-4 transition-transform duration-300 ${activeTab === "marketing" ? "animate-pulse" : ""}`} />
                <span>{language === 'en' ? 'Marketing' : 'Marketing'}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("logs");
                  fetchSiteLogs();
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-875 ${
                  activeTab === "logs" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <Activity className={`w-4 h-4 transition-transform duration-300 ${activeTab === "logs" ? "animate-pulse" : ""}`} />
                <span>{t.logs}</span>
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-900 ${
                  activeTab === "settings" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <Settings className={`w-4 h-4 transition-transform duration-300 ${activeTab === "settings" ? "animate-pulse" : ""}`} />
                <span>{t.settings}</span>
              </button>
            </div>
          </div>
          <div className="p-4 border-t border-border/20">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 transition-all duration-300 transform hover:scale-105 hover:shadow-md hover:bg-destructive hover:text-destructive-foreground animate-in slide-in-from-left-4 duration-500 delay-900"
            >
              <LogOut className="w-4 h-4 transition-transform duration-300 hover:animate-pulse" />
              <span>{t.logout}</span>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start min-w-0 animate-in slide-in-from-top-4 fade-in duration-700">
              <div>
                <h1 className="text-4xl font-orbitron font-bold text-gradient-neon mb-2 animate-in slide-in-from-left-4 duration-1000">
                  {t.title}
                </h1>
                <p className="text-muted-foreground animate-in slide-in-from-left-4 duration-1000 delay-300">
                  {t.subtitle}
                </p>
              </div>
              {/* Session Timer */}
              <div className="flex items-center gap-2 bg-card/50 px-4 py-2 rounded-lg border border-border/20">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm font-medium">
                  {language === 'en' ? 'Session:' : 'Session:'} {Math.floor(sessionTimeLeft / 3600)}h {Math.floor((sessionTimeLeft % 3600) / 60)}m {sessionTimeLeft % 60}s
                </span>
              </div>
            </div>

            {/* Tabs Content - keeping all existing content exactly the same */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 min-w-0">
              {/* Tabs Content - separated from navigation */}
              <TabsContent value="overview" className="space-y-6 mt-20 sm:mt-0">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 w-full px-2">
                  <Card 
                    className={`transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg ${
                      animatedCards.has(0) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-8 h-8 text-yellow-500 animate-pulse" />
                        <div>
                          <p className="text-sm text-muted-foreground">{t.pendingApplications}</p>
                          <p className="text-2xl font-bold animate-in slide-in-from-right-4 duration-1000 delay-300">
                            {pendingApplications.length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg ${
                      animatedCards.has(1) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200' 
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-8 h-8 text-green-500 animate-pulse" />
                        <div>
                          <p className="text-sm text-muted-foreground">{t.approvedApplications}</p>
                          <p className="text-2xl font-bold animate-in slide-in-from-right-4 duration-1000 delay-500">
                            {approvedCount}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg ${
                      animatedCards.has(2) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400' 
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-8 h-8 text-blue-500 animate-pulse" />
                        <div>
                          <p className="text-sm text-muted-foreground">{t.totalEvents}</p>
                          <p className="text-2xl font-bold animate-in slide-in-from-right-4 duration-1000 delay-700">
                            {events.length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg ${
                      animatedCards.has(3) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-600' 
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-2">
                        <Users className="w-8 h-8 text-purple-500 animate-pulse" />
                        <div>
                          <p className="text-sm text-muted-foreground">{t.approvedAmbassadors}</p>
                          <p className="text-2xl font-bold animate-in slide-in-from-right-4 duration-1000 delay-900">
                            {ambassadors.length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card className="animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-800 hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-700 delay-900">
                      <TrendingUp className="w-5 h-5 animate-pulse transition-transform duration-300 hover:scale-110" />
                      <span className="animate-in slide-in-from-left-4 duration-700 delay-1000">Recent Activity</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {applications.slice(0, 5).map((app, index) => (
                        <div 
                          key={app.id} 
                          className={`flex items-center justify-between p-3 bg-muted rounded-lg transform transition-all duration-300 hover:scale-105 hover:shadow-md animate-in slide-in-from-left-4 fade-in duration-500 ${
                            index === 0 ? 'delay-1100' :
                            index === 1 ? 'delay-1200' :
                            index === 2 ? 'delay-1300' :
                            index === 3 ? 'delay-1400' :
                            'delay-1500'
                          }`}
                        >
                          <div className="animate-in slide-in-from-left-4 duration-500 delay-200">
                            <p className="font-medium transition-colors duration-300">{app.full_name}</p>
                            <p className="text-sm text-muted-foreground transition-colors duration-300">{app.city} • {app.phone_number}</p>
                          </div>
                          <div className="animate-in zoom-in-95 duration-300 delay-300 hover:scale-110 transition-transform duration-300">
                            {getStatusBadge(app.status)}
                          </div>
                        </div>
                      ))}
                      {applications.length === 0 && (
                        <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-1100">
                          <p className="text-center text-muted-foreground py-8 animate-in fade-in duration-500">
                            {t.noApplications}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Events Tab */}
              <TabsContent value="events" className="space-y-6">
                <div className="flex justify-between items-center mb-4 animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">Events Management</h2>
                  <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingEvent({} as Event);
                          setIsEventDialogOpen(true);
                        }}
                        className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
                      >
                        <Plus className="w-4 h-4 mr-2 animate-pulse" />
                        {t.add}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                      <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                        <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                          {editingEvent?.id ? 'Edit Event' : 'Add New Event'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                            <Label htmlFor="eventName">{t.eventName}</Label>
                            <Input
                              id="eventName"
                              value={editingEvent?.name || ''}
                              onChange={(e) => setEditingEvent(prev => ({ ...prev, name: e.target.value }))}
                              className="transition-all duration-300 focus:scale-105"
                            />
                          </div>
                          <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                            <Label htmlFor="eventDate">{t.eventDate}</Label>
                            <Input
                              id="eventDate"
                              type="datetime-local"
                              value={editingEvent?.date ? editingEvent.date.slice(0, 16) : ''}
                              onChange={(e) => setEditingEvent(prev => ({ ...prev, date: e.target.value }))}
                              className="transition-all duration-300 focus:scale-105"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="eventVenue">{t.eventVenue}</Label>
                            <Input
                              id="eventVenue"
                              value={editingEvent?.venue || ''}
                              onChange={(e) => setEditingEvent(prev => ({ ...prev, venue: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="eventCity">{t.eventCity}</Label>
                            <Input
                              id="eventCity"
                              value={editingEvent?.city || ''}
                              onChange={(e) => setEditingEvent(prev => ({ ...prev, city: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="eventDescription">{t.eventDescription}</Label>
                          <Textarea
                            id="eventDescription"
                            value={editingEvent?.description || ''}
                            onChange={(e) => setEditingEvent(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="eventWhatsappLink">{t.eventWhatsappLink}</Label>
                          <Input
                            id="eventWhatsappLink"
                            value={editingEvent?.whatsapp_link || ''}
                            onChange={(e) => setEditingEvent(prev => ({ ...prev, whatsapp_link: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="eventStandardPrice">{t.eventStandardPrice}</Label>
                            <Input
                              id="eventStandardPrice"
                              type="number"
                              value={editingEvent?.standard_price || ''}
                              onChange={(e) => setEditingEvent(prev => ({ ...prev, standard_price: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="eventVipPrice">{t.eventVipPrice}</Label>
                            <Input
                              id="eventVipPrice"
                              type="number"
                              value={editingEvent?.vip_price || ''}
                              onChange={(e) => setEditingEvent(prev => ({ ...prev, vip_price: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="eventType">{t.eventType}</Label>
                          <Select value={editingEvent?.event_type || 'upcoming'} onValueChange={(value: 'upcoming' | 'gallery') => setEditingEvent(prev => ({ ...prev, event_type: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upcoming">{t.eventTypeUpcoming}</SelectItem>
                              <SelectItem value="gallery">{t.eventTypeGallery}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="eventFeatured"
                            checked={editingEvent?.featured || false}
                            onChange={(e) => setEditingEvent(prev => ({ ...prev, featured: e.target.checked }))}
                          />
                          <Label htmlFor="eventFeatured">{t.eventFeatured}</Label>
                        </div>
                        <div>
                          <Label>{t.eventPoster}</Label>
                          <FileUpload
                            onFileSelect={(file) => setEditingEvent(prev => ({ ...prev, _uploadFile: file }))}
                            onUrlChange={(url) => setEditingEvent(prev => ({ ...prev, poster_url: url }))}
                            currentUrl={editingEvent?.poster_url}
                            accept="image/*"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-800">
                        <DialogClose asChild>
                          <Button 
                            variant="outline"
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            {t.cancel}
                          </Button>
                        </DialogClose>
                        <Button 
                          onClick={async () => {
                            await handleSaveEvent(editingEvent, editingEvent._uploadFile);
                            setIsEventDialogOpen(false);
                          }}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Save className="w-4 h-4 mr-2 animate-pulse" />
                          {t.save}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event, index) => (
                    <Card 
                      key={event.id}
                      className={`transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg ${
                        animatedEvents.has(event.id) 
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
                            <Calendar className="w-4 h-4 animate-pulse" />
                            <span>{new Date(event.date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-400">
                            <MapPin className="w-4 h-4 animate-pulse" />
                            <span>{event.venue}, {event.city}</span>
                          </div>
                          {event.standard_price && (
                            <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-500">
                              <DollarSign className="w-4 h-4 animate-pulse" />
                              <span>Standard: {event.standard_price} TND</span>
                            </div>
                          )}
                          {event.vip_price && (
                            <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-600">
                              <DollarSign className="w-4 h-4 animate-pulse" />
                              <span>VIP: {event.vip_price} TND</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-700">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setEditingEvent(event);
                              setIsEventDialogOpen(true);
                            }}
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            {t.edit}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteEvent(event.id)}
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t.delete}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {events.length === 0 && (
                  <div className="text-center py-8 animate-in fade-in duration-500">
                    <p className="text-muted-foreground animate-pulse">{t.noEvents}</p>
                  </div>
                )}
              </TabsContent>


              

              {/* Ambassadors Tab */}
              <TabsContent value="ambassadors" className="space-y-6">
                <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">Ambassadors Management</h2>
                  <Dialog open={isAmbassadorDialogOpen} onOpenChange={setIsAmbassadorDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingAmbassador({} as Ambassador);
                          setIsAmbassadorDialogOpen(true);
                        }}
                        className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
                      >
                        <Plus className="w-4 h-4 mr-2 animate-pulse" />
                        {t.add}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                      <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                        <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                          {editingAmbassador?.id ? 'Edit Ambassador' : 'Add New Ambassador'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                            <Label htmlFor="ambassadorName">{t.ambassadorName}</Label>
                            <Input
                              id="ambassadorName"
                              value={editingAmbassador?.full_name || ''}
                              onChange={(e) => setEditingAmbassador(prev => ({ ...prev, full_name: e.target.value }))}
                              className="transition-all duration-300 focus:scale-105"
                            />
                          </div>
                          <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                            <Label htmlFor="ambassadorPhone">{t.ambassadorPhone}</Label>
                            <Input
                              id="ambassadorPhone"
                              value={editingAmbassador?.phone || ''}
                              onChange={(e) => setEditingAmbassador(prev => ({ ...prev, phone: e.target.value }))}
                              className="transition-all duration-300 focus:scale-105"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="ambassadorEmail">{t.ambassadorEmail}</Label>
                            <Input
                              id="ambassadorEmail"
                              type="email"
                              value={editingAmbassador?.email || ''}
                              onChange={(e) => setEditingAmbassador(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="ambassadorCity">{t.ambassadorCity}</Label>
                            <Input
                              id="ambassadorCity"
                              value={editingAmbassador?.city || ''}
                              onChange={(e) => setEditingAmbassador(prev => ({ ...prev, city: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="ambassadorCommission">{t.ambassadorCommission}</Label>
                            <Input
                              id="ambassadorCommission"
                              type="number"
                              step="0.01"
                              value={editingAmbassador?.commission_rate || ''}
                              onChange={(e) => setEditingAmbassador(prev => ({ ...prev, commission_rate: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="animate-in slide-in-from-left-4 duration-500 delay-700">
                            <Label htmlFor="ambassadorPassword">{t.ambassadorPassword}</Label>
                            <div className="relative">
                              <Input
                                id="ambassadorPassword"
                                type={showPassword ? "text" : "password"}
                                value={editingAmbassador?.password || ''}
                                onChange={(e) => setEditingAmbassador(prev => ({ ...prev, password: e.target.value }))}
                                className="transition-all duration-300 focus:scale-105"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 transition-all duration-300 hover:scale-110"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4 animate-pulse" /> : <Eye className="w-4 h-4 animate-pulse" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-800">
                        <DialogClose asChild>
                          <Button 
                            variant="outline"
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            {t.cancel}
                          </Button>
                        </DialogClose>
                        <Button 
                          onClick={async () => {
                            await handleSaveAmbassador(editingAmbassador);
                            setIsAmbassadorDialogOpen(false);
                          }}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Save className="w-4 h-4 mr-2 animate-pulse" />
                          {t.save}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ambassadors.map((ambassador, index) => (
                    <Card 
                      key={ambassador.id}
                      className={`transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg ${
                        animatedAmbassadors.has(ambassador.id) 
                          ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                          : 'opacity-0 translate-y-8'
                      } ${ambassador.commission_rate >= 15 ? 'ring-2 ring-green-500/20 shadow-lg' : ''}`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold animate-in slide-in-from-left-4 duration-500 delay-200">
                            {ambassador.full_name}
                          </h3>
                          {ambassador.commission_rate >= 15 && (
                            <Badge className="bg-green-500 animate-pulse">
                              Top Performer
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-300">
                            <Phone className="w-4 h-4 animate-pulse" />
                            <span>{ambassador.phone}</span>
                          </div>
                          {ambassador.email && (
                            <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-400">
                              <Mail className="w-4 h-4 animate-pulse" />
                              <span>{ambassador.email}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-500">
                            <MapPin className="w-4 h-4 animate-pulse" />
                            <span>{ambassador.city}</span>
                          </div>
                          <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-600">
                            <DollarSign className="w-4 h-4 animate-pulse" />
                            <span>Commission: {ambassador.commission_rate}%</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-700">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setEditingAmbassador(ambassador);
                              setIsAmbassadorDialogOpen(true);
                            }}
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            {t.edit}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => setAmbassadorToDelete(ambassador)}
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t.delete}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {ambassadors.length === 0 && (
                  <div className="text-center py-8 animate-in fade-in duration-500">
                    <p className="text-muted-foreground animate-pulse">{t.noAmbassadors}</p>
                  </div>
                )}
              </TabsContent>

              {/* Applications Tab */}
              <TabsContent value="applications" className="space-y-6">
                <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">Ambassador Applications</h2>
                  <div className="animate-in slide-in-from-right-4 duration-1000 delay-300">
                    <Badge className="bg-blue-500 animate-pulse">
                      {filteredApplications.length} Applications
                    </Badge>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500">
                  <div className="relative">
                    <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search by name, email, phone, or city..."
                      value={applicationSearchTerm}
                      onChange={(e) => setApplicationSearchTerm(e.target.value)}
                      className="pl-10 transition-all duration-300 focus:scale-105"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredApplications.map((application, index) => (
                    <Card 
                      key={application.id}
                      className={`transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-lg ${
                        animatedApplications.has(application.id) 
                          ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                          : 'opacity-0 translate-y-8'
                      }`}
                    >
                      <CardContent className="p-6">
                        <div>
                          <div className="space-y-4">
                            {/* Header with name and status */}
                            <div className="flex items-center justify-between animate-in slide-in-from-left-4 duration-500 delay-200">
                              <h3 className="text-xl font-semibold">{application.full_name}</h3>
                              <div className="animate-in zoom-in-95 duration-300 delay-400">
                                {getStatusBadge(application.status)}
                              </div>
                            </div>

                            {/* Application details grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-300">
                                <User className="w-4 h-4 animate-pulse" />
                                <span className="font-medium">Age:</span>
                                <span className="text-muted-foreground">{application.age} years</span>
                              </div>
                              <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-400">
                                <Phone className="w-4 h-4 animate-pulse" />
                                <span className="font-medium">Phone:</span>
                                <span className="text-muted-foreground">{application.phone_number}</span>
                              </div>
                              {application.email && (
                                <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-500">
                                  <Mail className="w-4 h-4 animate-pulse" />
                                  <span className="font-medium">Email:</span>
                                  <span className="text-muted-foreground break-all">{application.email}</span>
                                </div>
                              )}
                              <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-600">
                                <MapPin className="w-4 h-4 animate-pulse" />
                                <span className="font-medium">City:</span>
                                <span className="text-muted-foreground">{application.city}</span>
                              </div>
                              <div className="flex items-center space-x-2 animate-in slide-in-from-left-4 duration-500 delay-700">
                                <Calendar className="w-4 h-4 animate-pulse" />
                                <span className="font-medium">Applied:</span>
                                <span className="text-muted-foreground">{new Date(application.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            {/* Motivation section */}
                            {application.motivation && (
                              <div className="mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-800">
                                <h4 className="font-medium mb-2 flex items-center space-x-2">
                                  <FileText className="w-4 h-4" />
                                  <span>Motivation</span>
                                </h4>
                                <div className="bg-muted p-4 rounded-lg border-l-4 border-primary">
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    {application.motivation}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Social link section */}
                            {application.social_link && (
                              <div className="mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-900">
                                <h4 className="font-medium mb-2 flex items-center space-x-2">
                                  <Instagram className="w-4 h-4" />
                                  <span>Social Media</span>
                                </h4>
                                <div className="bg-muted p-3 rounded-lg">
                                  <SocialLink url={application.social_link} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-1000">
                            {application.status === 'pending' && (
                              <>
                                <Button 
                                  onClick={() => handleApprove(application)}
                                  disabled={processingId === application.id}
                                  className="bg-green-600 hover:bg-green-700 transform hover:scale-105 transition-all duration-300"
                                >
                                  {processingId === application.id ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                      {t.processing}
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      {t.approve}
                                    </>
                                  )}
                                </Button>
                                <Button 
                                  onClick={() => handleReject(application)}
                                  disabled={processingId === application.id}
                                  variant="destructive"
                                  className="transform hover:scale-105 transition-all duration-300"
                                >
                                  {processingId === application.id ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                      {t.processing}
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 mr-2" />
                                      {t.reject}
                                    </>
                                  )}
                                </Button>
                              </>
                            )}

                            {/* Email recovery buttons for approved applications with failed emails */}
                            {application.status === 'approved' && emailFailedApplications.has(application.id) && (
                              <div className="flex gap-2 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex-1">
                                  <p className="text-sm text-yellow-800 font-medium mb-2">
                                    ⚠️ Email failed to send. Use these options:
                                  </p>
                                  <div className="flex gap-2">
                                    <Button 
                                      onClick={() => resendEmail(application)}
                                      disabled={processingId === application.id}
                                      size="sm"
                                      className="bg-blue-600 hover:bg-blue-700 transform hover:scale-105 transition-all duration-300"
                                    >
                                      {processingId === application.id ? (
                                        <>
                                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                                          Sending...
                                        </>
                                      ) : (
                                        <>
                                          <Mail className="w-3 h-3 mr-1" />
                                          Resend Email
                                        </>
                                      )}
                                    </Button>
                                    <Button 
                                      onClick={() => copyCredentials(application)}
                                      size="sm"
                                      variant="outline"
                                      className="transform hover:scale-105 transition-all duration-300"
                                    >
                                      <Copy className="w-3 h-3 mr-1" />
                                      Copy Credentials
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredApplications.length === 0 && (
                    <div className="text-center py-8 animate-in fade-in duration-500">
                      {applicationSearchTerm ? (
                        <div className="space-y-2">
                          <p className="text-muted-foreground animate-pulse">No applications found matching "{applicationSearchTerm}"</p>
                          <Button 
                            variant="outline" 
                            onClick={() => setApplicationSearchTerm('')}
                            className="transform hover:scale-105 transition-all duration-300"
                          >
                            Clear Search
                          </Button>
                        </div>
                      ) : (
                        <p className="text-muted-foreground animate-pulse">{t.noApplications}</p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Sponsors Tab */}
              <TabsContent value="sponsors" className="space-y-6">
                <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">Sponsors</h2>
                  <Button 
                    variant="default" 
                    onClick={() => openSponsorDialog()}
                    className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-2 animate-pulse" />
                    Add Sponsor
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sponsors.map((sponsor, index) => (
                    <div 
                      key={sponsor.id} 
                      className={`rounded-xl bg-card p-6 shadow-lg flex flex-col items-center justify-center transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                        animatedSponsors.has(sponsor.id) 
                          ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                          : 'opacity-0 translate-y-8'
                      }`}
                    >
                      {sponsor.logo_url && (
                        <div className="animate-in zoom-in-95 duration-500 delay-200">
                          <img 
                            src={sponsor.logo_url} 
                            alt={sponsor.name} 
                            className="w-32 h-20 object-contain mb-3 rounded-lg transform transition-transform duration-300 hover:scale-110" 
                          />
                        </div>
                      )}
                      <h3 className="font-semibold mb-1 animate-in slide-in-from-left-4 duration-500 delay-300">
                        {sponsor.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-2 animate-in slide-in-from-left-4 duration-500 delay-400">
                        {sponsor.description || sponsor.category}
                      </p>
                      <div className="flex gap-2 mb-2 animate-in slide-in-from-bottom-4 duration-500 delay-500">
                        <Badge className="bg-primary text-white animate-pulse">
                          Global
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-2 animate-in slide-in-from-bottom-4 duration-500 delay-600">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => openSponsorDialog(sponsor)}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => openDeleteDialog(sponsor)}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                                {sponsors.length === 0 && (
                  <div className="text-center py-8 animate-in fade-in duration-500">
                    <p className="text-muted-foreground animate-pulse">No sponsors found</p>
                  </div>
                )}

                {/* Add/Edit Sponsor Dialog */}
                <Dialog open={isSponsorDialogOpen} onOpenChange={setIsSponsorDialogOpen}>
                  <DialogContent className="max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                    <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                      <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                        {editingSponsor?.id ? 'Edit Sponsor' : 'Add Sponsor'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSponsorSave} className="animate-in slide-in-from-bottom-4 duration-700 delay-300">
                      <div className="space-y-4">
                        <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                          <Label htmlFor="sponsorName">Name</Label>
                          <Input
                            id="sponsorName"
                            value={editingSponsor?.name || ''}
                            onChange={(e) => setEditingSponsor(prev => ({ ...prev, name: e.target.value }))}
                            required
                            className="transition-all duration-300 focus:scale-105"
                          />
                        </div>
                        <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                          <Label htmlFor="sponsorDescription">Description</Label>
                          <Textarea
                            id="sponsorDescription"
                            value={editingSponsor?.description || ''}
                            onChange={(e) => setEditingSponsor(prev => ({ ...prev, description: e.target.value }))}
                            className="transition-all duration-300 focus:scale-105"
                          />
                        </div>
                        <div className="animate-in slide-in-from-left-4 duration-500 delay-600">
                          <Label htmlFor="sponsorWebsite">Website URL</Label>
                          <Input
                            id="sponsorWebsite"
                            type="url"
                            value={editingSponsor?.website_url || ''}
                            onChange={(e) => setEditingSponsor(prev => ({ ...prev, website_url: e.target.value }))}
                            className="transition-all duration-300 focus:scale-105"
                          />
                        </div>
                        <div className="animate-in slide-in-from-right-4 duration-500 delay-700">
                          <Label htmlFor="sponsorCategory">Category</Label>
                          <Input
                            id="sponsorCategory"
                            value={editingSponsor?.category || ''}
                            onChange={(e) => setEditingSponsor(prev => ({ ...prev, category: e.target.value }))}
                            className="transition-all duration-300 focus:scale-105"
                          />
                        </div>
                        <div className="animate-in slide-in-from-left-4 duration-500 delay-800">
                          <Label>Logo</Label>
                          <FileUpload
                            onFileSelect={(file) => setEditingSponsor(prev => ({ ...prev, _uploadFile: file }))}
                            onUrlChange={(url) => setEditingSponsor(prev => ({ ...prev, logo_url: url }))}
                            currentUrl={editingSponsor?.logo_url}
                            accept="image/*"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-900">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={closeSponsorDialog}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Save className="w-4 h-4 mr-2 animate-pulse" />
                          Save
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Delete Sponsor Dialog */}
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogContent className="animate-in zoom-in-95 duration-300">
                    <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                      <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                        Delete Sponsor
                      </DialogTitle>
                    </DialogHeader>
                    <p className="animate-in slide-in-from-bottom-4 duration-500 delay-300">
                      Are you sure you want to delete this sponsor?
                    </p>
                    <div className="flex justify-end gap-2 mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-500">
                      <DialogClose asChild>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={closeDeleteDialog}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button 
                        type="button" 
                        variant="destructive" 
                        onClick={handleDeleteSponsor}
                        className="transform hover:scale-105 transition-all duration-300"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" className="space-y-6">
                <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">Team Members</h2>
                  <Button 
                    variant="default" 
                    onClick={() => openTeamDialog()}
                    className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-2 animate-pulse" />
                    Add Team Member
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full px-2">
                  {teamMembers.map((member, index) => (
                    <div 
                      key={member.id} 
                      className={`rounded-xl bg-card p-6 shadow-lg flex flex-col items-center justify-center transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                        animatedTeamMembers.has(member.id) 
                          ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                          : 'opacity-0 translate-y-8'
                      }`}
                    >
                      {member.photo_url && (
                        <div className="animate-in zoom-in-95 duration-500 delay-200">
                          <img 
                            src={member.photo_url} 
                            alt={member.name} 
                            className="w-24 h-24 object-cover mb-3 rounded-full transform transition-transform duration-300 hover:scale-110" 
                          />
                        </div>
                      )}
                      <h3 className="font-semibold mb-1 animate-in slide-in-from-left-4 duration-500 delay-300">
                        {member.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-1 animate-in slide-in-from-left-4 duration-500 delay-400">
                        {member.role}
                      </p>
                      {member.bio && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2 animate-in slide-in-from-left-4 duration-500 delay-500">
                          {member.bio}
                        </p>
                      )}
                      {member.social_url && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-600">
                          <a 
                            href={member.social_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-primary hover:underline text-xs mb-2 transform hover:scale-105 transition-all duration-300"
                          >
                            Social
                          </a>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2 animate-in slide-in-from-bottom-4 duration-500 delay-700">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => openTeamDialog(member)}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => openDeleteTeamDialog(member)}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                                {teamMembers.length === 0 && (
                  <div className="text-center py-8 animate-in fade-in duration-500">
                    <p className="text-muted-foreground animate-pulse">No team members found</p>
                  </div>
                )}

                {/* Add/Edit Team Member Dialog */}
                <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
                  <DialogContent className="max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                    <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                      <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                        {editingTeamMember?.id ? 'Edit Team Member' : 'Add Team Member'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTeamSave} className="animate-in slide-in-from-bottom-4 duration-700 delay-300">
                      <div className="space-y-4">
                        <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                          <Label htmlFor="memberName">Name</Label>
                          <Input
                            id="memberName"
                            value={editingTeamMember?.name || ''}
                            onChange={(e) => setEditingTeamMember(prev => ({ ...prev, name: e.target.value }))}
                            required
                            className="transition-all duration-300 focus:scale-105"
                          />
                        </div>
                        <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                          <Label htmlFor="memberRole">Role</Label>
                          <Input
                            id="memberRole"
                            value={editingTeamMember?.role || ''}
                            onChange={(e) => setEditingTeamMember(prev => ({ ...prev, role: e.target.value }))}
                            required
                            className="transition-all duration-300 focus:scale-105"
                          />
                        </div>
                        <div className="animate-in slide-in-from-left-4 duration-500 delay-600">
                          <Label htmlFor="memberBio">Bio</Label>
                          <Textarea
                            id="memberBio"
                            value={editingTeamMember?.bio || ''}
                            onChange={(e) => setEditingTeamMember(prev => ({ ...prev, bio: e.target.value }))}
                            className="transition-all duration-300 focus:scale-105"
                          />
                        </div>
                        <div className="animate-in slide-in-from-right-4 duration-500 delay-700">
                          <Label htmlFor="memberPhoto">Photo</Label>
                          <div className="space-y-2">
                            {editingTeamMember?.photo_url && (
                              <div className="animate-in zoom-in-95 duration-300">
                                <img 
                                  src={editingTeamMember.photo_url} 
                                  alt="Current photo" 
                                  className="w-20 h-20 object-cover rounded-lg border-2 border-border"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Input
                                id="memberPhoto"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    // Handle file upload here
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const result = event.target?.result as string;
                                      setEditingTeamMember(prev => ({ ...prev, photo_url: result }));
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="transition-all duration-300 focus:scale-105"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const input = document.getElementById('memberPhoto') as HTMLInputElement;
                                  input?.click();
                                }}
                                className="transform hover:scale-105 transition-all duration-300"
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="animate-in slide-in-from-left-4 duration-500 delay-800">
                          <Label htmlFor="memberSocial">Social URL</Label>
                          <Input
                            id="memberSocial"
                            type="url"
                            value={editingTeamMember?.social_url || ''}
                            onChange={(e) => setEditingTeamMember(prev => ({ ...prev, social_url: e.target.value }))}
                            className="transition-all duration-300 focus:scale-105"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-900">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={closeTeamDialog}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Save className="w-4 h-4 mr-2 animate-pulse" />
                          Save
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Delete Team Member Dialog */}
                <Dialog open={isDeleteTeamDialogOpen} onOpenChange={setIsDeleteTeamDialogOpen}>
                  <DialogContent className="animate-in zoom-in-95 duration-300">
                    <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                      <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                        Delete Team Member
                      </DialogTitle>
                    </DialogHeader>
                    <p className="animate-in slide-in-from-bottom-4 duration-500 delay-300">
                      Are you sure you want to delete this team member?
                    </p>
                    <div className="flex justify-end gap-2 mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-500">
                      <DialogClose asChild>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={closeDeleteTeamDialog}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button 
                        type="button" 
                        variant="destructive" 
                        onClick={handleDeleteTeamMember}
                        className="transform hover:scale-105 transition-all duration-300"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* Contact Messages Tab */}
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

                {/* Enhanced Search Bar with Animation */}
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
                          ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                          : 'opacity-0 translate-y-8'
                      }`}
                      style={{
                        animationDelay: `${index * 200}ms`,
                        transform: animatedContactMessages.has(message.id) ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)'
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
                            // Copy message details to clipboard
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
                            window.open(`mailto:${message.email}?subject=Re: ${message.subject}`, '_blank');
                          }}
                          className="transform hover:scale-105 hover:shadow-md transition-all duration-300 group"
                        >
                          <Mail className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                          Reply
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => openDeleteMessageDialog(message)}
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

              {/* Delete Message Dialog */}
              <Dialog open={isDeleteMessageDialogOpen} onOpenChange={setIsDeleteMessageDialogOpen}>
                <DialogContent className="animate-in zoom-in-95 duration-300">
                  <DialogHeader className="animate-in slide-in-from-top-4 duration-500">
                    <DialogTitle className="animate-in slide-in-from-left-4 duration-700">
                      Delete Message
                    </DialogTitle>
                  </DialogHeader>
                  <div className="animate-in slide-in-from-bottom-4 duration-500 delay-300">
                    <p className="mb-4">
                      Are you sure you want to delete this message? This action cannot be undone.
                    </p>
                    {messageToDelete && (
                      <div className="bg-muted/50 rounded-lg p-4 mb-4 animate-in slide-in-from-bottom-4 duration-500 delay-400">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold">{messageToDelete.name}</p>
                            <p className="text-sm text-muted-foreground">{messageToDelete.email}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {new Date(messageToDelete.created_at).toLocaleDateString()}
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
                      onClick={closeDeleteMessageDialog}
                      className="transform hover:scale-105 transition-all duration-300"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={handleDeleteMessage}
                      className="transform hover:scale-105 transition-all duration-300"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Message
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Ticket Management Tab */}
              <TabsContent value="tickets" className="space-y-6">
                <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
                    Ticket Management & Analytics
                  </h2>
                  <div className="flex items-center gap-4 animate-in slide-in-from-right-4 duration-1000 delay-300">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="eventSelect" className="text-sm font-medium">Select Event:</Label>
                      <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                        <SelectTrigger className="w-64 transition-all duration-300 hover:shadow-md">
                          <SelectValue placeholder="Select an event" />
                        </SelectTrigger>
                        <SelectContent>
                          {events.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              <div className="flex items-center gap-2">
                                <span>{event.name}</span>
                                {event.event_type === 'upcoming' && (
                                  <Badge variant="secondary" className="text-xs">Upcoming</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge variant="secondary" className="animate-pulse">
                      {tickets.filter(t => t.event_id === selectedEventId).length} tickets
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Force refresh of ticket data
                        const mockTickets = events.map((event, index) => ({
                          id: `ticket-${index + 1}-${Date.now()}`,
                          event_id: event.id,
                          event_name: event.name,
                          ticket_type: index % 3 === 0 ? 'VIP' : index % 3 === 1 ? 'Standard' : 'Premium',
                          price: event.standard_price || 50 + (index * 10),
                          quantity: 100,
                          available_quantity: 100 - (Math.floor(Math.random() * 80) + 10),
                          description: `${index % 3 === 0 ? 'VIP' : index % 3 === 1 ? 'Standard' : 'Premium'} ticket for ${event.name}`,
                          is_active: true,
                          created_at: new Date().toISOString()
                        }));
                        setTickets(mockTickets);
                        
                        const totalSold = mockTickets.reduce((sum, ticket) => sum + (ticket.quantity - ticket.available_quantity), 0);
                        const totalRevenue = mockTickets.reduce((sum, ticket) => sum + ((ticket.quantity - ticket.available_quantity) * ticket.price), 0);
                        const averagePrice = mockTickets.length > 0 ? totalRevenue / totalSold : 0;
                        
                        setTicketStats(prev => ({
                          ...prev,
                          totalSold,
                          totalRevenue,
                          averagePrice: Math.round(averagePrice),
                          ambassadorPerformance: ambassadors.slice(0, 5).map((amb, index) => ({
                            id: amb.id,
                            name: amb.full_name,
                            city: amb.city,
                            ticketsSold: 85 - (index * 15)
                          }))
                        }));
                      }}
                      className="transform hover:scale-105 hover:shadow-md transition-all duration-300 group"
                    >
                      <RefreshCw className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-180" />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Selected Event Information */}
                {selectedEventId && (() => {
                  const selectedEvent = events.find(e => e.id === selectedEventId);
                  return selectedEvent ? (
                    <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-bottom-4 duration-700 delay-300">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gradient-neon">Event Details</h3>
                        <Badge variant={selectedEvent.event_type === 'upcoming' ? 'default' : 'secondary'}>
                          {selectedEvent.event_type === 'upcoming' ? 'Upcoming' : 'Past Event'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Event Name</Label>
                            <p className="text-lg font-semibold">{selectedEvent.name}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Date</Label>
                            <p className="text-lg">{new Date(selectedEvent.date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Venue</Label>
                            <p className="text-lg">{selectedEvent.venue}, {selectedEvent.city}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Standard Price</Label>
                            <p className="text-lg font-semibold text-green-500">{selectedEvent.standard_price || 0} TND</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">VIP Price</Label>
                            <p className="text-lg font-semibold text-blue-500">{selectedEvent.vip_price || 0} TND</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Enhanced Analytics Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-200">
                  <div className="bg-card rounded-xl p-6 shadow-lg transform hover:scale-105 hover:shadow-xl transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-300 group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Tickets</p>
                        <p className="text-2xl font-bold text-primary group-hover:scale-110 transition-transform duration-300">{ticketStats.totalTickets}</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                        <DollarSign className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl p-6 shadow-lg transform hover:scale-105 hover:shadow-xl transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-400 group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Tickets Sold</p>
                        <p className="text-2xl font-bold text-green-500 group-hover:scale-110 transition-transform duration-300">{ticketStats.soldTickets}</p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center group-hover:bg-green-500/20 transition-colors duration-300">
                        <TrendingUp className="w-6 h-6 text-green-500 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl p-6 shadow-lg transform hover:scale-105 hover:shadow-xl transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-500 group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Available Tickets</p>
                        <p className="text-2xl font-bold text-blue-500 group-hover:scale-110 transition-transform duration-300">{ticketStats.availableTickets}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors duration-300">
                        <BarChart3 className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl p-6 shadow-lg transform hover:scale-105 hover:shadow-xl transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-600 group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-orange-500 group-hover:scale-110 transition-transform duration-300">{ticketStats.revenue.toLocaleString()} TND</p>
                      </div>
                      <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center group-hover:bg-orange-500/20 transition-colors duration-300">
                        <CheckCircle className="w-6 h-6 text-orange-500 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Charts and Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-400">
                  {/* Enhanced Sales by Event Chart */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-left-4 duration-500 delay-500 hover:shadow-xl transition-all duration-300 group">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform duration-300" />
                      Ticket Sales by Type
                    </h3>
                    <div className="h-64 bg-muted/20 rounded-lg p-4 transition-all duration-300 group-hover:bg-muted/30">
                      <div className="relative h-full">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground">
                          <span>100</span>
                          <span>75</span>
                          <span>50</span>
                          <span>25</span>
                          <span>0</span>
                        </div>
                        
                        {/* Chart area */}
                        <div className="absolute left-12 right-0 top-0 bottom-0">
                          {/* Grid lines */}
                          <div className="absolute inset-0 flex flex-col justify-between">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <div key={i} className="border-b border-muted/20 h-0 transition-all duration-300 group-hover:border-muted/30"></div>
                            ))}
                          </div>
                          
                          {/* Line chart */}
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="hsl(var(--primary))" />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                              </linearGradient>
                              <filter id="glow">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge> 
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                              </filter>
                            </defs>
                            
                            {/* Glowing line */}
                            <path
                              d={tickets.filter(t => t.event_id === selectedEventId).slice(0, 5).map((ticket, index) => {
                                const ticketsSold = ticket.quantity - ticket.available_quantity;
                                const percentage = (ticketsSold / ticket.quantity) * 100;
                                const x = (index / 4) * 100;
                                const y = 100 - percentage;
                                return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                              }).join(' ')}
                              stroke="hsl(var(--primary))"
                              strokeWidth="3"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              filter="url(#glow)"
                              opacity="0.8"
                              className="transition-all duration-300 group-hover:stroke-width-4"
                            />
                            
                            {/* Area fill */}
                            <path
                              d={tickets.filter(t => t.event_id === selectedEventId).slice(0, 5).map((ticket, index) => {
                                const ticketsSold = ticket.quantity - ticket.available_quantity;
                                const percentage = (ticketsSold / ticket.quantity) * 100;
                                const x = (index / 4) * 100;
                                const y = 100 - percentage;
                                return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                              }).join(' ') + ' L 100 100 L 0 100 Z'}
                              fill="url(#lineGradient)"
                              opacity="0.4"
                              className="transition-all duration-300 group-hover:opacity-60"
                            />
                            
                            {/* Data points with glow */}
                            {tickets.filter(t => t.event_id === selectedEventId).slice(0, 5).map((ticket, index) => {
                              const ticketsSold = ticket.quantity - ticket.available_quantity;
                              const percentage = (ticketsSold / ticket.quantity) * 100;
                              const x = (index / 4) * 100;
                              const y = 100 - percentage;
                              return (
                                <g key={index}>
                                  {/* Glow effect */}
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="6"
                                    fill="hsl(var(--primary))"
                                    opacity="0.3"
                                    className="animate-pulse"
                                  />
                                  {/* Main point */}
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="4"
                                    fill="hsl(var(--primary))"
                                    stroke="white"
                                    strokeWidth="1"
                                    className="transition-all duration-300 group-hover:r-5"
                                  />
                                </g>
                              );
                            })}
                          </svg>
                          
                          {/* X-axis labels with better spacing */}
                          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-2">
                            {tickets.filter(t => t.event_id === selectedEventId).slice(0, 5).map((ticket, index) => {
                              return (
                                <span key={index} className="truncate max-w-[50px] text-center font-medium transition-all duration-300 group-hover:text-primary">
                                  {ticket.ticket_type}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Top Ambassadors Performance */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-right-4 duration-500 delay-600 hover:shadow-xl transition-all duration-300 group">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Users className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform duration-300" />
                      Top Performing Ambassadors
                    </h3>
                    <div className="space-y-3">
                      {ticketStats.topAmbassadors.map((ambassador, index) => (
                        <div key={ambassador.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg animate-in slide-in-from-right-4 duration-500 delay-700 hover:bg-muted/30 transition-all duration-300 transform hover:scale-105">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-primary/20">
                              <span className="text-sm font-semibold text-primary">{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium">{ambassador.full_name}</p>
                              <p className="text-xs text-muted-foreground">{ambassador.city}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary transition-all duration-300 hover:scale-110">{ambassador.ticketsSold}</p>
                            <p className="text-xs text-muted-foreground">Tickets Sold</p>
                          </div>
                        </div>
                      ))}
                      {ticketStats.topAmbassadors.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No ambassador data for this event</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ticket Type Distribution & Event Performance */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-600">
                  {/* Ticket Type Distribution */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-left-4 duration-500 delay-700">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <PieChart className="w-5 h-5 mr-2 text-primary" />
                      Ticket Type Distribution
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-primary rounded-full"></div>
                          <span>Standard Tickets</span>
                        </div>
                        <span className="font-semibold">65%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                          <span>VIP Tickets</span>
                        </div>
                        <span className="font-semibold">25%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                          <span>Premium Tickets</span>
                        </div>
                        <span className="font-semibold">10%</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Selling Events */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-right-4 duration-500 delay-800">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-primary" />
                      Top Selling Events
                    </h3>
                    <div className="space-y-3">
                      {tickets.slice(0, 5).map((ticket, index) => {
                        const event = events.find(e => e.id === ticket.event_id);
                        const ticketsSold = ticket.quantity - ticket.available_quantity;
                        return (
                          <div key={ticket.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg animate-in slide-in-from-right-4 duration-500 delay-900">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary">{index + 1}</span>
                              </div>
                              <div>
                                <p className="font-medium">{event?.name || ticket.event_name}</p>
                                <p className="text-xs text-muted-foreground">{event?.date} • {event?.venue}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-primary">{ticketsSold}</p>
                              <p className="text-xs text-muted-foreground">Tickets Sold</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Enhanced Quick Actions & Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-800">
                  {/* Enhanced Quick Actions */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-left-4 duration-500 delay-900 hover:shadow-xl transition-all duration-300 group">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Settings className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform duration-300" />
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 hover:shadow-md transition-all duration-300 group">
                        <Download className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span className="text-xs">Export Report</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 hover:shadow-md transition-all duration-300 group">
                        <Mail className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span className="text-xs">Send Notifications</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 hover:shadow-md transition-all duration-300 group">
                        <BarChart3 className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span className="text-xs">View Analytics</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 hover:shadow-md transition-all duration-300 group">
                        <RefreshCw className="w-5 h-5 transition-transform duration-300 group-hover:rotate-180" />
                        <span className="text-xs">Refresh Data</span>
                      </Button>
                    </div>
                  </div>

                  {/* Enhanced Recent Ticket Sales */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-right-4 duration-500 delay-1000 hover:shadow-xl transition-all duration-300 group">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform duration-300" />
                      Recent Ticket Sales
                    </h3>
                    <div className="space-y-3">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg animate-in slide-in-from-right-4 duration-500 delay-1100 hover:bg-muted/30 transition-all duration-300 transform hover:scale-105">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-green-500/20">
                              <CheckCircle className="w-4 h-4 text-green-500 transition-transform duration-300 hover:scale-110" />
                            </div>
                            <div>
                              <p className="font-medium">VIP Ticket Sold</p>
                              <p className="text-xs text-muted-foreground">Event Name • 2 hours ago</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-500 transition-all duration-300 hover:scale-110">$150</p>
                            <p className="text-xs text-muted-foreground">Revenue</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>


              </TabsContent>

              {/* Marketing Tab */}
              <TabsContent value="marketing" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full px-2">
                  {/* SMS Balance Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <CreditCard className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'SMS Balance' : 'Solde SMS'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground mb-2">{language === 'en' ? 'Current Balance' : 'Solde Actuel'}</p>
                            {loadingBalance ? (
                              <div className="flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">{language === 'en' ? 'Loading...' : 'Chargement...'}</p>
                              </div>
                            ) : smsBalance?.balance ? (
                              typeof smsBalance.balance === 'object' ? (
                                <div className="mt-1">
                                  <p className="text-2xl font-bold text-primary">
                                    {smsBalance.balance.balance || smsBalance.balance.solde || smsBalance.balance.credit || 'N/A'}
                                  </p>
                                  {smsBalance.balance.balance === 0 || smsBalance.balance.solde === 0 || smsBalance.balance.credit === 0 ? (
                                    <p className="text-xs text-red-500 mt-1">
                                      ⚠️ {language === 'en' ? 'Insufficient balance!' : 'Solde insuffisant!'}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <div>
                                  <p className="text-2xl font-bold text-primary">
                                    {smsBalance.balance}
                                    {smsBalance.balance === '0' || smsBalance.balance === 0 ? (
                                      <span className="text-xs text-red-500 ml-2">
                                        ⚠️ {language === 'en' ? 'Insufficient!' : 'Insuffisant!'}
                                      </span>
                                    ) : null}
                                  </p>
                                </div>
                              )
                            ) : (
                              <p className="text-lg font-medium text-muted-foreground">
                                {language === 'en' ? 'Click button to check balance' : 'Cliquez sur le bouton pour vérifier le solde'}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={fetchSmsBalance}
                          disabled={loadingBalance}
                          variant="default"
                          size="lg"
                          className="w-full btn-gradient hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                        >
                          {loadingBalance ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                              {language === 'en' ? 'Loading...' : 'Chargement...'}
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-5 h-5 mr-2" />
                              {language === 'en' ? 'Refresh Balance' : 'Actualiser le Solde'}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Phone Subscribers Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 lg:col-span-2">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Phone className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Phone Subscribers' : 'Abonnés Téléphone'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? `Total: ${phoneSubscribers.length} subscribers`
                            : `Total: ${phoneSubscribers.length} abonnés`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {loadingSubscribers ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Bulk Add Section */}
                            <div className="space-y-2">
                              <Label>{language === 'en' ? 'Add Bulk Phone Numbers' : 'Ajouter des Numéros en Masse'}</Label>
                              <Textarea
                                value={bulkPhonesInput}
                                onChange={(e) => setBulkPhonesInput(e.target.value)}
                                placeholder={language === 'en' 
                                  ? 'Enter phone numbers (one per line or comma separated)\nExample: 21234567, 51234567\nOr:\n21234567\n51234567'
                                  : 'Entrez les numéros de téléphone (un par ligne ou séparés par des virgules)\nExemple: 21234567, 51234567\nOu:\n21234567\n51234567'}
                                className="min-h-[120px] text-sm bg-background text-foreground"
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={handleAddBulkPhones}
                                  disabled={addingBulkPhones || !bulkPhonesInput.trim()}
                                  className="flex-1"
                                >
                                  {addingBulkPhones ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                      {language === 'en' ? 'Adding...' : 'Ajout...'}
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4 mr-2" />
                                      {language === 'en' ? 'Add Numbers' : 'Ajouter les Numéros'}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={fetchPhoneSubscribers}
                                  variant="outline"
                                  size="sm"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Subscribers List */}
                            {phoneSubscribers.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <p>{language === 'en' ? 'No subscribers yet' : 'Aucun abonné pour le moment'}</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">
                                    {language === 'en' ? 'Subscribers' : 'Abonnés'} ({phoneSubscribers.length})
                                  </Label>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        if (selectedPhones.size === phoneSubscribers.length) {
                                          setSelectedPhones(new Set());
                                        } else {
                                          setSelectedPhones(new Set(phoneSubscribers.map(sub => sub.phone_number)));
                                        }
                                      }}
                                    >
                                      {selectedPhones.size === phoneSubscribers.length 
                                        ? (language === 'en' ? 'Deselect All' : 'Tout Désélectionner')
                                        : (language === 'en' ? 'Select All' : 'Tout Sélectionner')}
                                    </Button>
                                  </div>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                                  {phoneSubscribers.map((subscriber) => (
                                    <div
                                      key={subscriber.id}
                                      className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                                        selectedPhones.has(subscriber.phone_number)
                                          ? 'bg-primary/10 border-primary'
                                          : 'bg-card border-border hover:border-primary/50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={selectedPhones.has(subscriber.phone_number)}
                                          onChange={(e) => {
                                            const newSelected = new Set(selectedPhones);
                                            if (e.target.checked) {
                                              newSelected.add(subscriber.phone_number);
                                            } else {
                                              newSelected.delete(subscriber.phone_number);
                                            }
                                            setSelectedPhones(newSelected);
                                          }}
                                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                        />
                                        <div>
                                          <p className="font-medium">+216 {subscriber.phone_number}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {new Date(subscriber.subscribed_at).toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* SMS Broadcast Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Send className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'SMS Broadcast' : 'Diffusion SMS'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? `Send message to ${selectedPhones.size > 0 ? selectedPhones.size : phoneSubscribers.length} ${selectedPhones.size > 0 ? 'selected' : 'all'} subscriber(s)`
                            : `Envoyer un message à ${selectedPhones.size > 0 ? selectedPhones.size : phoneSubscribers.length} abonné(s) ${selectedPhones.size > 0 ? 'sélectionné(s)' : 'au total'}`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        <div className="space-y-2">
                          <Label>{language === 'en' ? 'Message' : 'Message'} *</Label>
                          <Textarea
                            value={smsMessage}
                            onChange={(e) => setSmsMessage(e.target.value)}
                            placeholder={language === 'en' 
                              ? 'Enter your SMS message here...\n\nExample:\nIcy spicy with andiamo events\nle 21 décembre au Queen kantaoui\ncheck your email (or Spam) and your Qr code bch tnjmou todkhlou bih ll event\nNestnwkom.'
                              : 'Entrez votre message SMS ici...\n\nExemple:\nIcy spicy with andiamo events\nle 21 décembre au Queen kantaoui\ncheck your email (or Spam) and your Qr code bch tnjmou todkhlou bih ll event\nNestnwkom.'}
                            className="min-h-[200px] text-sm bg-background text-foreground"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{language === 'en' ? 'Characters' : 'Caractères'}: {smsMessage.length}</span>
                            <span>{language === 'en' ? 'Approx. messages' : 'Messages approx.'}: {Math.ceil(smsMessage.length / 160)}</span>
                          </div>
                        </div>
                        <Button
                          onClick={handleSendSmsBroadcast}
                          disabled={sendingSms || !smsMessage.trim() || phoneSubscribers.length === 0}
                          className="w-full btn-gradient"
                          size="lg"
                        >
                          {sendingSms ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                              {language === 'en' ? 'Sending SMS...' : 'Envoi SMS...'}
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5 mr-2" />
                              {language === 'en' 
                                ? `Send SMS to ${selectedPhones.size > 0 ? selectedPhones.size : phoneSubscribers.length} Subscriber(s)`
                                : `Envoyer SMS à ${selectedPhones.size > 0 ? selectedPhones.size : phoneSubscribers.length} Abonné(s)`}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* SMS Logs Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <FileText className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'SMS Logs' : 'Journal SMS'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? 'Recent SMS sending history and errors'
                            : 'Historique récent d\'envoi SMS et erreurs'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {loadingLogs ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-end">
                              <Button
                                onClick={fetchSmsLogs}
                                variant="outline"
                                size="sm"
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                {language === 'en' ? 'Refresh' : 'Actualiser'}
                              </Button>
                            </div>
                            {smsLogs.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <p>{language === 'en' ? 'No SMS logs yet' : 'Aucun journal SMS pour le moment'}</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {smsLogs.map((log) => (
                                  <div
                                    key={log.id}
                                    className={`p-4 rounded-lg border transition-all duration-300 ${
                                      log.status === 'sent'
                                        ? 'bg-green-500/10 border-green-500/30'
                                        : log.status === 'failed'
                                        ? 'bg-red-500/10 border-red-500/30'
                                        : 'bg-yellow-500/10 border-yellow-500/30'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge
                                            variant={
                                              log.status === 'sent'
                                                ? 'default'
                                                : log.status === 'failed'
                                                ? 'destructive'
                                                : 'secondary'
                                            }
                                          >
                                            {log.status === 'sent'
                                              ? (language === 'en' ? 'Sent' : 'Envoyé')
                                              : log.status === 'failed'
                                              ? (language === 'en' ? 'Failed' : 'Échoué')
                                              : (language === 'en' ? 'Pending' : 'En Attente')}
                                          </Badge>
                                          <span className="text-sm font-medium">+216 {log.phone_number}</span>
                                        </div>
                                        <p className="text-sm text-foreground/80 mb-2 line-clamp-2">
                                          {log.message}
                                        </p>
                                        {log.error_message && (
                                          <div className="mt-2 p-2 bg-red-500/20 rounded text-xs text-red-400">
                                            <strong>{language === 'en' ? 'Error' : 'Erreur'}:</strong> {log.error_message}
                                          </div>
                                        )}
                                        {log.api_response && (
                                          <details className="mt-2">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                              {language === 'en' ? 'View API Response' : 'Voir Réponse API'}
                                            </summary>
                                            <pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-auto max-h-32">
                                              {typeof log.api_response === 'string' 
                                                ? log.api_response 
                                                : JSON.stringify(log.api_response, null, 2)}
                                            </pre>
                                          </details>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-2">
                                          {log.sent_at
                                            ? new Date(log.sent_at).toLocaleString()
                                            : new Date(log.created_at).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Logs Tab */}
              <TabsContent value="logs" className="space-y-6">
                <div className="w-full px-2 space-y-6">
                  {/* Analytics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Logs */}
                    <Card className="shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'en' ? 'Total Logs' : 'Total Journaux'}</p>
                            <p className="text-2xl font-bold">
                              {loadingStatistics ? '...' : (logStatistics?.total_logs || 0)}
                            </p>
                          </div>
                          <Activity className="w-8 h-8 text-primary" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Error Rate */}
                    <Card className="shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'en' ? 'Error Rate' : 'Taux d\'Erreur'}</p>
                            <p className="text-2xl font-bold">
                              {loadingStatistics ? '...' : (logStatistics?.error_rate || 0)}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {loadingStatistics ? '' : (logStatistics?.error_count || 0)} {language === 'en' ? 'errors' : 'erreurs'}
                            </p>
                          </div>
                          <AlertTriangle className={`w-8 h-8 ${(logStatistics?.error_rate || 0) > 5 ? 'text-red-500' : 'text-yellow-500'}`} />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Login Attempts */}
                    <Card className="shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'en' ? 'Login Attempts' : 'Tentatives de Connexion'}</p>
                            <p className="text-2xl font-bold">
                              {loadingStatistics ? '...' : (logStatistics?.login_attempts?.total || 0)}
                            </p>
                            <p className="text-xs text-green-600">
                              {loadingStatistics ? '' : (logStatistics?.login_attempts?.successful || 0)} {language === 'en' ? 'success' : 'succès'}
                            </p>
                            <p className="text-xs text-red-600">
                              {loadingStatistics ? '' : (logStatistics?.login_attempts?.failed || 0)} {language === 'en' ? 'failed' : 'échecs'}
                            </p>
                          </div>
                          <Shield className="w-8 h-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Suspicious Activity */}
                    <Card className={`shadow-lg ${suspiciousActivity?.unusual_error_rate?.alert ? 'border-red-500' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'en' ? 'Security Status' : 'Statut de Sécurité'}</p>
                            <p className="text-lg font-bold">
                              {loadingSuspicious ? '...' : 
                               suspiciousActivity?.unusual_error_rate?.alert ? '⚠️ Alert' : '✓ Normal'}
                            </p>
                            {suspiciousActivity?.multiple_failed_logins?.length > 0 && (
                              <p className="text-xs text-red-600">
                                {suspiciousActivity.multiple_failed_logins.length} {language === 'en' ? 'suspicious logins' : 'connexions suspectes'}
                              </p>
                            )}
                          </div>
                          <Shield className={`w-8 h-8 ${suspiciousActivity?.unusual_error_rate?.alert ? 'text-red-500' : 'text-green-500'}`} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Analytics Details */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Most Visited Pages */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <TrendingUp className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Most Visited Pages' : 'Pages les Plus Visitées'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {loadingStatistics ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : logStatistics?.most_visited_pages?.length > 0 ? (
                          <div className="space-y-2">
                            {logStatistics.most_visited_pages.map((page: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                                <span className="text-sm truncate">{page.page || 'Unknown'}</span>
                                <Badge variant="outline">{page.count}</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">{language === 'en' ? 'No page views yet' : 'Aucune page visitée'}</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Most Submitted Forms */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <FileText className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Most Submitted Forms' : 'Formulaires les Plus Soumis'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {loadingStatistics ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : logStatistics?.most_submitted_forms?.length > 0 ? (
                          <div className="space-y-2">
                            {logStatistics.most_submitted_forms.map((form: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                                <span className="text-sm truncate">{form.form || 'Unknown'}</span>
                                <Badge variant="outline">{form.count}</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">{language === 'en' ? 'No form submissions yet' : 'Aucune soumission de formulaire'}</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Top Errors */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          {language === 'en' ? 'Top Errors' : 'Erreurs Principales'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {loadingStatistics ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : logStatistics?.top_errors?.length > 0 ? (
                          <div className="space-y-2">
                            {logStatistics.top_errors.map((error: any, index: number) => (
                              <div key={index} className="p-2 hover:bg-muted/50 rounded">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-red-600">{language === 'en' ? 'Error' : 'Erreur'} {index + 1}</span>
                                  <Badge variant="destructive">{error.count}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate" title={error.message}>
                                  {error.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">{language === 'en' ? 'No errors yet' : 'Aucune erreur'}</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Security Alerts */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Shield className="w-5 h-5 text-yellow-500" />
                          {language === 'en' ? 'Security Alerts' : 'Alertes de Sécurité'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {loadingSuspicious ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : suspiciousActivity?.multiple_failed_logins?.length > 0 ? (
                          <div className="space-y-2">
                            {suspiciousActivity.multiple_failed_logins.map((login: any, index: number) => (
                              <div key={index} className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                                <p className="text-sm font-semibold text-yellow-600">
                                  {language === 'en' ? 'Multiple failed logins:' : 'Plusieurs échecs de connexion:'} {login.email}
                                </p>
                                <p className="text-xs text-muted-foreground">{login.attempts} {language === 'en' ? 'attempts' : 'tentatives'}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-green-600 text-center py-4">{language === 'en' ? '✓ No suspicious activity detected' : '✓ Aucune activité suspecte détectée'}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Cleanup Section */}
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Database className="w-5 h-5 text-primary" />
                        {language === 'en' ? 'Log Cleanup' : 'Nettoyage des Journaux'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-2">
                        {language === 'en' 
                          ? 'Automatically delete logs older than specified days to manage database size'
                          : 'Supprimer automatiquement les journaux plus anciens que le nombre de jours spécifié pour gérer la taille de la base de données'}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Label>{language === 'en' ? 'Keep logs for:' : 'Conserver les journaux pendant:'}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={cleanupDays}
                          onChange={(e) => setCleanupDays(parseInt(e.target.value) || 30)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          {language === 'en' ? 'days' : 'jours'}
                        </span>
                        <Button
                          onClick={cleanupOldLogs}
                          disabled={cleaningLogs}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          {cleaningLogs ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              {language === 'en' ? 'Cleaning...' : 'Nettoyage...'}
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              {language === 'en' ? 'Cleanup Now' : 'Nettoyer Maintenant'}
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Logs Table Card */}
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                        <Activity className="w-5 h-5 text-primary" />
                        {t.logsTitle}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-2">{t.logsDescription}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Filters */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            {t.filterByType}
                          </Label>
                          <Select value={logFilter} onValueChange={(value: any) => {
                            setLogFilter(value);
                            setTimeout(() => fetchSiteLogs(), 100);
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t.allLogs}</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                              <SelectItem value="warning">Warning</SelectItem>
                              <SelectItem value="error">Error</SelectItem>
                              <SelectItem value="success">Success</SelectItem>
                              <SelectItem value="action">Action</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t.filterByCategory}</Label>
                          <Select value={logCategoryFilter} onValueChange={(value) => {
                            setLogCategoryFilter(value);
                            setTimeout(() => fetchSiteLogs(), 100);
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              <SelectItem value="user_action">User Action</SelectItem>
                              <SelectItem value="api_call">API Call</SelectItem>
                              <SelectItem value="database">Database</SelectItem>
                              <SelectItem value="page_view">Page View</SelectItem>
                              <SelectItem value="form_submission">Form Submission</SelectItem>
                              <SelectItem value="authentication">Authentication</SelectItem>
                              <SelectItem value="error">Error</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            Search
                          </Label>
                          <Input
                            placeholder={t.searchLogs}
                            value={logSearchTerm}
                            onChange={(e) => {
                              setLogSearchTerm(e.target.value);
                              setTimeout(() => fetchSiteLogs(), 500);
                            }}
                            className="w-full"
                          />
                        </div>
                      </div>

                      {/* Logs Table */}
                      {loadingSiteLogs ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : siteLogs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          {t.noLogs}
                        </div>
                      ) : (
                        <div className="border border-border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                  <th className="px-4 py-3 text-left font-semibold">{t.logTime}</th>
                                  <th className="px-4 py-3 text-left font-semibold">{t.logType}</th>
                                  <th className="px-4 py-3 text-left font-semibold">{t.logCategory}</th>
                                  <th className="px-4 py-3 text-left font-semibold">{t.logMessage}</th>
                                  <th className="px-4 py-3 text-left font-semibold">{t.logUser}</th>
                                  <th className="px-4 py-3 text-left font-semibold">{t.logPage}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {siteLogs.map((log) => {
                                  const logTypeColors = {
                                    info: 'bg-blue-500 text-white hover:bg-blue-600',
                                    warning: 'bg-yellow-500 text-white hover:bg-yellow-600',
                                    error: 'bg-red-500 text-white hover:bg-red-600',
                                    success: 'bg-green-500 text-white hover:bg-green-600',
                                    action: 'bg-purple-500 text-white hover:bg-purple-600'
                                  };
                                  const date = new Date(log.created_at);
                                  const formattedDate = date.toLocaleString();
                                  return (
                                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                                      <td className="px-4 py-3 text-muted-foreground text-xs">{formattedDate}</td>
                                      <td className="px-4 py-3">
                                        <Badge className={`${logTypeColors[log.log_type as keyof typeof logTypeColors] || 'bg-gray-500 text-white'} font-semibold px-2 py-1`}>
                                          {log.log_type}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3 text-muted-foreground">{log.category}</td>
                                      <td className="px-4 py-3 max-w-md truncate" title={log.message}>
                                        {log.message}
                                      </td>
                                      <td className="px-4 py-3 text-muted-foreground">
                                        {log.user_type || 'guest'}
                                      </td>
                                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate" title={log.page_url}>
                                        {log.page_url ? new URL(log.page_url).pathname : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Refresh Buttons */}
                      <div className="flex justify-between items-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            fetchSiteLogs();
                            fetchLogStatistics();
                            fetchSuspiciousActivity();
                          }}
                          disabled={loadingSiteLogs || loadingStatistics || loadingSuspicious}
                          className="flex items-center gap-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${(loadingSiteLogs || loadingStatistics || loadingSuspicious) ? 'animate-spin' : ''}`} />
                          {language === 'en' ? 'Refresh All' : 'Actualiser Tout'}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {language === 'en' ? `Showing ${siteLogs.length} logs` : `Affichage de ${siteLogs.length} journaux`}
                        </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* OG Image Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {t.ogImageSettings}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">{t.ogImageSettingsDescription}</p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {loadingOGImageSettings ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">{t.uploadOGImage}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadOGImage(file);
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                label={uploadingOGImage ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : t.uploadOGImage}
                                maxSize={5 * 1024 * 1024}
                              />
                              {ogImageSettings.og_image && (
                                <div className="mt-4 space-y-2">
                                  <Label className="text-sm font-semibold">{t.currentOGImage}</Label>
                                  <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg">
                                    <img 
                                      src={ogImageSettings.og_image} 
                                      alt="OG Image Preview" 
                                      className="w-32 h-20 object-cover rounded-lg flex-shrink-0 border border-border/50" 
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-muted-foreground mb-2 break-all">{ogImageSettings.og_image}</p>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDeleteOGImage}
                                        className="flex-shrink-0"
                                      >
                                        <Trash2 className="w-3 h-3 mr-2" />
                                        {t.deleteOGImage}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {!ogImageSettings.og_image && (
                                <p className="text-sm text-muted-foreground mt-2">{t.noOGImage}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-2">
                  {/* Sales Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <Card className="shadow-lg h-full flex flex-col">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                        <Settings className="w-5 h-5 text-primary" />
                        {t.salesSettings}
                      </CardTitle>
                      <p className="text-sm text-foreground/70 mt-2">{t.salesSettingsDescription}</p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                            salesEnabled 
                              ? 'bg-green-500 shadow-md shadow-green-500/50' 
                              : 'bg-gray-500'
                          }`}>
                            {salesEnabled ? (
                              <CheckCircle className="w-5 h-5 text-white" />
                            ) : (
                              <XCircle className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">
                              {salesEnabled ? t.salesEnabled : t.salesDisabled}
                            </p>
                            <p className="text-xs text-foreground/60 line-clamp-2">
                              {salesEnabled 
                                ? (language === 'en' ? 'Ambassadors can add sales' : 'Les ambassadeurs peuvent ajouter des ventes')
                                : (language === 'en' ? 'Sales are disabled' : 'Les ventes sont désactivées')
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => updateSalesSettings(!salesEnabled)}
                          disabled={loadingSalesSettings}
                          variant={salesEnabled ? "destructive" : "default"}
                          size="sm"
                          className="ml-2 flex-shrink-0 transition-all duration-300"
                        >
                          {loadingSalesSettings ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : salesEnabled ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
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
                        {t.maintenanceSettings}
                      </CardTitle>
                      <p className="text-sm text-foreground/70 mt-2">{t.maintenanceSettingsDescription}</p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                            maintenanceEnabled 
                              ? 'bg-orange-500 shadow-md shadow-orange-500/50' 
                              : 'bg-gray-500'
                          }`}>
                            {maintenanceEnabled ? (
                              <Wrench className="w-5 h-5 text-white" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">
                              {maintenanceEnabled ? t.maintenanceEnabled : t.maintenanceDisabled}
                            </p>
                            <p className="text-xs text-foreground/60 line-clamp-2">
                              {maintenanceEnabled 
                                ? (language === 'en' ? 'Website in maintenance' : 'Site en maintenance')
                                : (language === 'en' ? 'Website accessible' : 'Site accessible')
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => updateMaintenanceSettings(!maintenanceEnabled, maintenanceMessage)}
                          disabled={loadingMaintenanceSettings}
                          variant={maintenanceEnabled ? "default" : "destructive"}
                          size="sm"
                          className="ml-2 flex-shrink-0 transition-all duration-300"
                        >
                          {loadingMaintenanceSettings ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : maintenanceEnabled ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Wrench className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Maintenance Message Input */}
                      <div className="space-y-2">
                        <Label htmlFor="maintenance-message" className="text-sm text-foreground">{t.maintenanceMessage}</Label>
                        <Textarea
                          id="maintenance-message"
                          placeholder={t.maintenanceMessagePlaceholder}
                          value={maintenanceMessage}
                          onChange={(e) => setMaintenanceMessage(e.target.value)}
                          onBlur={() => {
                            updateMaintenanceSettings(maintenanceEnabled, maintenanceMessage);
                          }}
                          className="min-h-[80px] text-sm bg-background text-foreground"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  </div>

                  {/* Ambassador Application Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <Card className="shadow-lg h-full flex flex-col">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                        <Settings className="w-5 h-5 text-primary" />
                        {t.ambassadorApplicationSettings}
                      </CardTitle>
                      <p className="text-sm text-foreground/70 mt-2">{t.ambassadorApplicationSettingsDescription}</p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                            ambassadorApplicationEnabled 
                              ? 'bg-blue-500 shadow-md shadow-blue-500/50' 
                              : 'bg-gray-500'
                          }`}>
                            {ambassadorApplicationEnabled ? (
                              <CheckCircle className="w-5 h-5 text-white" />
                            ) : (
                              <XCircle className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">
                              {ambassadorApplicationEnabled ? t.ambassadorApplicationEnabled : t.ambassadorApplicationDisabled}
                            </p>
                            <p className="text-xs text-foreground/60 line-clamp-2">
                              {ambassadorApplicationEnabled 
                                ? (language === 'en' ? 'Applications are open' : 'Les candidatures sont ouvertes')
                                : (language === 'en' ? 'Applications are closed' : 'Les candidatures sont fermées')
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            updateAmbassadorApplicationSettings(!ambassadorApplicationEnabled, ambassadorApplicationMessage);
                          }}
                          disabled={loadingAmbassadorApplicationSettings}
                          variant={ambassadorApplicationEnabled ? "destructive" : "default"}
                          size="sm"
                          className="ml-2 flex-shrink-0 transition-all duration-300"
                        >
                          {loadingAmbassadorApplicationSettings ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : ambassadorApplicationEnabled ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Ambassador Application Closed Message Input */}
                      <div className="space-y-2">
                        <Label htmlFor="ambassador-application-message" className="text-sm text-foreground">{t.ambassadorApplicationMessage}</Label>
                        <Textarea
                          id="ambassador-application-message"
                          placeholder={t.ambassadorApplicationMessagePlaceholder}
                          value={ambassadorApplicationMessage}
                          onChange={(e) => setAmbassadorApplicationMessage(e.target.value)}
                          onBlur={() => {
                            updateAmbassadorApplicationSettings(ambassadorApplicationEnabled, ambassadorApplicationMessage);
                          }}
                          className="min-h-[80px] text-sm bg-background text-foreground"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  </div>

                  {/* Favicon Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {t.faviconSettings}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">{t.faviconSettingsDescription}</p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {loadingFaviconSettings ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Favicon ICO */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">{t.faviconIco}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadFavicon(file, 'favicon_ico');
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept=".ico,image/x-icon"
                                label={uploadingFavicon === 'favicon_ico' ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : t.uploadFavicon}
                              />
                              {faviconSettings.favicon_ico && (
                                <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-lg">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <img src={faviconSettings.favicon_ico} alt="Favicon" className="w-8 h-8 flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground truncate">{t.currentFavicon}</span>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteFavicon('favicon_ico')}
                                    className="flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Favicon 32x32 */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">{t.favicon32x32}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadFavicon(file, 'favicon_32x32');
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/png,image/x-icon"
                                label={uploadingFavicon === 'favicon_32x32' ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : t.uploadFavicon}
                              />
                              {faviconSettings.favicon_32x32 && (
                                <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-lg">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <img src={faviconSettings.favicon_32x32} alt="Favicon 32x32" className="w-8 h-8 flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground truncate">{t.currentFavicon}</span>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteFavicon('favicon_32x32')}
                                    className="flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Favicon 16x16 */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">{t.favicon16x16}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadFavicon(file, 'favicon_16x16');
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/png,image/x-icon"
                                label={uploadingFavicon === 'favicon_16x16' ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : t.uploadFavicon}
                              />
                              {faviconSettings.favicon_16x16 && (
                                <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-lg">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <img src={faviconSettings.favicon_16x16} alt="Favicon 16x16" className="w-8 h-8 flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground truncate">{t.currentFavicon}</span>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteFavicon('favicon_16x16')}
                                    className="flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Apple Touch Icon */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">{t.appleTouchIcon}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadFavicon(file, 'apple_touch_icon');
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/png"
                                label={uploadingFavicon === 'apple_touch_icon' ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : t.uploadFavicon}
                              />
                              {faviconSettings.apple_touch_icon && (
                                <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-lg">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <img src={faviconSettings.apple_touch_icon} alt="Apple Touch Icon" className="w-8 h-8 rounded-lg flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground truncate">{t.currentFavicon}</span>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteFavicon('apple_touch_icon')}
                                    className="flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Hero Images Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {t.heroImagesSettings}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">{t.heroImagesSettingsDescription}</p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {loadingHeroImages ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <>
                            {/* Upload Hero Image */}
                            <div className="space-y-2">
                              <Label>{t.uploadHeroImage}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadHeroImage(file);
                                  }
                                }}
                                accept="image/*"
                                maxSize={10}
                                label={uploadingHeroImage ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : t.uploadHeroImage}
                              />
                              {uploadingHeroImage && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  {language === 'en' ? 'Uploading image...' : 'Téléchargement de l\'image...'}
                                </div>
                              )}
                            </div>

                            {/* Hero Images List */}
                            {heroImages.length === 0 ? (
                              <div className="flex items-center justify-center py-8 text-center text-muted-foreground">
                                <p>{t.noHeroImages}</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Label className="text-sm">{t.reorderImages}</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {heroImages.map((image, index) => (
                                    <Card key={index} className="relative group overflow-hidden">
                                      <div className="relative aspect-video w-full">
                                        <img
                                          src={image.src}
                                          alt={image.alt}
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
                                                    const newOrder = [...heroImages];
                                                    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                                    handleReorderHeroImages(newOrder);
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
                                                  if (index < heroImages.length - 1) {
                                                    const newOrder = [...heroImages];
                                                    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                                    handleReorderHeroImages(newOrder);
                                                  }
                                                }}
                                                disabled={index === heroImages.length - 1}
                                                className="shadow-lg"
                                              >
                                                <ArrowDown className="w-4 h-4" />
                                              </Button>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => handleDeleteHeroImage(index)}
                                              className="shadow-lg"
                                            >
                                              <Trash2 className="w-4 h-4 mr-1" />
                                              {t.deleteHeroImage}
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                      <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">
                                            {language === 'en' ? 'Image' : 'Image'} {index + 1}
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
            </Tabs>
          </div>
        </div>
      </div>
      {/* Custom Delete Confirmation Dialog for Ambassador */}
      <Dialog open={!!ambassadorToDelete} onOpenChange={open => { if (!open) setAmbassadorToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'en' ? 'Delete Ambassador' : 'Supprimer l\'ambassadeur'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{language === 'en'
              ? 'Are you sure you want to delete this ambassador? This action cannot be undone.'
              : 'Êtes-vous sûr de vouloir supprimer cet ambassadeur ? Cette action est irréversible.'}
            </p>
            {ambassadorToDelete && (
              <div className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold">{ambassadorToDelete.full_name}</span> ({ambassadorToDelete.email || ambassadorToDelete.phone})
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAmbassadorToDelete(null)}>{language === 'en' ? 'Cancel' : 'Annuler'}</Button>
            <Button variant="destructive" onClick={() => handleDeleteAmbassador(ambassadorToDelete.id)}>{language === 'en' ? 'Delete' : 'Supprimer'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Delete Confirmation Dialog for Event */}
      <Dialog open={!!eventToDelete} onOpenChange={open => { if (!open) setEventToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'en' ? 'Delete Event' : 'Supprimer l\'événement'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{language === 'en'
              ? 'Are you sure you want to delete this event? This action cannot be undone.'
              : 'Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.'}
            </p>
            {eventToDelete && (
              <div className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold">{eventToDelete.name}</span> ({eventToDelete.date} - {eventToDelete.venue})
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEventToDelete(null)}>{language === 'en' ? 'Cancel' : 'Annuler'}</Button>
            <Button variant="destructive" onClick={confirmDeleteEvent}>{language === 'en' ? 'Delete' : 'Supprimer'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard; 
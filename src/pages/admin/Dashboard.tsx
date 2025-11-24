import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import FileUpload from "@/components/ui/file-upload";
import { uploadImage, uploadHeroImage, deleteHeroImage } from "@/lib/upload";
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
  Send, Megaphone, PhoneCall, CreditCard, AlertCircle, CheckCircle2, Activity, Database,
  Search, Filter, MoreVertical, ExternalLink, Ticket, TrendingDown, Percent, Target
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
  // All hooks must be called before any conditional returns (Rules of Hooks)
  const isMobile = useIsMobile();
  const navigate = useNavigate();
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

  // About images state
  interface AboutImage {
    src: string;
    alt: string;
    path?: string;
  }
  const [aboutImages, setAboutImages] = useState<AboutImage[]>([]);
  const [loadingAboutImages, setLoadingAboutImages] = useState(false);
  const [uploadingAboutImage, setUploadingAboutImage] = useState(false);

  // Marketing/SMS state
  const [phoneSubscribers, setPhoneSubscribers] = useState<Array<{id: string; phone_number: string; subscribed_at: string}>>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  // Test SMS state
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testSmsMessage, setTestSmsMessage] = useState("");
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkPhonesInput, setBulkPhonesInput] = useState("");
  const [addingBulkPhones, setAddingBulkPhones] = useState(false);
  const [smsBalance, setSmsBalance] = useState<any>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [smsLogs, setSmsLogs] = useState<Array<{id: string; phone_number: string; message: string; status: string; error_message?: string; sent_at?: string; created_at: string}>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [siteLogs, setSiteLogs] = useState<Array<{id: string; log_type: string; category: string; message: string; details: any; user_type: string; created_at: string}>>([]);
  const [loadingSiteLogs, setLoadingSiteLogs] = useState(false);
  const [ogImageSettings, setOGImageSettings] = useState<{og_image?: string; updated_at?: string}>({});
  const [loadingOGImageSettings, setLoadingOGImageSettings] = useState(false);
  const [uploadingOGImage, setUploadingOGImage] = useState(false);

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
            // New state for redesigned ticket management
            const [ticketSearchQuery, setTicketSearchQuery] = useState('');
            const [ticketFilterStatus, setTicketFilterStatus] = useState<string>('all');
            const [selectedEventForInsights, setSelectedEventForInsights] = useState<any>(null);
            const [isEventInsightsOpen, setIsEventInsightsOpen] = useState(false);
            const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
            const [ticketIssues, setTicketIssues] = useState<any[]>([
              { id: '1', customerName: 'John Doe', issue: 'Ticket not received', priority: 'high', status: 'open' },
              { id: '2', customerName: 'Jane Smith', issue: 'Refund request', priority: 'medium', status: 'open' },
              { id: '3', customerName: 'Mike Johnson', issue: 'Duplicate charge', priority: 'high', status: 'resolved' }
            ]);

  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(2 * 60 * 60); // 2 hours in seconds


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
      reorderImages: "Reorder by dragging"
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
      reorderImages: "Réorganiser en faisant glisser"
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

  // Fetch about images
  const fetchAboutImages = async () => {
    try {
      setLoadingAboutImages(true);
      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'about_section')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching about images:', error);
        setAboutImages([]);
        return;
      }

      if (data && data.content) {
        const content = data.content as any;
        if (content.images && Array.isArray(content.images)) {
          setAboutImages(content.images);
        } else {
          setAboutImages([]);
        }
      } else {
        setAboutImages([]);
      }
    } catch (error) {
      console.error('Error fetching about images:', error);
      setAboutImages([]);
    } finally {
      setLoadingAboutImages(false);
    }
  };

  // Save about images to site_content
  const saveAboutImages = async (images: AboutImage[]) => {
    try {
      // Get existing about_section content
      const { data: existingData } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'about_section')
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

      // Upsert about_section with updated images
      const { error } = await supabase
        .from('site_content')
        .upsert({
          key: 'about_section',
          content: updatedContent,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      setAboutImages(images);
      toast({
        title: language === 'en' ? 'About Images Updated' : 'Images À Propos Mises à Jour',
        description: language === 'en' 
          ? 'About images have been updated successfully' 
          : 'Les images de la page À propos ont été mises à jour avec succès',
      });
    } catch (error) {
      console.error('Error saving about images:', error);
      toast({
        title: t.error,
        description: language === 'en' 
          ? 'Failed to save about images' 
          : 'Échec de la sauvegarde des images À propos',
        variant: 'destructive',
      });
    }
  };

  // Handle about image upload
  const handleUploadAboutImage = async (file: File) => {
    try {
      setUploadingAboutImage(true);
      
      // Upload to hero-images bucket (reusing the same bucket)
      const uploadResult = await uploadHeroImage(file);
      
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      // Create new about image object
      const newImage: AboutImage = {
        src: uploadResult.url,
        alt: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for alt text
        path: uploadResult.path
      };

      // Add to about images array
      const updatedImages = [...aboutImages, newImage];
      await saveAboutImages(updatedImages);
    } catch (error) {
      console.error('Error uploading about image:', error);
      toast({
        title: t.error,
        description: language === 'en' 
          ? 'Failed to upload about image' 
          : 'Échec du téléchargement de l\'image À propos',
        variant: 'destructive',
      });
    } finally {
      setUploadingAboutImage(false);
    }
  };

  // Handle about image delete
  const handleDeleteAboutImage = async (index: number) => {
    try {
      const imageToDelete = aboutImages[index];
      
      // Delete from storage if path exists
      if (imageToDelete.path) {
        await deleteHeroImage(imageToDelete.path);
      }

      // Remove from array
      const updatedImages = aboutImages.filter((_, i) => i !== index);
      await saveAboutImages(updatedImages);
    } catch (error) {
      console.error('Error deleting about image:', error);
      toast({
        title: t.error,
        description: language === 'en' 
          ? 'Failed to delete about image' 
          : 'Échec de la suppression de l\'image À propos',
        variant: 'destructive',
      });
    }
  };

  // Handle reorder about images
  const handleReorderAboutImages = async (newOrder: AboutImage[]) => {
    await saveAboutImages(newOrder);
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

      if (error) throw error;
      setSmsLogs(data || []);
    } catch (error) {
      console.error('Error fetching SMS logs:', error);
      setSmsLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Fetch Site logs
  const fetchSiteLogs = async () => {
    try {
      setLoadingSiteLogs(true);
      const { data, error } = await supabase
        .from('site_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setSiteLogs(data || []);
    } catch (error) {
      console.error('Error fetching site logs:', error);
      setSiteLogs([]);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Failed to fetch site logs' 
          : 'Échec de la récupération des logs du site',
        variant: 'destructive',
      });
    } finally {
      setLoadingSiteLogs(false);
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
          ? 'Preview image uploaded successfully. Social media platforms may show the old cached image. Use Facebook Sharing Debugger or Twitter Card Validator to clear cache.' 
          : 'Image d\'aperçu téléchargée avec succès. Les plateformes de médias sociaux peuvent afficher l\'ancienne image mise en cache. Utilisez Facebook Sharing Debugger ou Twitter Card Validator pour vider le cache.',
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
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'No image to delete' 
            : 'Aucune image à supprimer',
          variant: 'destructive',
        });
        return;
      }

      const result = await deleteOGImage(currentUrl);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete image');
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

  // Fetch SMS balance
  const fetchSmsBalance = async () => {
    try {
      setLoadingBalance(true);
      const response = await fetch('/api/sms-balance');
      
      // Check if response is OK (should always be 200 now, but check anyway)
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
      
      // Always set the balance data (even if null/error)
        setSmsBalance(data);
      
      // Show warning toast if there's an error but don't treat it as a failure
      if (data.error || !data.configured) {
        console.warn('SMS balance check warning:', data.error || data.message);
        if (data.error && data.configured) {
          // Only show toast if API is configured but returned an error
        toast({
            title: language === 'en' ? 'Warning' : 'Avertissement',
            description: data.error || data.message || (language === 'en' ? 'Unable to fetch SMS balance' : 'Impossible de récupérer le solde SMS'),
            variant: 'default',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching SMS balance:', error);
      // Set null balance on error
      setSmsBalance({
        success: true,
        balance: null,
        configured: false,
        error: error instanceof Error ? error.message : 'Network error'
      });
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error ? error.message : (language === 'en' ? 'Failed to fetch SMS balance' : 'Échec de la récupération du solde SMS'),
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

  // Send Test SMS
  const handleSendTestSms = async () => {
    if (!testPhoneNumber.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter a phone number' 
          : 'Veuillez entrer un numéro de téléphone',
        variant: 'destructive',
      });
      return;
    }

    if (!testSmsMessage.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter a message' 
          : 'Veuillez entrer un message',
        variant: 'destructive',
      });
      return;
    }

    // Validate phone number format (should be 8 digits)
    const phoneRegex = /^\d{8}$/;
    const cleanPhone = testPhoneNumber.trim().replace(/\s+/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter a valid 8-digit phone number (e.g., 21234567)' 
          : 'Veuillez entrer un numéro de téléphone valide à 8 chiffres (ex: 21234567)',
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
      setSendingTestSms(true);
      
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumbers: [cleanPhone], 
          message: testSmsMessage.trim() 
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
          title: language === 'en' ? 'Test SMS Sent' : 'SMS Test Envoyé',
          description: language === 'en' 
            ? `Test SMS sent successfully to +216 ${cleanPhone}`
            : `SMS test envoyé avec succès à +216 ${cleanPhone}`,
        });
        
        // Refresh logs and balance
        await fetchSmsLogs();
        await fetchSmsBalance();
        
        // Clear test fields
        setTestPhoneNumber('');
        setTestSmsMessage('');
      } else {
        throw new Error(data.error || 'Failed to send test SMS');
      }
    } catch (error) {
      console.error('Error sending test SMS:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error ? error.message : (language === 'en' ? 'Failed to send test SMS' : 'Échec de l\'envoi du SMS test'),
        variant: 'destructive',
      });
    } finally {
      setSendingTestSms(false);
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

    // Get all subscribers
    const phonesToSend = phoneSubscribers.map(sub => sub.phone_number);

    if (phonesToSend.length === 0) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'No subscribers available' 
          : 'Aucun abonné disponible',
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
        
        // Refresh logs and balance
        await fetchSmsLogs();
        await fetchSmsBalance();
        
        // Clear message
        setSmsMessage('');
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
      await fetchAboutImages();
      await fetchPhoneSubscribers();
      await fetchSmsLogs();
      // SMS Balance check removed - user must click button to check
      await loadOGImageSettings();

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

  // Show mobile message if accessed from mobile device (after all hooks are called)
  if (isMobile) {

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-primary/20 p-8 text-center space-y-6 animate-in fade-in-0 zoom-in-95 duration-500">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-gradient-to-br from-primary to-secondary p-4 rounded-2xl shadow-lg">
                  <Settings className="w-12 h-12 text-primary-foreground" />
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent mb-2">
                {language === 'en' ? 'Desktop Only' : 'Ordinateur Seulement'}
              </h1>
              <p className="text-muted-foreground text-lg">
                {language === 'en' 
                  ? 'Admin Dashboard'
                  : 'Tableau de Bord Administrateur'}
              </p>
            </div>

            {/* Message */}
            <div className="space-y-3">
              <p className="text-foreground/90 leading-relaxed">
                {language === 'en' 
                  ? 'The admin dashboard is only available on desktop computers and laptops. Please access it from a PC for the best experience and full functionality.'
                  : 'Le tableau de bord administrateur est uniquement disponible sur les ordinateurs de bureau et les ordinateurs portables. Veuillez y accéder depuis un PC pour une meilleure expérience et toutes les fonctionnalités.'}
              </p>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              <Button 
                onClick={() => navigate('/admin/login')}
                className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 h-12 text-base font-semibold"
              >
                {language === 'en' ? 'Back to Login' : 'Retour à la Connexion'}
              </Button>
            </div>

            {/* Decorative elements */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-secondary/5 rounded-full blur-2xl" />
          </div>
        </div>
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
                  if (siteLogs.length === 0) {
                    fetchSiteLogs();
                  }
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-875 ${
                  activeTab === "logs" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <Activity className={`w-4 h-4 transition-transform duration-300 ${activeTab === "logs" ? "animate-pulse" : ""}`} />
                <span>{language === 'en' ? 'Logs' : 'Journaux'}</span>
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
                <h1 className="text-4xl font-heading font-bold text-gradient-neon mb-2 animate-in slide-in-from-left-4 duration-1000">
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
                {/* Welcome Header */}
                <div className="animate-in slide-in-from-top-4 fade-in duration-700">
                  <Card className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background border-primary/20 shadow-xl">
                    <CardContent className="p-8">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <h2 className="text-3xl font-heading font-bold text-gradient-neon">
                            {language === 'en' ? 'Welcome Back!' : 'Bon Retour !'}
                          </h2>
                          <p className="text-muted-foreground text-lg font-heading">
                            {language === 'en' 
                              ? 'Here\'s what\'s happening with your events today'
                              : 'Voici ce qui se passe avec vos événements aujourd\'hui'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground font-heading">
                              {language === 'en' ? 'Active Events' : 'Événements Actifs'}
                            </p>
                            <p className="text-2xl font-bold text-primary font-heading">
                              {events.filter(e => e.event_type === 'upcoming' && new Date(e.date) >= new Date()).length}
                            </p>
                          </div>
                          <div className="h-12 w-px bg-border" />
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground font-heading">
                              {language === 'en' ? 'Total Revenue' : 'Revenus Totaux'}
                            </p>
                            <p className="text-2xl font-bold text-secondary font-heading">
                              {passPurchases.reduce((sum, p) => sum + (p.total_price || 0), 0).toLocaleString()} TND
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Enhanced KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full px-2">
                  {/* Pending Applications Card */}
                  <Card 
                    className={`group relative overflow-hidden bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-background border-yellow-500/20 transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                      animatedCards.has(0) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl" />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-yellow-500/20 rounded-xl">
                          <Clock className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-heading">
                          <TrendingUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">+12%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-heading">{t.pendingApplications}</p>
                        <p className="text-3xl font-bold font-heading text-foreground">
                            {pendingApplications.length}
                          </p>
                        <p className="text-xs text-muted-foreground font-heading">
                          {language === 'en' ? 'Awaiting review' : 'En attente de révision'}
                        </p>
                        </div>
                      {/* Mini Sparkline */}
                      <div className="mt-4 h-8 flex items-end gap-1">
                        {[3, 5, 4, 7, 6, 8, pendingApplications.length].map((h, i) => (
                          <div 
                            key={i}
                            className="flex-1 bg-yellow-500/30 rounded-t transition-all duration-300 hover:bg-yellow-500/50"
                            style={{ height: `${(h / 10) * 100}%` }}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Approved Applications Card */}
                  <Card 
                    className={`group relative overflow-hidden bg-gradient-to-br from-green-500/10 via-green-500/5 to-background border-green-500/20 transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                      animatedCards.has(1) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200' 
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl" />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-green-500/20 rounded-xl">
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-heading">
                          <TrendingUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">+8%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-heading">{t.approvedApplications}</p>
                        <p className="text-3xl font-bold font-heading text-foreground">
                            {approvedCount}
                          </p>
                        <p className="text-xs text-muted-foreground font-heading">
                          {language === 'en' ? 'Active ambassadors' : 'Ambassadeurs actifs'}
                        </p>
                        </div>
                      {/* Mini Sparkline */}
                      <div className="mt-4 h-8 flex items-end gap-1">
                        {[5, 7, 6, 8, 9, 10, approvedCount].map((h, i) => (
                          <div 
                            key={i}
                            className="flex-1 bg-green-500/30 rounded-t transition-all duration-300 hover:bg-green-500/50"
                            style={{ height: `${(h / 15) * 100}%` }}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Events Card */}
                  <Card 
                    className={`group relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background border-blue-500/20 transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                      animatedCards.has(2) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400' 
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                          <Calendar className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-heading">
                          <TrendingUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">+15%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-heading">{t.totalEvents}</p>
                        <p className="text-3xl font-bold font-heading text-foreground">
                            {events.length}
                          </p>
                        <p className="text-xs text-muted-foreground font-heading">
                          {language === 'en' ? 'All time events' : 'Événements de tous les temps'}
                        </p>
                        </div>
                      {/* Mini Sparkline */}
                      <div className="mt-4 h-8 flex items-end gap-1">
                        {[2, 3, 4, 5, 6, 7, events.length].map((h, i) => (
                          <div 
                            key={i}
                            className="flex-1 bg-blue-500/30 rounded-t transition-all duration-300 hover:bg-blue-500/50"
                            style={{ height: `${(h / 10) * 100}%` }}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Approved Ambassadors Card */}
                  <Card 
                    className={`group relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-background border-purple-500/20 transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                      animatedCards.has(3) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-600' 
                        : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl" />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                          <Users className="w-6 h-6 text-purple-500" />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-heading">
                          <TrendingUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">+22%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-heading">{t.approvedAmbassadors}</p>
                        <p className="text-3xl font-bold font-heading text-foreground">
                            {ambassadors.length}
                          </p>
                        <p className="text-xs text-muted-foreground font-heading">
                          {language === 'en' ? 'Team members' : 'Membres de l\'équipe'}
                        </p>
                        </div>
                      {/* Mini Sparkline */}
                      <div className="mt-4 h-8 flex items-end gap-1">
                        {[4, 5, 6, 7, 8, 9, ambassadors.length].map((h, i) => (
                          <div 
                            key={i}
                            className="flex-1 bg-purple-500/30 rounded-t transition-all duration-300 hover:bg-purple-500/50"
                            style={{ height: `${(h / 12) * 100}%` }}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts & Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Activity Timeline Chart */}
                  <Card className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-800 hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-primary" />
                          <span className="font-heading">
                            {language === 'en' ? 'Activity Overview' : 'Aperçu de l\'Activité'}
                          </span>
                        </div>
                        <Badge variant="outline" className="font-heading">
                          {language === 'en' ? 'Last 7 days' : '7 derniers jours'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-end justify-between gap-2">
                        {[12, 18, 15, 22, 19, 25, applications.length].map((value, index) => (
                          <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="relative w-full">
                              <div 
                                className="w-full bg-gradient-to-t from-primary to-secondary rounded-t transition-all duration-300 group-hover:opacity-80 cursor-pointer"
                                style={{ height: `${(value / 30) * 100}%` }}
                              />
                              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border px-2 py-1 rounded text-xs font-heading whitespace-nowrap">
                                {value}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground font-heading">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Distribution Chart */}
                  <Card className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-900 hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PieChart className="w-5 h-5 text-primary" />
                          <span className="font-heading">
                            {language === 'en' ? 'Applications Status' : 'Statut des Candidatures'}
                          </span>
                        </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                        {/* Pending */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-heading text-muted-foreground">
                              {language === 'en' ? 'Pending' : 'En Attente'}
                            </span>
                            <span className="text-sm font-bold font-heading">{pendingApplications.length}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full transition-all duration-500"
                              style={{ width: `${applications.length > 0 ? (pendingApplications.length / applications.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        {/* Approved */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-heading text-muted-foreground">
                              {language === 'en' ? 'Approved' : 'Approuvé'}
                            </span>
                            <span className="text-sm font-bold font-heading">{approvedCount}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
                              style={{ width: `${applications.length > 0 ? (approvedCount / applications.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        {/* Rejected */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-heading text-muted-foreground">
                              {language === 'en' ? 'Rejected' : 'Rejeté'}
                            </span>
                            <span className="text-sm font-bold font-heading">
                              {applications.filter(a => a.status === 'rejected').length}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500"
                              style={{ width: `${applications.length > 0 ? (applications.filter(a => a.status === 'rejected').length / applications.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        {/* Summary */}
                        <div className="pt-4 border-t border-border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-heading font-semibold">
                              {language === 'en' ? 'Total Applications' : 'Total des Candidatures'}
                            </span>
                            <span className="text-lg font-bold font-heading text-primary">
                              {applications.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions & Upcoming Events */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Quick Actions */}
                  <Card className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-1000 hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-heading">
                        <Target className="w-5 h-5 text-primary" />
                        {language === 'en' ? 'Quick Actions' : 'Actions Rapides'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button 
                        onClick={() => setActiveTab("events")}
                        className="w-full justify-start font-heading btn-gradient"
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'Create New Event' : 'Créer un Nouvel Événement'}
                      </Button>
                      <Button 
                        onClick={() => setActiveTab("applications")}
                        className="w-full justify-start font-heading"
                        variant="outline"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'Review Applications' : 'Examiner les Candidatures'}
                      </Button>
                      <Button 
                        onClick={() => setActiveTab("ambassadors")}
                        className="w-full justify-start font-heading"
                        variant="outline"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'Manage Ambassadors' : 'Gérer les Ambassadeurs'}
                      </Button>
                      <Button 
                        onClick={() => setActiveTab("tickets")}
                        className="w-full justify-start font-heading"
                        variant="outline"
                      >
                        <Ticket className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'View Ticket Sales' : 'Voir les Ventes de Billets'}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Upcoming Events Preview */}
                  <Card className="lg:col-span-2 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-1100 hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-primary" />
                          <span className="font-heading">
                            {language === 'en' ? 'Upcoming Events' : 'Événements à Venir'}
                          </span>
                        </div>
                        <Button 
                          onClick={() => setActiveTab("events")}
                          variant="ghost"
                          size="sm"
                          className="font-heading"
                        >
                          {language === 'en' ? 'View All' : 'Voir Tout'}
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {events
                          .filter(e => e.event_type === 'upcoming' && new Date(e.date) >= new Date())
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .slice(0, 3)
                          .map((event, index) => (
                            <div 
                              key={event.id}
                              className={`p-4 bg-muted/50 rounded-lg border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer group animate-in slide-in-from-left-4 fade-in duration-500 ${
                                index === 0 ? 'delay-1200' :
                                index === 1 ? 'delay-1300' :
                                'delay-1400'
                              }`}
                              onClick={() => setActiveTab("events")}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-1">
                                  <h4 className="font-semibold font-heading group-hover:text-primary transition-colors">
                                    {event.name}
                                  </h4>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground font-heading">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(event.date).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {event.venue}
                                    </div>
                                  </div>
                                </div>
                                <Badge variant="outline" className="font-heading">
                                  {event.featured ? (language === 'en' ? 'Featured' : 'En Vedette') : event.event_type}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        {events.filter(e => e.event_type === 'upcoming' && new Date(e.date) >= new Date()).length === 0 && (
                          <div className="text-center py-8 text-muted-foreground font-heading">
                            {language === 'en' ? 'No upcoming events' : 'Aucun événement à venir'}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity - Enhanced */}
                <Card className="animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-1500 hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary animate-pulse" />
                        <span className="font-heading">
                          {language === 'en' ? 'Recent Activity' : 'Activité Récente'}
                        </span>
                      </div>
                      <Button 
                        onClick={() => setActiveTab("applications")}
                        variant="ghost"
                        size="sm"
                        className="font-heading"
                      >
                        {language === 'en' ? 'View All' : 'Voir Tout'}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {applications.slice(0, 5).map((app, index) => (
                        <div 
                          key={app.id} 
                          className={`flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border/50 hover:border-primary/50 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-md group animate-in slide-in-from-left-4 fade-in duration-500 ${
                            index === 0 ? 'delay-1600' :
                            index === 1 ? 'delay-1700' :
                            index === 2 ? 'delay-1800' :
                            index === 3 ? 'delay-1900' :
                            'delay-2000'
                          }`}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`p-2 rounded-lg ${
                              app.status === 'approved' ? 'bg-green-500/20' :
                              app.status === 'rejected' ? 'bg-red-500/20' :
                              'bg-yellow-500/20'
                            }`}>
                              {app.status === 'approved' ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : app.status === 'rejected' ? (
                                <XCircle className="w-5 h-5 text-red-500" />
                              ) : (
                                <Clock className="w-5 h-5 text-yellow-500" />
                              )}
                          </div>
                            <div className="flex-1">
                              <p className="font-semibold font-heading group-hover:text-primary transition-colors">
                                {app.full_name}
                              </p>
                              <p className="text-sm text-muted-foreground font-heading">
                                {app.city} • {app.phone_number}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(app.status)}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveTab("applications")}
                              className="opacity-0 group-hover:opacity-100 transition-opacity font-heading"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {applications.length === 0 && (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground font-heading">
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

              {/* Ticket Management Tab - Redesigned */}
              <TabsContent value="tickets" className="space-y-6">
                {/* 🔶 1. Header Section */}
                <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-700">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-3xl md:text-4xl font-heading font-bold text-gradient-neon mb-2 animate-in slide-in-from-left-4 duration-1000">
                        Ticket Management
                  </h2>
                      <p className="text-sm md:text-base text-muted-foreground font-heading animate-in slide-in-from-left-4 duration-1000 delay-200">
                        Overview of Events • Ticket Sales • Performance Analytics
                      </p>
                              </div>
                    <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
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
                        className="transform hover:scale-105 hover:shadow-md transition-all duration-300 group font-heading"
                    >
                      <RefreshCw className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-180" />
                      Refresh
                    </Button>
                    </div>
                  </div>
                  
                  {/* Search and Filter Bar */}
                  <div className="flex flex-col sm:flex-row gap-3 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search events, customers, tickets..."
                        value={ticketSearchQuery}
                        onChange={(e) => setTicketSearchQuery(e.target.value)}
                        className="pl-10 font-heading bg-card border-border focus:border-primary"
                      />
                    </div>
                    <Select value={ticketFilterStatus} onValueChange={setTicketFilterStatus}>
                      <SelectTrigger className="w-full sm:w-[180px] font-heading">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="past">Past Events</SelectItem>
                        <SelectItem value="active">Active Sales</SelectItem>
                      </SelectContent>
                    </Select>
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

                {/* 🔶 2. KPI Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-400">
                  {/* Total Events Card */}
                  <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group animate-in slide-in-from-left-4 duration-500 delay-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Calendar className="w-6 h-6 text-primary" />
                      </div>
                        <div className="flex items-center gap-1 text-green-500 text-sm font-heading font-semibold">
                          <TrendingUp className="w-4 h-4" />
                          <span>+12.5%</span>
                      </div>
                    </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-heading">Total Events</p>
                        <p className="text-3xl font-heading font-bold text-primary">{events.length}</p>
                        {/* Mini sparkline */}
                        <div className="h-8 w-full flex items-end gap-1 opacity-60">
                          {[65, 72, 68, 80, 75, 85, 90].map((h, i) => (
                            <div key={i} className="flex-1 bg-primary rounded-t" style={{ height: `${h}%` }} />
                          ))}
                  </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Tickets Sold Card */}
                  <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group animate-in slide-in-from-left-4 duration-500 delay-600">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                          <Ticket className="w-6 h-6 text-green-500" />
                      </div>
                        <div className="flex items-center gap-1 text-green-500 text-sm font-heading font-semibold">
                          <TrendingUp className="w-4 h-4" />
                          <span>+8.2%</span>
                      </div>
                    </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-heading">Tickets Sold</p>
                        <p className="text-3xl font-heading font-bold text-green-500">{ticketStats.soldTickets || ticketStats.totalSold || 0}</p>
                        {/* Mini sparkline */}
                        <div className="h-8 w-full flex items-end gap-1 opacity-60">
                          {[45, 52, 48, 60, 55, 65, 70].map((h, i) => (
                            <div key={i} className="flex-1 bg-green-500 rounded-t" style={{ height: `${h}%` }} />
                          ))}
                  </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Revenue Generated Card */}
                  <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group animate-in slide-in-from-left-4 duration-500 delay-700">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                          <DollarSign className="w-6 h-6 text-orange-500" />
                      </div>
                        <div className="flex items-center gap-1 text-green-500 text-sm font-heading font-semibold">
                          <TrendingUp className="w-4 h-4" />
                          <span>+15.3%</span>
                      </div>
                    </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-heading">Revenue Generated</p>
                        <p className="text-3xl font-heading font-bold text-orange-500">{(ticketStats.revenue || ticketStats.totalRevenue || 0).toLocaleString()} TND</p>
                        {/* Mini sparkline */}
                        <div className="h-8 w-full flex items-end gap-1 opacity-60">
                          {[55, 62, 58, 70, 65, 75, 80].map((h, i) => (
                            <div key={i} className="flex-1 bg-orange-500 rounded-t" style={{ height: `${h}%` }} />
                          ))}
                  </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Conversion Rate Card */}
                  <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 group animate-in slide-in-from-left-4 duration-500 delay-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                          <Target className="w-6 h-6 text-purple-500" />
                      </div>
                        <div className="flex items-center gap-1 text-red-500 text-sm font-heading font-semibold">
                          <TrendingDown className="w-4 h-4" />
                          <span>-2.1%</span>
                      </div>
                    </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-heading">Conversion Rate</p>
                        <p className="text-3xl font-heading font-bold text-purple-500">
                          {ticketStats.totalTickets > 0 
                            ? Math.round((ticketStats.soldTickets / ticketStats.totalTickets) * 100) 
                            : 0}%
                        </p>
                        {/* Mini sparkline */}
                        <div className="h-8 w-full flex items-end gap-1 opacity-60">
                          {[70, 68, 72, 65, 70, 68, 66].map((h, i) => (
                            <div key={i} className="flex-1 bg-purple-500 rounded-t" style={{ height: `${h}%` }} />
                          ))}
                  </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 🔶 3. Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-900">
                  {/* Left: Ticket Sales Chart */}
                  <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-1000">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                      <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Ticket Sales Over Time
                      </CardTitle>
                      <Select value={chartPeriod} onValueChange={(v: any) => setChartPeriod(v)}>
                        <SelectTrigger className="w-[120px] font-heading text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 bg-muted/20 rounded-xl p-4">
                      <div className="relative h-full">
                        {/* Y-axis labels */}
                          <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground font-heading">
                            <span>500</span>
                            <span>375</span>
                            <span>250</span>
                            <span>125</span>
                          <span>0</span>
                        </div>
                        
                        {/* Chart area */}
                        <div className="absolute left-12 right-0 top-0 bottom-0">
                          {/* Grid lines */}
                          <div className="absolute inset-0 flex flex-col justify-between">
                            {[0, 1, 2, 3, 4].map((i) => (
                                <div key={i} className="border-b border-muted/20 h-0"></div>
                            ))}
                          </div>
                          
                            {/* Line chart with time-based data */}
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="salesLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="hsl(var(--primary))" />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                              </linearGradient>
                                <filter id="salesGlow">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge> 
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                              </filter>
                            </defs>
                            
                              {/* Sample data points for time series */}
                              {(() => {
                                const dataPoints = [20, 35, 28, 45, 38, 52, 48, 60, 55, 65, 58, 70];
                                const pathData = dataPoints.map((val, i) => {
                                  const x = (i / (dataPoints.length - 1)) * 100;
                                  const y = 100 - (val / 100 * 100);
                                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                }).join(' ');
                                
                                return (
                                  <>
                            <path
                                      d={pathData + ' L 100 100 L 0 100 Z'}
                                      fill="url(#salesLineGradient)"
                                      opacity="0.3"
                                    />
                                    <path
                                      d={pathData}
                              stroke="hsl(var(--primary))"
                                      strokeWidth="2.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                                      filter="url(#salesGlow)"
                                    />
                                    {dataPoints.map((val, i) => {
                                      const x = (i / (dataPoints.length - 1)) * 100;
                                      const y = 100 - (val / 100 * 100);
                              return (
                                        <circle key={i} cx={x} cy={y} r="3" fill="hsl(var(--primary))" stroke="white" strokeWidth="1.5" />
                              );
                            })}
                                  </>
                                );
                              })()}
                          </svg>
                          
                            {/* X-axis labels */}
                            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-2 font-heading">
                              {chartPeriod === 'daily' && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                                <span key={i}>{day}</span>
                              ))}
                              {chartPeriod === 'weekly' && ['W1', 'W2', 'W3', 'W4'].map((week, i) => (
                                <span key={i}>{week}</span>
                              ))}
                              {chartPeriod === 'monthly' && ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => (
                                <span key={i}>{month}</span>
                              ))}
                              {chartPeriod === 'yearly' && ['2020', '2021', '2022', '2023', '2024'].map((year, i) => (
                                <span key={i}>{year}</span>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    </CardContent>
                  </Card>

                  {/* Right: Revenue Breakdown Donut Chart */}
                  <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-right-4 duration-500 delay-1100">
                    <CardHeader>
                      <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-primary" />
                        Revenue Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center h-64">
                        {/* Donut Chart */}
                        <div className="relative w-48 h-48">
                          <svg viewBox="0 0 100 100" className="transform -rotate-90">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                            {/* Regular Tickets - 45% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="hsl(var(--primary))"
                              strokeWidth="8"
                              strokeDasharray={`${2 * Math.PI * 40}`}
                              strokeDashoffset={`${2 * Math.PI * 40 * 0.55}`}
                              strokeLinecap="round"
                            />
                            {/* VIP Tickets - 30% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="8"
                              strokeDasharray={`${2 * Math.PI * 40}`}
                              strokeDashoffset={`${2 * Math.PI * 40 * 0.25}`}
                              strokeLinecap="round"
                            />
                            {/* Early Bird - 15% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="8"
                              strokeDasharray={`${2 * Math.PI * 40}`}
                              strokeDashoffset={`${2 * Math.PI * 40 * 0.10}`}
                              strokeLinecap="round"
                            />
                            {/* Promotions - 7% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#8b5cf6"
                              strokeWidth="8"
                              strokeDasharray={`${2 * Math.PI * 40}`}
                              strokeDashoffset={`${2 * Math.PI * 40 * 0.03}`}
                              strokeLinecap="round"
                            />
                            {/* On-site - 3% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#ec4899"
                              strokeWidth="8"
                              strokeDasharray={`${2 * Math.PI * 40}`}
                              strokeDashoffset="0"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-2xl font-heading font-bold text-primary">{(ticketStats.revenue || 0).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground font-heading">TND</p>
                            </div>
                            </div>
                          </div>
                          </div>
                      
                      {/* Legend */}
                      <div className="space-y-2 mt-6">
                        {[
                          { label: 'Regular Tickets', value: '45%', color: 'hsl(var(--primary))' },
                          { label: 'VIP Tickets', value: '30%', color: '#10b981' },
                          { label: 'Early Bird', value: '15%', color: '#f59e0b' },
                          { label: 'Promotions', value: '7%', color: '#8b5cf6' },
                          { label: 'On-site Sales', value: '3%', color: '#ec4899' }
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-sm font-heading">{item.label}</span>
                            </div>
                            <span className="text-sm font-heading font-semibold">{item.value}</span>
                        </div>
                      ))}
                        </div>
                    </CardContent>
                  </Card>
                    </div>

                {/* 🔶 4. Events Table Section */}
                <Card className="bg-card rounded-2xl border-border/50 shadow-lg animate-in slide-in-from-bottom-4 duration-700 delay-1200">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Events Overview
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="font-heading">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                  </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left p-3 text-sm font-heading font-semibold text-muted-foreground">Event Name</th>
                            <th className="text-left p-3 text-sm font-heading font-semibold text-muted-foreground">Date & Time</th>
                            <th className="text-left p-3 text-sm font-heading font-semibold text-muted-foreground">Venue</th>
                            <th className="text-right p-3 text-sm font-heading font-semibold text-muted-foreground">Tickets Sold</th>
                            <th className="text-right p-3 text-sm font-heading font-semibold text-muted-foreground">Remaining</th>
                            <th className="text-right p-3 text-sm font-heading font-semibold text-muted-foreground">Revenue</th>
                            <th className="text-center p-3 text-sm font-heading font-semibold text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {events
                            .filter(event => {
                              if (ticketFilterStatus === 'all') return true;
                              if (ticketFilterStatus === 'upcoming') return event.event_type === 'upcoming';
                              if (ticketFilterStatus === 'past') return event.event_type === 'past';
                              return true;
                            })
                            .filter(event => {
                              if (!ticketSearchQuery) return true;
                              return event.name.toLowerCase().includes(ticketSearchQuery.toLowerCase()) ||
                                     event.venue.toLowerCase().includes(ticketSearchQuery.toLowerCase());
                            })
                            .map((event, index) => {
                              const eventTickets = tickets.filter(t => t.event_id === event.id);
                              const ticketsSold = eventTickets.reduce((sum, t) => sum + (t.quantity - t.available_quantity), 0);
                              const totalTickets = eventTickets.reduce((sum, t) => sum + t.quantity, 0);
                              const remaining = totalTickets - ticketsSold;
                              const revenue = eventTickets.reduce((sum, t) => sum + ((t.quantity - t.available_quantity) * t.price), 0);
                              
                              return (
                                <tr 
                                  key={event.id} 
                                  className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                                  onClick={() => {
                                    setSelectedEventForInsights(event);
                                    setIsEventInsightsOpen(true);
                                  }}
                                >
                                  <td className="p-3">
                                    <div className="font-heading font-semibold">{event.name}</div>
                                    <Badge variant={event.event_type === 'upcoming' ? 'default' : 'secondary'} className="mt-1 text-xs">
                                      {event.event_type === 'upcoming' ? 'Upcoming' : 'Past'}
                                    </Badge>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-heading">{new Date(event.date).toLocaleDateString()}</div>
                                    <div className="text-xs text-muted-foreground">20:00</div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-heading">{event.venue}</div>
                                    <div className="text-xs text-muted-foreground">{event.city}</div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="font-heading font-semibold text-green-500">{ticketsSold}</div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="font-heading font-semibold text-blue-500">{remaining}</div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="font-heading font-semibold text-primary">{revenue.toLocaleString()} TND</div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedEventForInsights(event);
                                          setIsEventInsightsOpen(true);
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingEvent(event);
                                          setIsEventDialogOpen(true);
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedEventForInsights(event);
                                          setIsEventInsightsOpen(true);
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <BarChart3 className="w-4 h-4" />
                                      </Button>
                </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* 🔶 5. Support & Ticket Issues Section */}
                <Card className="bg-card rounded-2xl border-border/50 shadow-lg animate-in slide-in-from-bottom-4 duration-700 delay-1300">
                  <CardHeader>
                    <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-primary" />
                      Support & Ticket Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {ticketIssues.map((issue) => (
                        <div 
                          key={issue.id} 
                          className="flex items-center justify-between p-4 bg-muted/20 rounded-xl hover:bg-muted/30 transition-all duration-300 border border-border/30"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`w-3 h-3 rounded-full ${
                              issue.priority === 'high' ? 'bg-red-500' :
                              issue.priority === 'medium' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-heading font-semibold">{issue.customerName}</p>
                                <Badge 
                                  variant={issue.priority === 'high' ? 'destructive' : issue.priority === 'medium' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {issue.priority.toUpperCase()}
                                </Badge>
                                {issue.status === 'resolved' && (
                                  <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                                    Resolved
                                  </Badge>
                                )}
                        </div>
                              <p className="text-sm text-muted-foreground font-heading">{issue.issue}</p>
                      </div>
                        </div>
                          <Button
                            variant={issue.status === 'resolved' ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => {
                              setTicketIssues(prev => prev.map(i => 
                                i.id === issue.id ? { ...i, status: 'resolved' } : i
                              ));
                            }}
                            className="font-heading"
                            disabled={issue.status === 'resolved'}
                          >
                            {issue.status === 'resolved' ? 'Resolved' : 'Resolve'}
                          </Button>
                      </div>
                      ))}
                        </div>
                  </CardContent>
                </Card>

                {/* 🔶 6. Event Insights Panel (Dialog) */}
                <Dialog open={isEventInsightsOpen} onOpenChange={setIsEventInsightsOpen}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                    {selectedEventForInsights && (
                      <>
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-heading font-bold text-gradient-neon">
                            Event Insights: {selectedEventForInsights.name}
                          </DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-6 mt-4">
                          {/* Event Overview */}
                          <div className="bg-muted/20 rounded-xl p-6">
                            <h3 className="text-lg font-heading font-semibold mb-4">Event Overview</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground font-heading">Organizer</p>
                                <p className="font-heading font-semibold">Andiamo Events</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground font-heading">Category</p>
                                <p className="font-heading font-semibold">Nightlife</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground font-heading">Status</p>
                                <Badge variant={selectedEventForInsights.event_type === 'upcoming' ? 'default' : 'secondary'}>
                                  {selectedEventForInsights.event_type === 'upcoming' ? 'Upcoming' : 'Past'}
                                </Badge>
                            </div>
                              <div>
                                <p className="text-sm text-muted-foreground font-heading">Venue</p>
                                <p className="font-heading font-semibold">{selectedEventForInsights.venue}</p>
                    </div>
                  </div>
                </div>

                          {/* Performance Metrics */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="bg-card">
                              <CardContent className="p-4">
                                <p className="text-sm text-muted-foreground font-heading mb-1">Total Sales</p>
                                <p className="text-2xl font-heading font-bold text-primary">
                                  {tickets.filter(t => t.event_id === selectedEventForInsights.id)
                                    .reduce((sum, t) => sum + (t.quantity - t.available_quantity), 0)}
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="bg-card">
                              <CardContent className="p-4">
                                <p className="text-sm text-muted-foreground font-heading mb-1">Total Revenue</p>
                                <p className="text-2xl font-heading font-bold text-green-500">
                                  {tickets.filter(t => t.event_id === selectedEventForInsights.id)
                                    .reduce((sum, t) => sum + ((t.quantity - t.available_quantity) * t.price), 0).toLocaleString()} TND
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="bg-card">
                              <CardContent className="p-4">
                                <p className="text-sm text-muted-foreground font-heading mb-1">Conversion Rate</p>
                                <p className="text-2xl font-heading font-bold text-purple-500">68%</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-card">
                              <CardContent className="p-4">
                                <p className="text-sm text-muted-foreground font-heading mb-1">Refund Requests</p>
                                <p className="text-2xl font-heading font-bold text-orange-500">3</p>
                              </CardContent>
                            </Card>
                  </div>

                          {/* Top Referral Sources */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg font-heading">Top Referral Sources</CardTitle>
                            </CardHeader>
                            <CardContent>
                    <div className="space-y-3">
                                {[
                                  { source: 'Meta Ads', percentage: 35, color: 'bg-blue-500' },
                                  { source: 'Instagram', percentage: 28, color: 'bg-pink-500' },
                                  { source: 'Google Ads', percentage: 20, color: 'bg-green-500' },
                                  { source: 'Direct', percentage: 12, color: 'bg-purple-500' },
                                  { source: 'Other', percentage: 5, color: 'bg-gray-500' }
                                ].map((item, i) => (
                                  <div key={i} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm font-heading">
                                      <span>{item.source}</span>
                                      <span className="font-semibold">{item.percentage}%</span>
                            </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                                        style={{ width: `${item.percentage}%` }}
                                      />
                          </div>
                        </div>
                      ))}
                    </div>
                            </CardContent>
                          </Card>
                  </div>
                      </>
                    )}
                  </DialogContent>
                </Dialog>


              </TabsContent>

              {/* Marketing Tab */}
              <TabsContent value="marketing" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full px-2">
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
                        {loadingBalance ? (
                          <div className="flex flex-col items-center justify-center py-8 space-y-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground font-heading">
                              {language === 'en' ? 'Checking balance...' : 'Vérification du solde...'}
                            </p>
                          </div>
                        ) : smsBalance?.balance ? (
                          <>
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                              <div className="flex-1">
                                <p className="text-sm text-muted-foreground font-heading">{language === 'en' ? 'Current Balance' : 'Solde Actuel'}</p>
                                {typeof smsBalance.balance === 'object' ? (
                                    <div className="mt-1">
                                    <p className="text-2xl font-heading font-bold text-primary">
                                        {smsBalance.balance.balance || smsBalance.balance.solde || smsBalance.balance.credit || 'N/A'}
                                      </p>
                                      {smsBalance.balance.balance === 0 || smsBalance.balance.solde === 0 || smsBalance.balance.credit === 0 ? (
                                      <p className="text-xs text-red-500 mt-1 font-heading">
                                          ⚠️ {language === 'en' ? 'Insufficient balance!' : 'Solde insuffisant!'}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                  <p className="text-2xl font-heading font-bold text-primary mt-1">
                                      {smsBalance.balance}
                                      {smsBalance.balance === '0' || smsBalance.balance === 0 ? (
                                        <span className="text-xs text-red-500 ml-2">
                                          ⚠️ {language === 'en' ? 'Insufficient!' : 'Insuffisant!'}
                                        </span>
                                      ) : null}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={fetchSmsBalance}
                              disabled={loadingBalance}
                              variant="outline"
                              size="sm"
                              className="w-full font-heading"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                              {language === 'en' ? 'Refresh Balance' : 'Actualiser le Solde'}
                            </Button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                              <CreditCard className="w-8 h-8 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center font-heading">
                              {language === 'en' 
                                ? 'Click the button below to check your SMS balance' 
                                : 'Cliquez sur le bouton ci-dessous pour vérifier votre solde SMS'}
                            </p>
                            <Button
                              onClick={fetchSmsBalance}
                              disabled={loadingBalance}
                              className="w-full font-heading btn-gradient"
                              size="lg"
                            >
                              <CreditCard className="w-5 h-5 mr-2" />
                              {language === 'en' ? 'Check SMS Balance' : 'Vérifier le Solde SMS'}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Test SMS Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <PhoneCall className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Test SMS' : 'SMS Test'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? 'Send a test SMS to verify the API'
                            : 'Envoyer un SMS test pour vérifier l\'API'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="testPhone">{language === 'en' ? 'Phone Number' : 'Numéro de Téléphone'} *</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground font-heading">+216</span>
                            <Input
                              id="testPhone"
                              type="text"
                              value={testPhoneNumber}
                              onChange={(e) => setTestPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                              placeholder="21234567"
                              className="flex-1 font-heading"
                              maxLength={8}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground font-heading">
                            {language === 'en' ? 'Enter 8 digits (e.g., 21234567)' : 'Entrez 8 chiffres (ex: 21234567)'}
                          </p>
                        </div>
                            <div className="space-y-2">
                          <Label htmlFor="testMessage">{language === 'en' ? 'Test Message' : 'Message Test'} *</Label>
                              <Textarea
                            id="testMessage"
                            value={testSmsMessage}
                            onChange={(e) => setTestSmsMessage(e.target.value)}
                                placeholder={language === 'en' 
                              ? 'Enter your test message here...'
                              : 'Entrez votre message test ici...'}
                            className="min-h-[100px] text-sm bg-background text-foreground font-heading"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{language === 'en' ? 'Characters' : 'Caractères'}: {testSmsMessage.length}</span>
                            <span>{language === 'en' ? 'Approx. messages' : 'Messages approx.'}: {Math.ceil(testSmsMessage.length / 160)}</span>
                          </div>
                        </div>
                                <Button
                          onClick={handleSendTestSms}
                          disabled={sendingTestSms || !testPhoneNumber.trim() || !testSmsMessage.trim()}
                          className="w-full font-heading btn-gradient"
                          size="lg"
                        >
                          {sendingTestSms ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                              {language === 'en' ? 'Sending...' : 'Envoi...'}
                                    </>
                                  ) : (
                                    <>
                              <Send className="w-5 h-5 mr-2" />
                              {language === 'en' ? 'Send Test SMS' : 'Envoyer SMS Test'}
                                    </>
                                  )}
                                </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* SMS Broadcast Card */}
                <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Send className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'SMS Broadcast' : 'Diffusion SMS'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? `Send message to all subscribers`
                            : `Envoyer un message à tous les abonnés`}
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
                                ? `Send SMS to All Subscribers`
                                : `Envoyer SMS à Tous les Abonnés`}
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
                <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
                    {language === 'en' ? 'Site Logs & Analytics' : 'Journaux et Analytiques du Site'}
                  </h2>
                  <Button
                    onClick={fetchSiteLogs}
                    disabled={loadingSiteLogs}
                    variant="outline"
                    className="animate-in slide-in-from-right-4 duration-1000"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingSiteLogs ? 'animate-spin' : ''}`} />
                    {language === 'en' ? 'Refresh' : 'Actualiser'}
                  </Button>
                </div>

                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-primary" />
                      {language === 'en' ? 'Activity Logs' : 'Journaux d\'Activité'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {language === 'en' 
                        ? 'View all website activity, errors, and events' 
                        : 'Voir toutes les activités, erreurs et événements du site'}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {loadingSiteLogs ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">
                          {language === 'en' ? 'Loading logs...' : 'Chargement des logs...'}
                        </span>
                      </div>
                    ) : siteLogs.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{language === 'en' ? 'No logs found' : 'Aucun log trouvé'}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left p-3 text-sm font-semibold">{language === 'en' ? 'Time' : 'Heure'}</th>
                                <th className="text-left p-3 text-sm font-semibold">{language === 'en' ? 'Type' : 'Type'}</th>
                                <th className="text-left p-3 text-sm font-semibold">{language === 'en' ? 'Category' : 'Catégorie'}</th>
                                <th className="text-left p-3 text-sm font-semibold">{language === 'en' ? 'User' : 'Utilisateur'}</th>
                                <th className="text-left p-3 text-sm font-semibold">{language === 'en' ? 'Message' : 'Message'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {siteLogs.map((log) => (
                                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                  <td className="p-3 text-sm text-muted-foreground">
                                    {new Date(log.created_at).toLocaleString()}
                                  </td>
                                  <td className="p-3">
                                    <Badge 
                                      variant={
                                        log.log_type === 'error' ? 'destructive' :
                                        log.log_type === 'warning' ? 'default' :
                                        log.log_type === 'success' ? 'default' :
                                        'secondary'
                                      }
                                      className={
                                        log.log_type === 'error' ? 'bg-red-500' :
                                        log.log_type === 'warning' ? 'bg-yellow-500' :
                                        log.log_type === 'success' ? 'bg-green-500' :
                                        ''
                                      }
                                    >
                                      {log.log_type}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-sm">{log.category}</td>
                                  <td className="p-3 text-sm">
                                    <Badge variant="outline">{log.user_type || 'guest'}</Badge>
                                  </td>
                                  <td className="p-3 text-sm">
                                    <div className="max-w-md">
                                      <p className="truncate">{log.message}</p>
                                      {log.details && (
                                        <details className="mt-1">
                                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                            {language === 'en' ? 'Details' : 'Détails'}
                                          </summary>
                                          <pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-auto max-h-32">
                                            {JSON.stringify(log.details, null, 2)}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="text-sm text-muted-foreground text-center pt-4">
                          {language === 'en' 
                            ? `Showing ${siteLogs.length} most recent logs` 
                            : `Affichage des ${siteLogs.length} logs les plus récents`}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
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

                  {/* About Images Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'About Page Images' : 'Images de la Page À Propos'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? 'Manage images displayed on the About page. Upload, reorder, or remove images. Recommended: 4 images for best display.' 
                            : 'Gérez les images affichées sur la page À propos. Téléchargez, réorganisez ou supprimez des images. Recommandé: 4 images pour un meilleur affichage.'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {loadingAboutImages ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <>
                            {/* Upload About Image */}
                            <div className="space-y-2">
                              <Label>{language === 'en' ? 'Upload About Image' : 'Télécharger une Image'}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadAboutImage(file);
                                  }
                                }}
                                accept="image/*"
                                maxSize={10}
                                label={uploadingAboutImage ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : (language === 'en' ? 'Upload About Image' : 'Télécharger une Image')}
                              />
                              {uploadingAboutImage && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  {language === 'en' ? 'Uploading image...' : 'Téléchargement de l\'image...'}
                                </div>
                              )}
                            </div>

                            {/* About Images List */}
                            {aboutImages.length === 0 ? (
                              <div className="flex items-center justify-center py-8 text-center text-muted-foreground">
                                <p>{language === 'en' ? 'No about images uploaded yet' : 'Aucune image À propos téléchargée'}</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Label className="text-sm">{language === 'en' ? 'Reorder Images' : 'Réorganiser les Images'}</Label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {aboutImages.map((image, index) => (
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
                                                    const newOrder = [...aboutImages];
                                                    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                                    handleReorderAboutImages(newOrder);
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
                                                  if (index < aboutImages.length - 1) {
                                                    const newOrder = [...aboutImages];
                                                    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                                    handleReorderAboutImages(newOrder);
                                                  }
                                                }}
                                                disabled={index === aboutImages.length - 1}
                                                className="shadow-lg"
                                              >
                                                <ArrowDown className="w-4 h-4" />
                                              </Button>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => handleDeleteAboutImage(index)}
                                              className="shadow-lg"
                                            >
                                              <Trash2 className="w-4 h-4 mr-1" />
                                              {language === 'en' ? 'Delete' : 'Supprimer'}
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

                  {/* OG Image Settings Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Social Media Preview Image' : 'Image d\'Aperçu des Réseaux Sociaux'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? 'Upload an image that appears when sharing your website link on social media (WhatsApp, Facebook, Twitter, etc.). Recommended size: 1200x630px.' 
                            : 'Téléchargez une image qui apparaît lors du partage du lien de votre site sur les réseaux sociaux (WhatsApp, Facebook, Twitter, etc.). Taille recommandée: 1200x630px.'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {loadingOGImageSettings ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">
                                {language === 'en' ? 'Upload Preview Image' : 'Télécharger l\'Image d\'Aperçu'}
                              </Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadOGImage(file);
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                label={uploadingOGImage ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : (language === 'en' ? 'Upload Preview Image' : 'Télécharger l\'Image d\'Aperçu')}
                                maxSize={5 * 1024 * 1024}
                              />
                              {ogImageSettings.og_image && (
                                <div className="mt-4 space-y-2">
                                  <Label className="text-sm font-semibold">
                                    {language === 'en' ? 'Current Preview Image' : 'Image d\'Aperçu Actuelle'}
                                  </Label>
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
                                        {language === 'en' ? 'Delete Preview Image' : 'Supprimer l\'Image d\'Aperçu'}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {!ogImageSettings.og_image && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {language === 'en' ? 'No preview image uploaded yet' : 'Aucune image d\'aperçu téléchargée'}
                                </p>
                              )}
                              {ogImageSettings.og_image && (
                                <Alert className="mt-4">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription className="text-xs">
                                    {language === 'en' 
                                      ? 'After uploading a new image, social media platforms may show the old cached image. To fix this: 1) Wait 5-10 minutes for changes to propagate, 2) Use Facebook Sharing Debugger or Twitter Card Validator to clear cache, 3) Share the link again.'
                                      : 'Après avoir téléchargé une nouvelle image, les plateformes de médias sociaux peuvent afficher l\'ancienne image mise en cache. Pour corriger cela : 1) Attendez 5-10 minutes, 2) Utilisez Facebook Sharing Debugger ou Twitter Card Validator pour vider le cache, 3) Partagez à nouveau le lien.'}
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </div>
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
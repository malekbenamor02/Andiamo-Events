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
import FileUpload from "@/components/ui/file-upload";
import { uploadImage } from "@/lib/upload";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createApprovalEmail, createRejectionEmail, generatePassword, sendEmail } from "@/lib/email";
import {
  CheckCircle, XCircle, Clock, Users, TrendingUp, DollarSign, LogOut,
  Plus, Edit, Trash2, Calendar, MapPin, Phone, Mail, User, Settings,
  Eye, EyeOff, Save, X, Image, Video, Upload,
  Instagram, BarChart3, FileText, Building2, Users2, MessageCircle,
  PieChart, Download, RefreshCw, Copy
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import bcrypt from 'bcryptjs';


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
  ticket_link?: string;
  whatsapp_link?: string;
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

const AdminDashboard = ({ language }: AdminDashboardProps) => {
  const [applications, setApplications] = useState<AmbassadorApplication[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
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
      eventTicketLink: "Ticket Link",
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
      approvedAmbassadors: "Total Ambassadors"
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
      eventTicketLink: "Lien des Billets",
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
      approvedAmbassadors: "Ambassadeurs Totaux"
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
        // Animate contact messages one by one
        filteredContactMessages.forEach((message, index) => {
          setTimeout(() => {
            setAnimatedContactMessages(prev => new Set([...prev, message.id]));
          }, index * 150); // 150ms delay between each message
        });
      }, 300);
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

    // Animation effect for tickets
  useEffect(() => {
    if (activeTab === "tickets" && !hasTicketsAnimated) {
      const timer = setTimeout(() => {
        setHasTicketsAnimated(true);
        // Animate tickets one by one
        tickets.forEach((ticket, index) => {
          setTimeout(() => {
            setAnimatedTickets(prev => new Set([...prev, ticket.id]));
          }, index * 150); // 150ms delay between each ticket
        });
      }, 300);
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
      } else {
        // Create ambassador account
        const { error: createError } = await supabase
          .from('ambassadors')
          .insert({
            full_name: application.full_name,
            phone: application.phone_number,
            email: application.email,
            city: application.city,
            password: hashedPassword, // Store hashed password
            status: 'approved',
            commission_rate: 10,
            requires_password_change: true,
            created_at: new Date().toISOString()
          });
        if (createError) throw createError;
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
        `${window.location.origin}/ambassador/auth`
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
      <div className="pt-16 min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
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
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 ${
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
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 ${
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
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === "ambassadors" 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t.ambassadors}</span>
              </button>
              <button
                onClick={() => setActiveTab("applications")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === "applications" 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{t.applications}</span>
              </button>
              <button
                onClick={() => setActiveTab("sponsors")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === "sponsors" 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Sponsors</span>
              </button>
              <button
                onClick={() => setActiveTab("team")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === "team" 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent"
                }`}
              >
                <Users2 className="w-4 h-4" />
                <span>Team</span>
              </button>
              <button
                onClick={() => setActiveTab("contact")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 ${
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
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 ${
                  activeTab === "tickets" 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "hover:bg-accent hover:shadow-md"
                }`}
              >
                <DollarSign className={`w-4 h-4 transition-transform duration-300 ${activeTab === "tickets" ? "animate-pulse" : ""}`} />
                <span>Ticket Management</span>
              </button>
            </div>
          </div>
          <div className="p-4 border-t border-border/20">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 transition-all duration-300 transform hover:scale-105 hover:shadow-md"
            >
              <LogOut className="w-4 h-4 transition-transform duration-300" />
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
                <Card className="animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-800">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 animate-pulse" />
                      <span>Recent Activity</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {applications.slice(0, 5).map((app, index) => (
                        <div 
                          key={app.id} 
                          className={`flex items-center justify-between p-3 bg-muted rounded-lg transform transition-all duration-300 hover:scale-105 hover:shadow-md animate-in slide-in-from-left-4 fade-in duration-500 delay-${1000 + index * 100}`}
                        >
                          <div>
                            <p className="font-medium">{app.full_name}</p>
                            <p className="text-sm text-muted-foreground">{app.city} • {app.phone_number}</p>
                          </div>
                          <div className="animate-in zoom-in-95 duration-300 delay-500">
                            {getStatusBadge(app.status)}
                          </div>
                        </div>
                      ))}
                      {applications.length === 0 && (
                        <p className="text-center text-muted-foreground py-8 animate-in fade-in duration-500">
                          {t.noApplications}
                        </p>
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
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="eventTicketLink">{t.eventTicketLink}</Label>
                            <Input
                              id="eventTicketLink"
                              value={editingEvent?.ticket_link || ''}
                              onChange={(e) => setEditingEvent(prev => ({ ...prev, ticket_link: e.target.value }))}
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

                {/* Search Bar */}
                <div className="animate-in slide-in-from-bottom-4 duration-500 delay-400">
                  <div className="relative">
                    <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search messages by name, email, subject, or content..."
                      value={contactMessageSearchTerm}
                      onChange={(e) => setContactMessageSearchTerm(e.target.value)}
                      className="pl-10 transition-all duration-300 focus:scale-105"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {filteredContactMessages.map((message, index) => (
                    <div 
                      key={message.id} 
                      className={`bg-card rounded-xl p-6 shadow-lg transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                        animatedContactMessages.has(message.id) 
                          ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                          : 'opacity-0 translate-y-8'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4 animate-in slide-in-from-left-4 duration-500 delay-200">
                        <div>
                          <h3 className="font-semibold text-lg animate-in slide-in-from-left-4 duration-500 delay-300">
                            {message.name}
                          </h3>
                          <p className="text-muted-foreground animate-in slide-in-from-left-4 duration-500 delay-400">
                            {message.email}
                          </p>
                        </div>
                        <div className="text-right animate-in slide-in-from-right-4 duration-500 delay-500">
                          <p className="text-sm text-muted-foreground">
                            {new Date(message.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 delay-600">
                        <div>
                          <h4 className="font-medium text-primary mb-2 animate-in slide-in-from-left-4 duration-500 delay-700">
                            Subject: {message.subject}
                          </h4>
                        </div>
                        
                        <div className="bg-muted/50 rounded-lg p-4 animate-in slide-in-from-bottom-4 duration-500 delay-800">
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
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Copy Details
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            window.open(`mailto:${message.email}?subject=Re: ${message.subject}`, '_blank');
                          }}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Reply
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => openDeleteMessageDialog(message)}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
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
                        <SelectTrigger className="w-64">
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
                      className="transform hover:scale-105 transition-all duration-300"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
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

                {/* Analytics Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-200">
                  <div className="bg-card rounded-xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Tickets</p>
                        <p className="text-2xl font-bold text-primary">{ticketStats.totalTickets}</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-400">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Tickets Sold</p>
                        <p className="text-2xl font-bold text-green-500">{ticketStats.soldTickets}</p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-green-500" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Available Tickets</p>
                        <p className="text-2xl font-bold text-blue-500">{ticketStats.availableTickets}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 animate-in slide-in-from-left-4 duration-500 delay-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-orange-500">{ticketStats.revenue.toLocaleString()} TND</p>
                      </div>
                      <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-orange-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts and Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-400">
                  {/* Sales by Event Chart */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-left-4 duration-500 delay-500">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                      Ticket Sales by Type
                    </h3>
                    <div className="h-64 bg-muted/20 rounded-lg p-4">
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
                              <div key={i} className="border-b border-muted/20 h-0"></div>
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
                                  />
                                </g>
                              );
                            })}
                          </svg>
                          
                          {/* X-axis labels with better spacing */}
                          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-2">
                            {tickets.filter(t => t.event_id === selectedEventId).slice(0, 5).map((ticket, index) => {
                              return (
                                <span key={index} className="truncate max-w-[50px] text-center font-medium">
                                  {ticket.ticket_type}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Ambassadors Performance */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-right-4 duration-500 delay-600">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Users className="w-5 h-5 mr-2 text-primary" />
                      Top Performing Ambassadors
                    </h3>
                    <div className="space-y-3">
                      {ticketStats.topAmbassadors.map((ambassador, index) => (
                        <div key={ambassador.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg animate-in slide-in-from-right-4 duration-500 delay-700">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium">{ambassador.full_name}</p>
                              <p className="text-xs text-muted-foreground">{ambassador.city}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary">{ambassador.ticketsSold}</p>
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

                {/* Quick Actions & Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-800">
                  {/* Quick Actions */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-left-4 duration-500 delay-900">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Settings className="w-5 h-5 mr-2 text-primary" />
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 transition-all duration-300">
                        <Download className="w-5 h-5" />
                        <span className="text-xs">Export Report</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 transition-all duration-300">
                        <Mail className="w-5 h-5" />
                        <span className="text-xs">Send Notifications</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2 transform hover:scale-105 transition-all duration-300">
                        <BarChart3 className="w-5 h-5" />
                        <span className="text-xs">View Analytics</span>
                      </Button>
                    </div>
                  </div>

                  {/* Recent Ticket Sales */}
                  <div className="bg-card rounded-xl p-6 shadow-lg animate-in slide-in-from-right-4 duration-500 delay-1000">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-primary" />
                      Recent Ticket Sales
                    </h3>
                    <div className="space-y-3">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg animate-in slide-in-from-right-4 duration-500 delay-1100">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </div>
                            <div>
                              <p className="font-medium">VIP Ticket Sold</p>
                              <p className="text-xs text-muted-foreground">Event Name • 2 hours ago</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-500">$150</p>
                            <p className="text-xs text-muted-foreground">Revenue</p>
                          </div>
                        </div>
                      ))}
                    </div>
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
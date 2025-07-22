import { useState, useEffect } from "react";
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
  Instagram
} from "lucide-react";
import { useNavigate } from "react-router-dom";


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

  

  const [editingAmbassador, setEditingAmbassador] = useState<Ambassador | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [ambassadorSales, setAmbassadorSales] = useState<Record<string, { standard: number; vip: number }>>({});
  const [ambassadorToDelete, setAmbassadorToDelete] = useState<Ambassador | null>(null);

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
      approvedApplications: "Approved Applications",
      approvedAmbassadors: "Total Ambassadors",
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
      approvedApplications: "Candidatures Approuvées",
      approvedAmbassadors: "Ambassadeurs Totaux",
    }
  };

  const t = content[language];

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch applications
      console.log('Attempting to fetch ambassador applications...');
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
        console.log('Successfully fetched applications:', appsData);
        console.log('Number of applications:', appsData?.length || 0);
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
            password: password, // Optionally update password
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
            password: password,
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

      // Send approval email with credentials
      const emailConfig = createApprovalEmail(
        {
          fullName: application.full_name,
          phone: application.phone_number,
          email: application.email,
          city: application.city,
          password: password
        },
        `${window.location.origin}/ambassador/auth`
      );

      const emailSent = await sendEmail(emailConfig);

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
      console.error('Error saving event:', error);
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
    if (!confirm(language === 'en' ? "Are you sure you want to delete this event?" : "Êtes-vous sûr de vouloir supprimer cet événement?")) {
      return;
    }

    try {
      console.log('Attempting to delete event:', eventId);
      
      const { data, error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .select();

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      console.log('Delete response:', data);

      // Verify deletion by checking if the event still exists
      const { data: verifyData, error: verifyError } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
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
    }
  };

  const handleDeleteAmbassador = async (ambassadorId: string) => {
    // This will now be called only after confirmation
    try {
      const { error } = await supabase
        .from('ambassadors')
        .delete()
        .eq('id', ambassadorId);
      if (error) throw error;
      toast({
        title: language === 'en' ? "Ambassador deleted" : "Ambassadeur supprimé",
        description: language === 'en' ? "Ambassador deleted successfully" : "Ambassadeur supprimé avec succès",
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



  const handleLogout = () => {
    localStorage.removeItem('adminSession');
    navigate('/admin/login');
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

  if (loading) {
    return (
      <div className="pt-16 min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }


  
  return (
    <div className="pt-16 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-orbitron font-bold text-gradient-neon mb-2">
              {t.title}
            </h1>
            <p className="text-muted-foreground">
              {t.subtitle}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.logout}</span>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex overflow-x-auto whitespace-nowrap gap-x-2 px-1">
            <TabsTrigger className="px-4 min-w-[110px]" value="overview">{t.overview}</TabsTrigger>
            <TabsTrigger className="px-4 min-w-[110px]" value="events">{t.events}</TabsTrigger>
            <TabsTrigger className="px-4 min-w-[110px]" value="ambassadors">{t.ambassadors}</TabsTrigger>
            <TabsTrigger className="px-4 min-w-[110px]" value="applications">{t.applications}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-8 h-8 text-yellow-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.pendingApplications}</p>
                      <p className="text-2xl font-bold">{pendingApplications.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.approvedApplications}</p>
                      <p className="text-2xl font-bold">{approvedCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.totalEvents}</p>
                      <p className="text-2xl font-bold">{events.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Users className="w-8 h-8 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.approvedAmbassadors}</p>
                      <p className="text-2xl font-bold">{ambassadors.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Recent Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.slice(0, 5).map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{app.full_name}</p>
                        <p className="text-sm text-muted-foreground">{app.city} • {app.phone_number}</p>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  ))}
                  {applications.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">{t.noApplications}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Events Management</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    console.log('Add button clicked');
                    setEditingEvent({} as Event);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t.add}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEvent?.id ? 'Edit Event' : 'Add New Event'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="eventName">{t.eventName}</Label>
                        <Input
                          id="eventName"
                          value={editingEvent?.name || ''}
                          onChange={(e) => setEditingEvent(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="eventDate">{t.eventDate}</Label>
                        <Input
                          id="eventDate"
                          type="datetime-local"
                          value={editingEvent?.date ? editingEvent.date.slice(0, 16) : ''}
                          onChange={(e) => setEditingEvent(prev => ({ ...prev, date: e.target.value }))}
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
                    
                    {/* Event Type Selector */}
                    <div>
                      <Label htmlFor="eventType">{t.eventType}</Label>
                      <Select
                        value={editingEvent?.event_type || 'upcoming'}
                        onValueChange={(value: 'upcoming' | 'gallery') => 
                          setEditingEvent(prev => ({ ...prev, event_type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upcoming">{t.eventTypeUpcoming}</SelectItem>
                          <SelectItem value="gallery">{t.eventTypeGallery}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Gallery Upload Section - Only show for gallery events */}
                    {editingEvent?.event_type === 'gallery' && (
                      <div className="space-y-4">
                        <div>
                          <Label>{t.galleryImages}</Label>
                          <div className="mt-2 space-y-2">
                            {/* Existing Gallery Images */}
                            {editingEvent?.gallery_images && editingEvent.gallery_images.length > 0 && (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {editingEvent.gallery_images.map((url, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={url}
                                      alt={`Gallery image ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-lg"
                                    />
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => removeGalleryFile(index, 'images')}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Upload New Gallery Images */}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 0) {
                                    handleGalleryFileUpload(files);
                                  }
                                }}
                                className="hidden"
                                id="galleryImagesUpload"
                              />
                              <label
                                htmlFor="galleryImagesUpload"
                                className="cursor-pointer flex flex-col items-center space-y-2"
                              >
                                <Upload className="w-8 h-8 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {uploadingGallery ? 'Uploading...' : t.addGalleryFile}
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <Label>{t.galleryVideos}</Label>
                          <div className="mt-2 space-y-2">
                            {/* Existing Gallery Videos */}
                            {editingEvent?.gallery_videos && editingEvent.gallery_videos.length > 0 && (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {editingEvent.gallery_videos.map((url, index) => (
                                  <div key={index} className="relative group">
                                    <video
                                      src={url}
                                      className="w-full h-24 object-cover rounded-lg"
                                      controls
                                    />
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => removeGalleryFile(index, 'videos')}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Upload New Gallery Videos */}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                              <input
                                type="file"
                                multiple
                                accept="video/*"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 0) {
                                    // Handle video upload (similar to images)
                                    handleGalleryFileUpload(files);
                                  }
                                }}
                                className="hidden"
                                id="galleryVideosUpload"
                              />
                              <label
                                htmlFor="galleryVideosUpload"
                                className="cursor-pointer flex flex-col items-center space-y-2"
                              >
                                <Video className="w-8 h-8 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {uploadingGallery ? 'Uploading...' : t.addGalleryFile}
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <FileUpload
                        onFileSelect={(file) => {
                          // Store the file for upload when saving
                          setEditingEvent(prev => ({ ...prev, _uploadFile: file }));
                        }}
                        onUrlChange={(url) => setEditingEvent(prev => ({ ...prev, poster_url: url }))}
                        currentUrl={editingEvent?.poster_url}
                        label={t.eventPoster}
                        maxSize={10}
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
                          step="0.01"
                          min="0"
                          value={editingEvent?.standard_price || ''}
                          onChange={(e) => setEditingEvent(prev => ({ ...prev, standard_price: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="eventVipPrice">{t.eventVipPrice}</Label>
                        <Input
                          id="eventVipPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingEvent?.vip_price || ''}
                          onChange={(e) => setEditingEvent(prev => ({ ...prev, vip_price: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
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
                                         <div className="flex justify-end space-x-2">
                       <DialogClose asChild>
                         <Button variant="outline" onClick={() => setEditingEvent(null)}>
                           {t.cancel}
                         </Button>
                       </DialogClose>
                       <DialogClose asChild>
                         <Button 
                           onClick={() => {
                             console.log('Saving event:', editingEvent);
                             handleSaveEvent(editingEvent!, editingEvent?._uploadFile);
                           }}
                           disabled={uploadingImage || uploadingGallery}
                         >
                           {uploadingImage || uploadingGallery ? (
                             <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                           ) : (
                             <Save className="w-4 h-4 mr-2" />
                           )}
                           {uploadingImage || uploadingGallery ? 'Uploading...' : t.save}
                         </Button>
                       </DialogClose>
                     </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card key={event.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{event.name}</CardTitle>
                      <div className="flex space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                console.log('Editing event:', event);
                                setEditingEvent(event);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Event</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="editEventName">{t.eventName}</Label>
                                  <Input
                                    id="editEventName"
                                    value={editingEvent?.name || ''}
                                    onChange={(e) => setEditingEvent(prev => ({ ...prev, name: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="editEventDate">{t.eventDate}</Label>
                                  <Input
                                    id="editEventDate"
                                    type="datetime-local"
                                    value={editingEvent?.date ? editingEvent.date.slice(0, 16) : ''}
                                    onChange={(e) => setEditingEvent(prev => ({ ...prev, date: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="editEventVenue">{t.eventVenue}</Label>
                                  <Input
                                    id="editEventVenue"
                                    value={editingEvent?.venue || ''}
                                    onChange={(e) => setEditingEvent(prev => ({ ...prev, venue: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="editEventCity">{t.eventCity}</Label>
                                  <Input
                                    id="editEventCity"
                                    value={editingEvent?.city || ''}
                                    onChange={(e) => setEditingEvent(prev => ({ ...prev, city: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="editEventDescription">{t.eventDescription}</Label>
                                <Textarea
                                  id="editEventDescription"
                                  value={editingEvent?.description || ''}
                                  onChange={(e) => setEditingEvent(prev => ({ ...prev, description: e.target.value }))}
                                />
                              </div>
                              
                              {/* Event Type Selector */}
                              <div>
                                <Label htmlFor="editEventType">{t.eventType}</Label>
                                <Select
                                  value={editingEvent?.event_type || 'upcoming'}
                                  onValueChange={(value: 'upcoming' | 'gallery') => 
                                    setEditingEvent(prev => ({ ...prev, event_type: value }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="upcoming">{t.eventTypeUpcoming}</SelectItem>
                                    <SelectItem value="gallery">{t.eventTypeGallery}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Gallery Upload Section - Only show for gallery events */}
                              {editingEvent?.event_type === 'gallery' && (
                                <div className="space-y-4">
                                  <div>
                                    <Label>{t.galleryImages}</Label>
                                    <div className="mt-2 space-y-2">
                                      {/* Existing Gallery Images */}
                                      {editingEvent?.gallery_images && editingEvent.gallery_images.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                          {editingEvent.gallery_images.map((url, index) => (
                                            <div key={index} className="relative group">
                                              <img
                                                src={url}
                                                alt={`Gallery image ${index + 1}`}
                                                className="w-full h-24 object-cover rounded-lg"
                                              />
                                              <Button
                                                size="sm"
                                                variant="destructive"
                                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => removeGalleryFile(index, 'images')}
                                              >
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Upload New Gallery Images */}
                                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                        <input
                                          type="file"
                                          multiple
                                          accept="image/*"
                                          onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length > 0) {
                                              handleGalleryFileUpload(files);
                                            }
                                          }}
                                          className="hidden"
                                          id="editGalleryImagesUpload"
                                        />
                                        <label
                                          htmlFor="editGalleryImagesUpload"
                                          className="cursor-pointer flex flex-col items-center space-y-2"
                                        >
                                          <Upload className="w-8 h-8 text-gray-400" />
                                          <span className="text-sm text-gray-600">
                                            {uploadingGallery ? 'Uploading...' : t.addGalleryFile}
                                          </span>
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <Label>{t.galleryVideos}</Label>
                                    <div className="mt-2 space-y-2">
                                      {/* Existing Gallery Videos */}
                                      {editingEvent?.gallery_videos && editingEvent.gallery_videos.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                          {editingEvent.gallery_videos.map((url, index) => (
                                            <div key={index} className="relative group">
                                              <video
                                                src={url}
                                                className="w-full h-24 object-cover rounded-lg"
                                                controls
                                              />
                                              <Button
                                                size="sm"
                                                variant="destructive"
                                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => removeGalleryFile(index, 'videos')}
                                              >
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Upload New Gallery Videos */}
                                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                        <input
                                          type="file"
                                          multiple
                                          accept="video/*"
                                          onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length > 0) {
                                              handleGalleryFileUpload(files);
                                            }
                                          }}
                                          className="hidden"
                                          id="editGalleryVideosUpload"
                                        />
                                        <label
                                          htmlFor="editGalleryVideosUpload"
                                          className="cursor-pointer flex flex-col items-center space-y-2"
                                        >
                                          <Video className="w-8 h-8 text-gray-400" />
                                          <span className="text-sm text-gray-600">
                                            {uploadingGallery ? 'Uploading...' : t.addGalleryFile}
                                          </span>
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div>
                                <FileUpload
                                  onFileSelect={(file) => {
                                    setEditingEvent(prev => ({ ...prev, _uploadFile: file }));
                                  }}
                                  onUrlChange={(url) => setEditingEvent(prev => ({ ...prev, poster_url: url }))}
                                  currentUrl={editingEvent?.poster_url}
                                  label={t.eventPoster}
                                  maxSize={10}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="editEventTicketLink">{t.eventTicketLink}</Label>
                                  <Input
                                    id="editEventTicketLink"
                                    value={editingEvent?.ticket_link || ''}
                                    onChange={(e) => setEditingEvent(prev => ({ ...prev, ticket_link: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="editEventWhatsappLink">{t.eventWhatsappLink}</Label>
                                  <Input
                                    id="editEventWhatsappLink"
                                    value={editingEvent?.whatsapp_link || ''}
                                    onChange={(e) => setEditingEvent(prev => ({ ...prev, whatsapp_link: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="editEventStandardPrice">{t.eventStandardPrice}</Label>
                                  <Input
                                    id="editEventStandardPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editingEvent?.standard_price || ''}
                                    onChange={(e) => setEditingEvent(prev => ({ ...prev, standard_price: parseFloat(e.target.value) || 0 }))}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="editEventVipPrice">{t.eventVipPrice}</Label>
                                  <Input
                                    id="editEventVipPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editingEvent?.vip_price || ''}
                                    onChange={(e) => setEditingEvent(prev => ({ ...prev, vip_price: parseFloat(e.target.value) || 0 }))}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="editEventFeatured"
                                  checked={editingEvent?.featured || false}
                                  onChange={(e) => setEditingEvent(prev => ({ ...prev, featured: e.target.checked }))}
                                />
                                <Label htmlFor="editEventFeatured">{t.eventFeatured}</Label>
                              </div>
                              <div className="flex justify-end space-x-2">
                                <DialogClose asChild>
                                  <Button variant="outline" onClick={() => setEditingEvent(null)}>
                                    {t.cancel}
                                  </Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button 
                                    onClick={() => {
                                      console.log('Saving edited event:', editingEvent);
                                      handleSaveEvent(editingEvent!, editingEvent?._uploadFile);
                                    }}
                                    disabled={uploadingImage || uploadingGallery}
                                  >
                                    {uploadingImage || uploadingGallery ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    ) : (
                                      <Save className="w-4 h-4 mr-2" />
                                    )}
                                    {uploadingImage || uploadingGallery ? 'Uploading...' : t.save}
                                  </Button>
                                </DialogClose>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{new Date(event.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{event.venue}, {event.city}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {event.featured && (
                          <Badge className="bg-yellow-500">Featured</Badge>
                        )}
                        {event.event_type === 'gallery' && (
                          <Badge className="bg-purple-500">Gallery Event</Badge>
                        )}
                        {event.gallery_images && event.gallery_images.length > 0 && (
                          <Badge className="bg-blue-500">{event.gallery_images.length} Images</Badge>
                        )}
                        {event.gallery_videos && event.gallery_videos.length > 0 && (
                          <Badge className="bg-green-500">{event.gallery_videos.length} Videos</Badge>
                        )}
                      </div>
                      {(event.standard_price || event.vip_price) && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          {event.standard_price && (
                            <span>Standard: {event.standard_price} TND</span>
                          )}
                          {event.vip_price && (
                            <span>VIP: {event.vip_price} TND</span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {events.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <p className="text-muted-foreground">{t.noEvents}</p>
                </div>
              )}
            </div>
          </TabsContent>


            

          {/* Ambassadors Tab */}
          <TabsContent value="ambassadors" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Ambassadors Management</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingAmbassador({} as Ambassador)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t.add}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingAmbassador?.id ? 'Edit Ambassador' : 'Add New Ambassador'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ambassadorName">{t.ambassadorName}</Label>
                        <Input
                          id="ambassadorName"
                          value={editingAmbassador?.full_name || ''}
                          onChange={(e) => setEditingAmbassador(prev => ({ ...prev, full_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ambassadorPhone">{t.ambassadorPhone}</Label>
                        <Input
                          id="ambassadorPhone"
                          value={editingAmbassador?.phone || ''}
                          onChange={(e) => setEditingAmbassador(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ambassadorStatus">{t.ambassadorStatus}</Label>
                        <Select
                          value={editingAmbassador?.status || 'pending'}
                          onValueChange={(value) => setEditingAmbassador(prev => ({ ...prev, status: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{t.pending}</SelectItem>
                            <SelectItem value="approved">{t.approved}</SelectItem>
                            <SelectItem value="rejected">{t.rejected}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="ambassadorCommission">{t.ambassadorCommission}</Label>
                        <Input
                          id="ambassadorCommission"
                          type="number"
                          value={editingAmbassador?.commission_rate || 10}
                          onChange={(e) => setEditingAmbassador(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                    {!editingAmbassador?.id && (
                      <div>
                        <Label htmlFor="ambassadorPassword">{t.ambassadorPassword}</Label>
                        <div className="relative">
                          <Input
                            id="ambassadorPassword"
                            type={showPassword ? "text" : "password"}
                            value={editingAmbassador?.password || ''}
                            onChange={(e) => setEditingAmbassador(prev => ({ ...prev, password: e.target.value }))}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setEditingAmbassador(null)}>
                        {t.cancel}
                      </Button>
                      <Button onClick={() => handleSaveAmbassador(editingAmbassador!)}>
                        <Save className="w-4 h-4 mr-2" />
                        {t.save}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ambassadors.map((ambassador) => (
                <Card key={ambassador.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{ambassador.full_name}</CardTitle>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingAmbassador(ambassador)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAmbassadorToDelete(ambassador)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{ambassador.phone}</span>
                      </div>
                      {ambassador.email && (
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{ambassador.email}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{ambassador.city}</span>
                      </div>
                      {/* Ticket sales info */}
                      <div className="flex items-center space-x-4 text-sm text-purple-700 font-semibold">
                        <span>Standard: {ambassadorSales[ambassador.id]?.standard || 0}</span>
                        <span>|</span>
                        <span>VIP: {ambassadorSales[ambassador.id]?.vip || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        {getStatusBadge(ambassador.status)}
                        <Badge variant="outline">{ambassador.commission_rate}%</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {ambassadors.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <p className="text-muted-foreground">{t.noAmbassadors}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Ambassador Applications</h2>
            </div>

            <div className="space-y-4">
              {applications.map((application) => (
                <Card key={application.id}>
                  <CardContent className="p-6">
                    <div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-4">
                          <h3 className="text-lg font-semibold">{application.full_name}</h3>
                          {getStatusBadge(application.status)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4" />
                            <span>Age: {application.age}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4" />
                            <span>{application.phone_number}</span>
                          </div>
                          <div className="flex items-center space-x-2 break-all md:break-normal">
                            <Mail className="w-4 h-4" />
                            <span className="break-all md:truncate max-w-[140px] md:max-w-[180px]">{application.email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4" />
                            <span>{application.city}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(application.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {application.social_link && (
                          <div className="text-sm flex items-center gap-2">
                            <span className="font-medium">Instagram:</span>
                            <a href={application.social_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-pink-500 hover:underline">
                              <Instagram className="w-5 h-5 mr-1" />
                              <span className="sr-only">Instagram</span>
                            </a>
                          </div>
                        )}
                        {application.motivation && (
                          <div className="text-sm">
                            <span className="font-medium">Motivation:</span> {application.motivation}
                          </div>
                        )}
                      </div>
                      {application.status === 'pending' && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 sm:gap-0 mt-4">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(application)}
                            disabled={processingId === application.id}
                          >
                            {processingId === application.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            {t.approve}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(application)}
                            disabled={processingId === application.id}
                          >
                            {processingId === application.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            {t.reject}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {applications.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t.noApplications}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
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
    </div>
  );
};

export default AdminDashboard; 
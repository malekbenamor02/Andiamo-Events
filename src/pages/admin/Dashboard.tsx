import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import FileUpload from "@/components/ui/file-upload";
import { uploadImage, uploadHeroImage, deleteHeroImage } from "@/lib/upload";
import { uploadFavicon, deleteFavicon, fetchFaviconSettings, FaviconSettings } from "@/lib/favicon";
import { uploadOGImage, validateOGImage, getOGImageUrl, deleteOGImage } from "@/lib/og-image";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createApprovalEmail, createRejectionEmail, generatePassword, sendEmail, sendEmailWithDetails, createAdminCredentialsEmail } from "@/lib/email";
import { fetchSalesSettings, updateSalesSettings } from "@/lib/salesSettings";
import ExcelJS from "exceljs";
import {
  CheckCircle, XCircle, Clock, Users, TrendingUp, DollarSign, LogOut,
  Plus, Edit, Trash2, Calendar as CalendarIcon, MapPin, Phone, Mail, User, Settings,
  Eye, EyeOff, Save, X, Image, Video, Upload, Info,
  Instagram, BarChart3, FileText, Building2, Users2, MessageCircle,
  PieChart, Download, RefreshCw, Copy, Wrench, ArrowUp, ArrowDown, 
  Send, Megaphone, PhoneCall, CreditCard, AlertCircle, CheckCircle2, Activity, Database,
  Search, Filter, MoreVertical, ExternalLink, Ticket, TrendingDown, Percent, Target, Package, Pause,
  Zap, MailCheck, ArrowRight, Shield
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import bcrypt from 'bcryptjs';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from "@/lib/constants";
import { apiFetch, handleApiResponse } from "@/lib/api-client";
import { API_ROUTES, buildFullApiUrl } from "@/lib/api-routes";
import { sanitizeUrl } from "@/lib/url-validator";
import { useQueryClient } from "@tanstack/react-query";
import { useInvalidateEvents } from "@/hooks/useEvents";
import { useInvalidateSiteContent } from "@/hooks/useSiteContent";
import { logger } from "@/lib/logger";


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
  ville?: string; // Ville (neighborhood) - only for Sousse and Tunis
  social_link?: string;
  motivation?: string;
  status: string;
  created_at: string;
  reapply_delay_date?: string; // Date when rejected/removed applicants can reapply (30 days after rejection/removal)
  manually_added?: boolean; // Indicator for manually added ambassadors
}

interface EventPass {
  id?: string;
  name: string;
  price: number;
  description: string;
  is_primary: boolean;
}

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  city: string;
  description?: string;
  poster_url?: string;
  instagram_link?: string;
  ticket_link?: string;
  featured?: boolean;
  event_type?: 'upcoming' | 'gallery'; // New field to distinguish event types
  gallery_images?: string[]; // Array of gallery image URLs
  gallery_videos?: string[]; // Array of gallery video URLs
  passes?: EventPass[]; // Array of passes for this event - REQUIRED for publishing
  created_at: string;
  updated_at: string;
  _uploadFile?: File | null;
  _pendingGalleryImages?: File[]; // Temporary storage for pending gallery image files
  _pendingGalleryVideos?: File[]; // Temporary storage for pending gallery video files
}



interface Ambassador {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  city: string;
  ville?: string;
  status: string;
  commission_rate: number;
  password?: string;
  created_at: string;
  updated_at: string;
  age?: number; // Age from corresponding application
  social_link?: string; // Social link from corresponding application
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
  const queryClient = useQueryClient();
  const invalidateEvents = useInvalidateEvents();
  const invalidateSiteContent = useInvalidateSiteContent();
  const [applications, setApplications] = useState<AmbassadorApplication[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [passPurchases, setPassPurchases] = useState<PassPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [currentAdminName, setCurrentAdminName] = useState<string | null>(null);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(null);
  const [admins, setAdmins] = useState<Array<{id: string; name: string; email: string; phone?: string; role: string; is_active: boolean; created_at: string}>>([]);
  const [isAddAdminDialogOpen, setIsAddAdminDialogOpen] = useState(false);
  const [isEditAdminDialogOpen, setIsEditAdminDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<{id: string; name: string; email: string; phone?: string; role: string; is_active: boolean} | null>(null);
  const [newAdminData, setNewAdminData] = useState({ name: '', email: '', phone: '' });
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Add state for email recovery and status tracking
  const [emailFailedApplications, setEmailFailedApplications] = useState<Set<string>>(new Set());
  const [emailSentApplications, setEmailSentApplications] = useState<Set<string>>(new Set());
  const [emailStatus, setEmailStatus] = useState<Record<string, 'sent' | 'failed' | 'pending'>>({});
  const [ambassadorCredentials, setAmbassadorCredentials] = useState<Record<string, { username: string; password: string }>>({});

  const [editingAmbassador, setEditingAmbassador] = useState<Ambassador | null>(null);
  const [newAmbassadorForm, setNewAmbassadorForm] = useState({
    full_name: '',
    age: '',
    phone_number: '',
    email: '',
    city: '',
    ville: '',
    social_link: '',
    motivation: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [pendingGalleryImages, setPendingGalleryImages] = useState<File[]>([]);
  const [pendingGalleryVideos, setPendingGalleryVideos] = useState<File[]>([]);
  const [passValidationErrors, setPassValidationErrors] = useState<Record<number, {name?: string; price?: string; description?: string}>>({});
  const { toast } = useToast();
  const [ambassadorSales, setAmbassadorSales] = useState<Record<string, { standard: number; vip: number }>>({});
  const [ambassadorToDelete, setAmbassadorToDelete] = useState<Ambassador | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isAmbassadorDialogOpen, setIsAmbassadorDialogOpen] = useState(false);
  const [isAmbassadorInfoDialogOpen, setIsAmbassadorInfoDialogOpen] = useState(false);
  
  // Validation errors state for ambassador form
  const [ambassadorErrors, setAmbassadorErrors] = useState<{
    full_name?: string;
    email?: string;
    phone?: string;
    password?: string;
    city?: string;
    ville?: string;
  }>({});

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
  const [allowAmbassadorApplication, setAllowAmbassadorApplication] = useState(false);
  const [loadingMaintenanceSettings, setLoadingMaintenanceSettings] = useState(false);

  // Ambassador application settings state
  const [ambassadorApplicationEnabled, setAmbassadorApplicationEnabled] = useState(true);
  const [ambassadorApplicationMessage, setAmbassadorApplicationMessage] = useState("");
  const [loadingAmbassadorApplicationSettings, setLoadingAmbassadorApplicationSettings] = useState(false);

  // Hero images state
  interface HeroImage {
    type: 'image' | 'video';
    src: string;
    alt: string;
    path?: string;
    poster?: string; // Optional poster image for videos
    srcMobile?: string; // Optional mobile version for videos
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
  const [phoneSubscribers, setPhoneSubscribers] = useState<Array<{id: string; phone_number: string; subscribed_at: string; city?: string}>>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [importingFromApplications, setImportingFromApplications] = useState(false);
  
  // Broadcast mode (popup subscribers only)
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  
  // Targeted mode (ambassador applications)
  const [targetedMessage, setTargetedMessage] = useState("");
  const [targetedCity, setTargetedCity] = useState<string>('');
  const [targetedCount, setTargetedCount] = useState<number>(0);
  const [loadingTargetedCount, setLoadingTargetedCount] = useState(false);
  const [sendingTargeted, setSendingTargeted] = useState(false);
  // Test SMS state
  const [testMode, setTestMode] = useState<'specific' | 'broadcast' | 'targeted'>('specific');
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testSmsMessage, setTestSmsMessage] = useState("");
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const [testTargetedCity, setTestTargetedCity] = useState<string>('');
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkPhonesInput, setBulkPhonesInput] = useState("");
  const [addingBulkPhones, setAddingBulkPhones] = useState(false);
  const [smsBalance, setSmsBalance] = useState<any>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [smsLogs, setSmsLogs] = useState<Array<{id: string; phone_number: string; message: string; status: string; error_message?: string; sent_at?: string; created_at: string; api_response?: any}>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [siteLogs, setSiteLogs] = useState<Array<{id: string; log_type: string; category: string; message: string; details: any; user_type: string; created_at: string}>>([]);
  const [loadingSiteLogs, setLoadingSiteLogs] = useState(false);
  const [faviconSettings, setFaviconSettings] = useState<FaviconSettings>({});
  const [loadingFaviconSettings, setLoadingFaviconSettings] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState<{type: string; loading: boolean}>({type: '', loading: false});
  const [uploadingOGImage, setUploadingOGImage] = useState(false);
  const [currentOGImageUrl, setCurrentOGImageUrl] = useState<string | null>(null);

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
  const [applicationDateFrom, setApplicationDateFrom] = useState<Date | undefined>(undefined);
  const [applicationDateTo, setApplicationDateTo] = useState<Date | undefined>(undefined);
  const [applicationCityFilter, setApplicationCityFilter] = useState<string>('all');
  const [applicationVilleFilter, setApplicationVilleFilter] = useState<string>('all');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<string>('pending');
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

  // Ambassador Sales System state
  const [codOrders, setCodOrders] = useState<any[]>([]);
  const [manualOrders, setManualOrders] = useState<any[]>([]);
  const [codAmbassadorOrders, setCodAmbassadorOrders] = useState<any[]>([]);
  const [filteredCodOrders, setFilteredCodOrders] = useState<any[]>([]);
  const [orderFilters, setOrderFilters] = useState({
    status: '',
    phone: '',
    ambassador: '',
    city: '',
    ville: '',
  });
  const [allAmbassadorOrders, setAllAmbassadorOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOrderAmbassador, setSelectedOrderAmbassador] = useState<any>(null);
  const [emailDeliveryLogs, setEmailDeliveryLogs] = useState<any[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isMotivationDialogOpen, setIsMotivationDialogOpen] = useState(false);
  const [selectedMotivation, setSelectedMotivation] = useState<{application: AmbassadorApplication; motivation: string} | null>(null);
  const [orderLogs, setOrderLogs] = useState<any[]>([]);
  const [performanceReports, setPerformanceReports] = useState<any>(null);
  const [salesSystemTab, setSalesSystemTab] = useState('cod-ambassador-orders');
  
  // Admin skip confirmation and resend email state
  const [isSkipConfirmationDialogOpen, setIsSkipConfirmationDialogOpen] = useState(false);
  const [skippingOrderId, setSkippingOrderId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [skippingOrder, setSkippingOrder] = useState(false);
  const [resendingTicketEmail, setResendingTicketEmail] = useState(false);

  // Export COD Ambassador Orders to Excel
  const exportOrdersToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('COD Ambassador Orders');

      // Define columns with headers
      worksheet.columns = [
        { header: 'Order ID', key: 'id', width: 30 },
        { header: 'Pass Types', key: 'pass_types', width: 40 },
        { header: 'Client Name', key: 'user_name', width: 25 },
        { header: 'Phone', key: 'user_phone', width: 20 },
        { header: 'Email', key: 'user_email', width: 35 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'Ville (Neighborhood)', key: 'ville', width: 20 },
        { header: 'Total Price (TND)', key: 'total_price', width: 18 },
        { header: 'Ambassador Name', key: 'ambassador_name', width: 25 },
        { header: 'Ambassador ID', key: 'ambassador_id', width: 30 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Payment Method', key: 'payment_method', width: 20 },
        { header: 'Source', key: 'source', width: 20 },
        { header: 'Event ID', key: 'event_id', width: 30 },
        { header: 'Created Date', key: 'created_date', width: 15 },
        { header: 'Created Time', key: 'created_time', width: 15 },
        { header: 'Created At (Full)', key: 'created_at', width: 25 },
        { header: 'Updated At', key: 'updated_at', width: 25 },
        { header: 'Payment Reference', key: 'payment_reference', width: 30 },
        { header: 'Notes', key: 'notes', width: 40 },
        { header: 'Cancelled At', key: 'cancelled_at', width: 25 },
        { header: 'Cancellation Reason', key: 'cancellation_reason', width: 40 },
        { header: 'Accepted At', key: 'accepted_at', width: 25 },
        { header: 'Completed At', key: 'completed_at', width: 25 },
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE21836' }
      };
      worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Add data rows - export ALL orders from codAmbassadorOrders (not filtered)
      codAmbassadorOrders.forEach((order) => {
        // Format pass types
        const passes = order.passes || [];
        let passTypesStr = 'N/A';
        if (passes.length > 0) {
          passTypesStr = passes.map((p: any) => 
            `${p.pass_type || p.passName || 'Unknown'} ×${p.quantity || 1}`
          ).join(', ');
        } else if (order.pass_type) {
          passTypesStr = `${order.pass_type} ×${order.quantity || 1}`;
        }

        // Format dates
        const createdDate = order.created_at ? new Date(order.created_at) : null;
        const updatedDate = order.updated_at ? new Date(order.updated_at) : null;
        const cancelledDate = order.cancelled_at ? new Date(order.cancelled_at) : null;
        const acceptedDate = order.accepted_at ? new Date(order.accepted_at) : null;
        const completedDate = order.completed_at ? new Date(order.completed_at) : null;

        // Format status text
        const statusText = order.status === 'PENDING_CASH'
          ? (language === 'en' ? 'Pending Cash' : 'En Attente Espèces')
          : order.status === 'PAID'
          ? (language === 'en' ? 'Paid' : 'Payé')
          : order.status === 'CANCELLED'
          ? (language === 'en' ? 'Cancelled' : 'Annulé')
          : order.status === 'PENDING_ADMIN_APPROVAL'
          ? (language === 'en' ? 'Pending Approval' : 'En Attente')
          : order.status === 'APPROVED'
          ? (language === 'en' ? 'Approved' : 'Approuvé')
          : order.status === 'REJECTED'
          ? (language === 'en' ? 'Rejected' : 'Rejeté')
          : order.status || 'N/A';

        const row = worksheet.addRow({
          id: order.id || 'N/A',
          pass_types: passTypesStr,
          user_name: order.user_name || 'N/A',
          user_phone: order.user_phone || 'N/A',
          user_email: order.user_email || 'N/A',
          city: order.city || 'N/A',
          ville: order.ville || 'N/A',
          total_price: order.total_price ? parseFloat(order.total_price).toFixed(2) : 'N/A',
          ambassador_name: order.ambassador_name || 'N/A',
          ambassador_id: order.ambassador_id || 'N/A',
          status: statusText,
          payment_method: order.payment_method || 'N/A',
          source: order.source || 'N/A',
          event_id: order.event_id || 'N/A',
          created_date: createdDate ? createdDate.toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR') : 'N/A',
          created_time: createdDate ? createdDate.toLocaleTimeString(language === 'en' ? 'en-US' : 'fr-FR') : 'N/A',
          created_at: createdDate ? createdDate.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR') : 'N/A',
          updated_at: updatedDate ? updatedDate.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR') : 'N/A',
          payment_reference: order.payment_reference || 'N/A',
          notes: order.notes || 'N/A',
          cancelled_at: cancelledDate ? cancelledDate.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR') : 'N/A',
          cancellation_reason: order.cancellation_reason || order.rejection_reason || 'N/A',
          accepted_at: acceptedDate ? acceptedDate.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR') : 'N/A',
          completed_at: completedDate ? completedDate.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR') : 'N/A',
        });

        // Style data rows
        row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        row.height = 20;
      });

      // Format price column as number
      worksheet.getColumn('total_price').numFmt = '0.00';

      // Auto-fit columns (approximate)
      worksheet.columns.forEach((column) => {
        if (column.width) {
          column.width = Math.min(column.width || 15, 50);
        }
      });

      // Generate filename with date and time
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const filename = `COD_Ambassador_Orders_${dateStr}_${timeStr}.xlsx`;

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: language === 'en' ? 'Export Successful' : 'Export Réussi',
        description: language === 'en' 
          ? `${codAmbassadorOrders.length} orders exported to ${filename}`
          : `${codAmbassadorOrders.length} commandes exportées vers ${filename}`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error exporting orders:', error);
      toast({
        title: language === 'en' ? 'Export Failed' : 'Échec de l\'Export',
        description: language === 'en' 
          ? 'Failed to export orders. Please try again.'
          : 'Échec de l\'exportation des commandes. Veuillez réessayer.',
        variant: 'destructive',
      });
    }
  };

  // Get unique filter values from orders
  const filterOptions = useMemo(() => {
    const ambassadors = new Set<string>();

    codAmbassadorOrders.forEach(order => {
      if (order.ambassador_name) {
        ambassadors.add(order.ambassador_name);
      }
    });

    // Get all villes based on selected city (like ambassador application)
    const getAllVilles = (city: string) => {
      if (city === 'Sousse') {
        return SOUSSE_VILLES;
      } else if (city === 'Tunis') {
        return TUNIS_VILLES;
      }
      return [];
    };

    return {
      ambassadors: Array.from(ambassadors).sort(),
      cities: CITIES,
      getAllVilles,
    };
  }, [codAmbassadorOrders]);

  // Filter COD orders based on filter criteria
  useEffect(() => {
    let filtered = [...codAmbassadorOrders];

    if (orderFilters.status) {
      filtered = filtered.filter(order => order.status === orderFilters.status);
    }

    if (orderFilters.phone) {
      filtered = filtered.filter(order => 
        order.user_phone?.toLowerCase().includes(orderFilters.phone.toLowerCase())
      );
    }

    if (orderFilters.ambassador) {
      filtered = filtered.filter(order => 
        order.ambassador_name === orderFilters.ambassador
      );
    }


    setFilteredCodOrders(filtered);
  }, [codAmbassadorOrders, orderFilters]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

  // Online Orders state
  const [onlineOrders, setOnlineOrders] = useState<any[]>([]);
  const [selectedOnlineOrder, setSelectedOnlineOrder] = useState<any>(null);
  const [isOnlineOrderDetailsOpen, setIsOnlineOrderDetailsOpen] = useState(false);
  const [loadingOnlineOrders, setLoadingOnlineOrders] = useState(false);
  const [onlineOrderFilters, setOnlineOrderFilters] = useState({
    status: 'all',
    city: 'all',
    passType: 'all',
    orderId: '',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  });

  // COD Orders filters
  const [codOrderFilters, setCodOrderFilters] = useState({
    status: 'all',
    city: 'all',
    ville: 'all',
    passType: 'all',
    ambassador: 'all',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  });

  // All Orders filters
  const [allOrderFilters, setAllOrderFilters] = useState({
    status: 'all',
    city: 'all',
    ville: 'all',
    passType: 'all',
    source: 'all',
    ambassador: 'all',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  });

  // Manual Orders filters
  const [manualOrderFilters, setManualOrderFilters] = useState({
    status: 'all',
    city: 'all',
    ville: 'all',
    passType: 'all',
    ambassador: 'all',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  });

  // Session expiration timestamp (milliseconds) - from server JWT token only
  // STRICT: Token expiration is fixed at login and NEVER resets or extends
  // The JWT contains an immutable 'exp' field that cannot be changed
  // No localStorage - session is managed entirely by server JWT token
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  
  // Session time left in seconds - calculated from expiration timestamp
  // STRICT: Timer is based on JWT 'exp' field - never resets, never extends
  const calculateTimeLeft = (expiration: number | null): number => {
    if (!expiration) return 0; // No expiration = no session
    const remaining = Math.max(0, Math.floor((expiration - Date.now()) / 1000));
    return remaining;
  };
  
  // Initialize session timer - will be set from server response
  // STRICT: No default value - must come from server token
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(0);


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
      eventInstagramLink: "Instagram Link",
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
      allowAmbassadorApplication: "Allow Ambassador Application Page",
      allowAmbassadorApplicationDescription: "When enabled, the ambassador application page will remain accessible during maintenance mode.",
      ambassadorApplicationSettings: "Ambassador Application Settings",
      ambassadorApplicationSettingsDescription: "Control whether users can submit ambassador applications. When disabled, users will see a message that applications are closed.",
      ambassadorApplicationEnabled: "Applications are currently open",
      ambassadorApplicationDisabled: "Applications are currently closed",
      enableAmbassadorApplication: "Enable Applications",
      disableAmbassadorApplication: "Disable Applications",
      ambassadorApplicationMessage: "Application Closed Message",
      ambassadorApplicationMessagePlaceholder: "Enter a custom message for when applications are closed (optional)",
      heroImagesSettings: "Hero Images & Videos",
      heroImagesSettingsDescription: "Manage hero images and videos displayed on the home page. You can add, delete, and reorder media files.",
      uploadHeroImage: "Upload Hero Image or Video",
      deleteHeroImage: "Delete",
      noHeroImages: "No hero media yet. Upload an image or video to get started.",
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
      eventInstagramLink: "Lien Instagram",
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
      allowAmbassadorApplication: "Autoriser la Page de Candidature d'Ambassadeur",
      allowAmbassadorApplicationDescription: "Lorsqu'elle est activée, la page de candidature d'ambassadeur restera accessible pendant le mode maintenance.",
      ambassadorApplicationSettings: "Paramètres de Candidature d'Ambassadeur",
      ambassadorApplicationSettingsDescription: "Contrôlez si les utilisateurs peuvent soumettre des candidatures d'ambassadeur. Lorsqu'elle est désactivée, les utilisateurs verront un message indiquant que les candidatures sont fermées.",
      ambassadorApplicationEnabled: "Les candidatures sont actuellement ouvertes",
      ambassadorApplicationDisabled: "Les candidatures sont actuellement fermées",
      enableAmbassadorApplication: "Ouvrir les Candidatures",
      disableAmbassadorApplication: "Fermer les Candidatures",
      ambassadorApplicationMessage: "Message de Candidature Fermée",
      ambassadorApplicationMessagePlaceholder: "Entrez un message personnalisé lorsque les candidatures sont fermées (optionnel)",
      heroImagesSettings: "Images et Vidéos Hero",
      heroImagesSettingsDescription: "Gérez les images et vidéos hero affichées sur la page d'accueil. Vous pouvez ajouter, supprimer et réorganiser les fichiers multimédias.",
      uploadHeroImage: "Télécharger une Image ou Vidéo Hero",
      deleteHeroImage: "Supprimer",
      noHeroImages: "Aucun média hero pour le moment. Téléchargez une image ou une vidéo pour commencer.",
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

  // Create a map of ambassadors by phone/email for faster lookup
  const ambassadorMap = useMemo(() => {
    const map = new Map<string, { ville?: string }>();
    ambassadors.forEach(amb => {
      if (amb.phone) map.set(`phone:${amb.phone}`, { ville: amb.ville });
      if (amb.email) map.set(`email:${amb.email}`, { ville: amb.ville });
    });
    return map;
  }, [ambassadors]);

  // Filter applications based on search term, city, ville, status, and date range
  // Show all applications (pending, approved, rejected, removed) - full history
  // Memoized for performance
  const filteredApplications = useMemo(() => {
    if (!applications.length) return [];

    const searchLower = applicationSearchTerm.toLowerCase().trim();
    const hasSearch = searchLower.length > 0;
    
    // Pre-compute date ranges if needed
    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    
    if (applicationDateFrom) {
      fromDate = new Date(applicationDateFrom);
      fromDate.setHours(0, 0, 0, 0);
    }
    
    if (applicationDateTo) {
      toDate = new Date(applicationDateTo);
      toDate.setHours(23, 59, 59, 999);
    }

    return applications.filter(application => {
      // Status filter - normalize status comparison
      if (applicationStatusFilter !== 'all') {
        const appStatus = (application.status || '').toLowerCase().trim();
        const filterStatus = applicationStatusFilter.toLowerCase().trim();
        if (appStatus !== filterStatus) {
          return false;
        }
      }

      // City filter
      if (applicationCityFilter !== 'all' && application.city !== applicationCityFilter) {
        return false;
      }

      // Ville filter - optimized with map lookup
      if (applicationVilleFilter !== 'all') {
        let applicationVille = application.ville;
        
        // If no ville in application, try to get it from matching ambassador using map
        if (!applicationVille && (application.city === 'Sousse' || application.city === 'Tunis')) {
          const phoneKey = `phone:${application.phone_number}`;
          const emailKey = application.email ? `email:${application.email}` : null;
          
          const phoneMatch = ambassadorMap.get(phoneKey);
          const emailMatch = emailKey ? ambassadorMap.get(emailKey) : null;
          
          applicationVille = phoneMatch?.ville || emailMatch?.ville;
        }
        
        if (applicationVille !== applicationVilleFilter) {
          return false;
        }
      }

      // Date range filtering
      if (fromDate || toDate) {
        const applicationDate = new Date(application.created_at);
        applicationDate.setHours(0, 0, 0, 0);
        
        if (fromDate && applicationDate < fromDate) return false;
        if (toDate && applicationDate > toDate) return false;
      }

      // Search filter - only check if there's a search term
      if (hasSearch) {
        const matchesSearch = (
          application.full_name.toLowerCase().includes(searchLower) ||
          (application.email && application.email.toLowerCase().includes(searchLower)) ||
          application.phone_number.includes(searchLower)
        );
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [
    applications,
    applicationStatusFilter,
    applicationCityFilter,
    applicationVilleFilter,
    applicationSearchTerm,
    applicationDateFrom,
    applicationDateTo,
    ambassadorMap
  ]);

  // Animation effect for applications
  useEffect(() => {
    // Reset animation when filters change
    setHasApplicationsAnimated(false);
    setAnimatedApplications(new Set());
    
    if (activeTab === "applications") {
      const timer = setTimeout(() => {
        setHasApplicationsAnimated(true);
        // Animate applications one by one (limit to first 50 for performance)
        const appsToAnimate = filteredApplications.slice(0, 50);
        appsToAnimate.forEach((application, index) => {
          setTimeout(() => {
            setAnimatedApplications(prev => new Set([...prev, application.id]));
          }, index * 50); // Reduced delay for faster animation
        });
      }, 100); // Reduced initial delay
      return () => clearTimeout(timer);
    }
  }, [activeTab, filteredApplications.length, applicationStatusFilter, applicationCityFilter, applicationVilleFilter, applicationSearchTerm, filteredApplications]);

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
    if (activeTab === "marketing") {
      // Load marketing/SMS data only when Marketing tab is opened
      if (phoneSubscribers.length === 0) {
        fetchPhoneSubscribers();
      }
      if (smsLogs.length === 0) {
        fetchSmsLogs();
      }
    }

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
  const fetchSalesSettingsData = async () => {
    try {
      const settings = await fetchSalesSettings();
      setSalesEnabled(settings.enabled);
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
        const settings = data.content as { enabled?: boolean; message?: string; allowAmbassadorApplication?: boolean };
        setMaintenanceEnabled(settings.enabled === true);
        setMaintenanceMessage(settings.message || "");
        setAllowAmbassadorApplication(settings.allowAmbassadorApplication === true);
      } else {
        // Default to disabled if no setting exists
        setMaintenanceEnabled(false);
        setMaintenanceMessage("");
        setAllowAmbassadorApplication(false);
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
          content: updatedContent as any,
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

  // Handle hero image/video upload
  const handleUploadHeroImage = async (file: File) => {
    try {
      setUploadingHeroImage(true);
      
      // Detect if file is a video (check both MIME type and file extension)
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const isVideo = file.type.startsWith('video/') || 
                      fileExtension === 'mp4' || 
                      fileExtension === 'mov' || 
                      fileExtension === 'webm';
      const fileType = isVideo ? 'video' : 'image';
      
      // Validate video file size (recommend under 2MB for fast loading)
      if (isVideo && file.size > 2 * 1024 * 1024) {
        toast({
          title: language === 'en' ? 'Large File Warning' : 'Avertissement Fichier Volumineux',
          description: language === 'en' 
            ? 'Video file is larger than 2MB. For best performance, videos should be under 2MB (5-10 seconds, H.264).' 
            : 'Le fichier vidéo est supérieur à 2MB. Pour de meilleures performances, les vidéos doivent faire moins de 2MB (5-10 secondes, H.264).',
          variant: 'default',
          duration: 5000,
        });
      }
      
      // Upload to hero-images bucket
      const uploadResult = await uploadHeroImage(file);
      
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      // Create new hero image/video object
      const newItem: HeroImage = {
        type: fileType,
        src: uploadResult.url,
        alt: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for alt text
        path: uploadResult.path
      };

      // Add to hero images array
      const updatedImages = [...heroImages, newItem];
      await saveHeroImages(updatedImages);
      
      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' 
          ? `${fileType === 'video' ? 'Video' : 'Image'} uploaded successfully` 
          : `${fileType === 'video' ? 'Vidéo' : 'Image'} téléchargée avec succès`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error uploading hero media:', error);
      toast({
        title: t.error,
        description: language === 'en' 
          ? 'Failed to upload hero media' 
          : 'Échec du téléchargement du média hero',
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

  // Fetch Ambassador Sales System data
  const fetchAmbassadorSalesData = async () => {
    setLoadingOrders(true);
    try {
      // First, fetch all ambassadors to create name mapping
      const { data: allAmbassadorsData, error: ambassadorsError } = await (supabase as any)
        .from('ambassadors')
        .select('id, full_name, ville, status, city')
        .eq('status', 'approved');
      
      if (ambassadorsError) throw ambassadorsError;
      
      // Create ambassador name mapping
      const ambassadorNameMap = new Map<string, string>();
      (allAmbassadorsData || []).forEach((amb: any) => {
        ambassadorNameMap.set(amb.id, amb.full_name);
      });

      // Note: COD orders are now all ambassador_manual source (platform_cod is deprecated)
      // Fetch manual orders (includes all COD orders created by ambassadors)
      const { data: manualData, error: manualError } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('source', 'ambassador_manual')
        .order('created_at', { ascending: false });

      if (manualError) throw manualError;

      // Fetch COD ambassador orders - unified system uses payment_method = 'ambassador_cash'
      // Include order_passes for multiple pass types support
      const { data: codAmbassadorData, error: codAmbassadorError } = await (supabase as any)
        .from('orders')
        .select('*, order_passes (*)')
        .eq('payment_method', 'ambassador_cash')
        .in('source', ['platform_cod', 'ambassador_manual'])
        .order('created_at', { ascending: false });

      if (codAmbassadorError) throw codAmbassadorError;

      // Enrich COD ambassador orders with pass info from order_passes
      const enrichedCodAmbassadorOrders = (codAmbassadorData || []).map((order: any) => {
        // Parse notes for legacy orders
        let notesData = null;
        if (order.notes) {
          try {
            notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
          } catch (e) {
            console.error('Error parsing order notes:', e);
          }
        }

        // Get passes from order_passes (new system) or notes (legacy)
        let passes = [];
        if (order.order_passes && order.order_passes.length > 0) {
          // New system: use order_passes
          passes = order.order_passes.map((op: any) => ({
            pass_type: op.pass_type,
            quantity: op.quantity,
            price: op.price
          }));
        } else if (notesData?.all_passes) {
          // Legacy system: use notes
          passes = notesData.all_passes.map((p: any) => ({
            pass_type: p.passName || p.pass_type,
            quantity: p.quantity,
            price: p.price
          }));
        } else if (order.pass_type) {
          // Very old system: single pass_type
          passes = [{
            pass_type: order.pass_type,
            quantity: order.quantity || 1,
            price: order.total_price / (order.quantity || 1)
          }];
        }

        return {
          ...order,
          ambassador_name: order.ambassador_id ? (ambassadorNameMap.get(order.ambassador_id) || 'Unknown') : null,
          ambassador_id: order.ambassador_id,
          passes: passes
        };
      });
      setCodAmbassadorOrders(enrichedCodAmbassadorOrders);

      // Fetch all ambassador orders (all COD orders are now ambassador_manual)
      const { data: allData, error: allError } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('source', 'ambassador_manual')
        .order('created_at', { ascending: false });

      if (allError) throw allError;

      // Legacy: Keep codOrders state for backward compatibility (empty array since platform_cod is deprecated)
      // All COD orders are now in codAmbassadorOrders (ambassador_manual + payment_method = cod)
      setCodOrders([]);
      
      const enrichedManualOrders = (manualData || []).map((order: any) => ({
        ...order,
        ambassador_name: order.ambassador_id ? (ambassadorNameMap.get(order.ambassador_id) || 'Unknown') : null
      }));
      setManualOrders(enrichedManualOrders);
      
      const enrichedAllOrders = (allData || []).map((order: any) => ({
        ...order,
        ambassador_name: order.ambassador_id ? (ambassadorNameMap.get(order.ambassador_id) || 'Unknown') : null
      }));
      setAllAmbassadorOrders(enrichedAllOrders);

      // Fetch order logs
      const { data: logsData, error: logsError } = await (supabase as any)
        .from('order_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setOrderLogs(logsData || []);


      // Calculate performance reports
      await fetchPerformanceReports();
    } catch (error: any) {
      // Only log to console if it's not a network error (to avoid duplicate logs)
      if (error?.message && !error.message.includes('Failed to fetch') && !error.message.includes('NetworkError')) {
        console.error('Error fetching ambassador sales data:', error);
      }
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' ? 'Failed to fetch sales data' : 'Échec de la récupération des données de vente',
        variant: 'destructive'
      });
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch online orders
  const fetchOnlineOrders = async () => {
    setLoadingOnlineOrders(true);
    try {
      let query = (supabase as any)
        .from('orders')
        .select('*')
        .eq('source', 'platform_online')
        .order('created_at', { ascending: false });

      // Apply filters
      if (onlineOrderFilters.status !== 'all') {
        query = query.eq('payment_status', onlineOrderFilters.status);
      }
      if (onlineOrderFilters.city !== 'all') {
        query = query.eq('city', onlineOrderFilters.city);
      }
      if (onlineOrderFilters.passType !== 'all') {
        query = query.eq('pass_type', onlineOrderFilters.passType);
      }
      if (onlineOrderFilters.dateFrom) {
        query = query.gte('created_at', onlineOrderFilters.dateFrom.toISOString());
      }
      if (onlineOrderFilters.dateTo) {
        const dateTo = new Date(onlineOrderFilters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        query = query.lte('created_at', dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Apply client-side filtering for order ID (UUID doesn't support ilike directly)
      let filteredData = data || [];
      if (onlineOrderFilters.orderId && onlineOrderFilters.orderId.trim() !== '') {
        const orderIdSearch = onlineOrderFilters.orderId.trim().toUpperCase();
        filteredData = filteredData.filter((order: any) => 
          order.id && order.id.toUpperCase().includes(orderIdSearch)
        );
      }
      
      setOnlineOrders(filteredData);
    } catch (error: any) {
      console.error('Error fetching online orders:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to fetch online orders' : 'Échec du chargement des commandes en ligne'),
        variant: "destructive",
      });
    } finally {
      setLoadingOnlineOrders(false);
    }
  };

  const fetchOnlineOrdersWithFilters = async (filters: typeof onlineOrderFilters) => {
    setLoadingOnlineOrders(true);
    try {
      let query = (supabase as any)
        .from('orders')
        .select('*')
        .eq('source', 'platform_online')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('payment_status', filters.status);
      }
      if (filters.city !== 'all') {
        query = query.eq('city', filters.city);
      }
      if (filters.passType !== 'all') {
        query = query.eq('pass_type', filters.passType);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        query = query.lte('created_at', dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Apply client-side filtering for order ID (UUID doesn't support ilike directly)
      let filteredData = data || [];
      if (filters.orderId && filters.orderId.trim() !== '') {
        const orderIdSearch = filters.orderId.trim().toUpperCase();
        filteredData = filteredData.filter((order: any) => 
          order.id && order.id.toUpperCase().includes(orderIdSearch)
        );
      }
      
      setOnlineOrders(filteredData);
    } catch (error: any) {
      console.error('Error fetching online orders:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to fetch online orders' : 'Échec du chargement des commandes en ligne'),
        variant: "destructive",
      });
    } finally {
      setLoadingOnlineOrders(false);
    }
  };

  // Admin order management functions
  // Approve Email/SMS delivery for PAID orders
  const handleApproveEmailSmsDelivery = async (orderId: string) => {
    try {
      // Get full order details
      const { data: order, error: fetchError } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Validate order is PAID
      if (order.status !== 'PAID') {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'Only PAID orders can have email/SMS delivery approved'
            : 'Seules les commandes PAYÉES peuvent avoir la livraison email/SMS approuvée',
          variant: 'destructive'
        });
        return;
      }

      // Generate tickets and send email with QR codes
      if (order.user_email) {
        try {
          
          // Small delay to ensure database is ready
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Generate tickets (this will also send the email with QR codes)
          const apiBase = sanitizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8082');
          const ticketApiUrl = buildFullApiUrl(API_ROUTES.GENERATE_TICKETS_FOR_ORDER, apiBase);
          
          if (!ticketApiUrl) {
            throw new Error('Invalid API URL configuration');
          }
          
          const ticketResponse = await fetch(ticketApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId }),
          });

          const responseData = await ticketResponse.json();

          if (!ticketResponse.ok) {
            console.error('❌ Failed to generate tickets. Status:', ticketResponse.status);
            console.error('❌ Error details:', responseData);
            
            // Fallback to old email system if ticket generation fails
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8082';
            const emailResponse = await fetch(`${apiUrl}/api/send-order-completion-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ orderId }),
            });

            if (!emailResponse.ok) {
              const emailErrorData = await emailResponse.json();
              console.error('❌ Failed to send completion email:', emailErrorData);
              throw new Error('Failed to send email');
            } else {
            }
          } else {
          }
        } catch (error) {
          console.error('❌ Error generating tickets or sending email:', error);
          throw error;
        }
      }

      // Update order status to APPROVED (email/SMS sent)
      const { error: updateError } = await (supabase as any)
        .from('orders')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Log the action
      await (supabase as any)
        .from('order_logs')
        .insert({
          order_id: orderId,
          action: 'status_changed',
          performed_by: null,
          performed_by_type: 'admin',
          details: { 
            old_status: 'PAID',
            new_status: 'APPROVED',
            action: 'email_sms_delivery_approved',
            email_sent: true
          }
        });

      toast({
        title: language === 'en' ? 'Email/SMS Sent' : 'Email/SMS Envoyé',
        description: language === 'en' 
          ? 'Tickets generated and email sent to customer successfully'
          : 'Tickets générés et email envoyé au client avec succès',
        variant: 'default'
      });

      fetchAmbassadorSalesData();
    } catch (error: any) {
      console.error('Error approving email/SMS delivery:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' 
          ? 'Failed to approve email/SMS delivery' 
          : 'Échec de l\'approbation de la livraison email/SMS'),
        variant: 'destructive'
      });
    }
  };

  // Approve COD Ambassador order (with email and SMS) - LEGACY FUNCTION
  const handleApproveCodAmbassadorOrder = async (orderId: string) => {
    console.log('\n🔵 ============================================');
    console.log('🔵 FRONTEND: Admin Approval Started');
    console.log('🔵 ============================================');
    console.log('🔵 Order ID:', orderId);
    console.log('🔵 Timestamp:', new Date().toISOString());
    
    try {
      // Get full order details
      console.log('🔵 Fetching order details...');
      const { data: order, error: fetchError } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) {
        console.error('❌ FRONTEND: Error fetching order:', fetchError);
        throw fetchError;
      }

      console.log('🔵 Order fetched:', {
        id: order.id,
        status: order.status,
        payment_method: order.payment_method,
        source: order.source,
        hasUserEmail: !!order.user_email,
        hasUserPhone: !!order.user_phone,
        userEmail: order.user_email || 'NOT SET',
        userPhone: order.user_phone ? `${order.user_phone.substring(0, 3)}***` : 'NOT SET'
      });

      // Validate order - accept any COD order with PENDING_ADMIN_APPROVAL status
      if (order.payment_method !== 'ambassador_cash') {
        console.error('❌ FRONTEND: Invalid payment method:', order.payment_method);
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? `This order is not a COD order. Payment method: ${order.payment_method || 'N/A'}`
            : `Cette commande n'est pas une commande COD. Méthode de paiement: ${order.payment_method || 'N/A'}`,
          variant: 'destructive'
        });
        return;
      }
      
      if (order.status !== 'PENDING_ADMIN_APPROVAL') {
        console.error('❌ FRONTEND: Invalid order status:', order.status);
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? `Order status must be PENDING_ADMIN_APPROVAL to approve. Current status: ${order.status || 'N/A'}`
            : `Le statut de la commande doit être PENDING_ADMIN_APPROVAL pour approuver. Statut actuel: ${order.status || 'N/A'}`,
          variant: 'destructive'
        });
        return;
      }

      // Update order status to PAID (this will trigger ticket generation)
      console.log('🔵 Updating order status to PAID...');
      const { error: updateError } = await (supabase as any)
        .from('orders')
        .update({
          status: 'PAID',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ FRONTEND: Error updating order status:', updateError);
        throw updateError;
      }
      console.log('✅ FRONTEND: Order status updated to PAID');

      // Generate tickets and send email with QR codes (only after admin approval)
      let ticketsGenerated = false;
      console.log('🔵 Checking if order has email for ticket generation...');
      console.log('🔵 Email check:', {
        hasUserEmail: !!order.user_email,
        userEmail: order.user_email || 'NOT SET'
      });
      
      if (order.user_email) {
        try {
          console.log('🔵 Order has email, proceeding with ticket generation...');
          
          // Small delay to ensure database is ready
          console.log('🔵 Waiting 500ms for database to be ready...');
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Generate tickets (this will also send the email with QR codes)
          const apiBase = sanitizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8082');
          const ticketApiUrl = buildFullApiUrl(API_ROUTES.GENERATE_TICKETS_FOR_ORDER, apiBase);
          
          console.log('🔵 API Configuration:', {
            apiBase: apiBase,
            ticketApiUrl: ticketApiUrl,
            route: API_ROUTES.GENERATE_TICKETS_FOR_ORDER
          });
          
          if (ticketApiUrl) {
            console.log('🔵 Calling ticket generation API...');
            console.log('🔵 Request:', {
              url: ticketApiUrl,
              method: 'POST',
              body: { orderId }
            });
            
            const ticketResponse = await fetch(ticketApiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ orderId }),
            });

            console.log('🔵 API Response Status:', ticketResponse.status);
            const responseData = await ticketResponse.json();
            console.log('🔵 API Response Data:', responseData);

            if (ticketResponse.ok && responseData.success) {
              ticketsGenerated = true;
              console.log('✅ FRONTEND: Tickets generated successfully:', {
                ticketsCount: responseData.ticketsCount,
                emailSent: responseData.emailSent,
                emailError: responseData.emailError,
                smsSent: responseData.smsSent,
                smsError: responseData.smsError
              });
            } else {
              console.error('❌ FRONTEND: Failed to generate tickets. Status:', ticketResponse.status);
              console.error('❌ FRONTEND: Error details:', responseData);
            }
          } else {
            console.error('❌ FRONTEND: Invalid ticket API URL');
          }
        } catch (ticketError) {
          console.error('❌ FRONTEND: Error generating tickets:', ticketError);
          console.error('❌ FRONTEND: Error details:', {
            message: ticketError.message,
            stack: ticketError.stack
          });
        }
      } else {
        console.warn('⚠️ FRONTEND: Order does not have email, skipping ticket generation');
        console.warn('⚠️ FRONTEND: Order details:', {
          orderId: order.id,
          hasUserEmail: false,
          hasUserPhone: !!order.user_phone
        });
      }

      // Log the approval
      console.log('🔵 Logging approval to order_logs...');
      await (supabase as any)
        .from('order_logs')
        .insert({
          order_id: orderId,
          action: 'approved',
          performed_by: null,
          performed_by_type: 'admin',
          details: { 
            old_status: 'PENDING_ADMIN_APPROVAL',
            new_status: 'PAID',
            tickets_generated: ticketsGenerated,
            admin_action: true 
          }
        });
      console.log('✅ FRONTEND: Approval logged');

      console.log('🔵 ============================================');
      console.log('🔵 FRONTEND: Admin Approval Completed');
      console.log('🔵 ============================================');
      console.log('📊 Final Status:', {
        ticketsGenerated: ticketsGenerated,
        orderId: orderId
      });
      console.log('🔵 ============================================\n');

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' 
          ? `Order approved and tickets ${ticketsGenerated ? 'sent' : 'generation failed'}`
          : `Commande approuvée et billets ${ticketsGenerated ? 'envoyés' : 'génération échouée'}`,
        variant: 'default'
      });
      
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) {
        setIsOrderDetailsOpen(false);
      }
    } catch (error: any) {
      console.error('\n❌ ============================================');
      console.error('❌ FRONTEND: Admin Approval Failed');
      console.error('❌ ============================================');
      console.error('❌ Error approving COD ambassador order:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      console.error('❌ ============================================\n');
      
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to approve order' : 'Échec de l\'approbation de la commande'),
        variant: 'destructive'
      });
    }
  };

  // Approve COD order (changes status from PENDING_ADMIN_APPROVAL to APPROVED)
  const handleApproveOrderAsAdmin = async (orderId: string) => {
    try {
      // Get current order to check if it's a COD order
      const { data: order, error: fetchError } = await (supabase as any)
        .from('orders')
        .select('payment_method, status, source')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // If it's an ambassador-created COD order, use the special approval function
      if (order.source === 'ambassador_manual' && order.payment_method === 'ambassador_cash') {
        return handleApproveCodAmbassadorOrder(orderId);
      }

      // Only approve COD orders that are pending approval
      if (order.payment_method !== 'ambassador_cash') {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? `This order is not a COD order. Payment method: ${order.payment_method || 'N/A'}`
            : `Cette commande n'est pas une commande COD. Méthode de paiement: ${order.payment_method || 'N/A'}`,
          variant: 'destructive'
        });
        return;
      }
      
      if (order.status !== 'PENDING_ADMIN_APPROVAL') {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? `Order status must be PENDING_ADMIN_APPROVAL to approve. Current status: ${order.status || 'N/A'}`
            : `Le statut de la commande doit être PENDING_ADMIN_APPROVAL pour approuver. Statut actuel: ${order.status || 'N/A'}`,
          variant: 'destructive'
        });
        return;
      }

      // Use backend endpoint for atomic approval (similar to skip flow)
      const apiBase = sanitizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8082');
      const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_APPROVE_ORDER, apiBase);

      if (!apiUrl) {
        throw new Error('Invalid API URL configuration');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: includes cookies for admin auth
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || (language === 'en' ? 'Failed to approve order' : 'Échec de l\'approbation de la commande'));
      }

      // Success
      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en'
          ? `Order approved successfully. Tickets: ${data.ticketsCount || 0}, Email: ${data.emailSent ? 'Sent' : 'Failed'}, SMS: ${data.smsSent ? 'Sent' : 'Failed'}`
          : `Commande approuvée avec succès. Billets: ${data.ticketsCount || 0}, Email: ${data.emailSent ? 'Envoyé' : 'Échoué'}, SMS: ${data.smsSent ? 'Envoyé' : 'Échoué'}`,
        variant: 'default'
      });
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) {
        setIsOrderDetailsOpen(false);
      }
    } catch (error: any) {
      console.error('Error approving order:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to approve order' : 'Échec de l\'approbation de la commande'),
        variant: 'destructive'
      });
    }
  };

  // Reject COD Ambassador order (no email/SMS)
  const handleRejectCodAmbassadorOrder = async (orderId: string, rejectionReason: string) => {
    try {
      // Get current order to check if it's a COD ambassador order
      const { data: order, error: fetchError } = await (supabase as any)
        .from('orders')
        .select('payment_method, status, source')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Only reject COD orders that are pending approval
      if (order.payment_method !== 'ambassador_cash') {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? `This order is not a COD order. Payment method: ${order.payment_method || 'N/A'}`
            : `Cette commande n'est pas une commande COD. Méthode de paiement: ${order.payment_method || 'N/A'}`,
          variant: 'destructive'
        });
        return;
      }
      
      if (order.status !== 'PENDING_ADMIN_APPROVAL') {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? `Order status must be PENDING_ADMIN_APPROVAL to reject. Current status: ${order.status || 'N/A'}`
            : `Le statut de la commande doit être PENDING_ADMIN_APPROVAL pour rejeter. Statut actuel: ${order.status || 'N/A'}`,
          variant: 'destructive'
        });
        return;
      }

      if (!rejectionReason || !rejectionReason.trim()) {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'Rejection reason is required'
            : 'La raison du rejet est requise',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await (supabase as any)
        .from('orders')
        .update({
          status: 'REJECTED',
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Log the rejection (NO email or SMS sent)
      await (supabase as any)
        .from('order_logs')
        .insert({
          order_id: orderId,
          action: 'rejected',
          performed_by: null,
          performed_by_type: 'admin',
          details: { 
            old_status: 'PENDING_ADMIN_APPROVAL',
            new_status: 'REJECTED',
            rejection_reason: rejectionReason.trim(),
            email_sent: false,
            sms_sent: false,
            admin_action: true 
          }
        });

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Order rejected' : 'Commande rejetée',
        variant: 'default'
      });
      
      setIsRejectDialogOpen(false);
      setRejectingOrderId(null);
      setRejectionReason('');
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) {
        setIsOrderDetailsOpen(false);
      }
    } catch (error: any) {
      console.error('Error rejecting COD ambassador order:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to reject order' : 'Échec du rejet de la commande'),
        variant: 'destructive'
      });
    }
  };

  // Reject COD order (changes status from PENDING_ADMIN_APPROVAL to REJECTED)
  const handleRejectOrderAsAdmin = async (orderId: string, rejectionReason?: string) => {
    try {
      // Get current order to check if it's a COD order
      const { data: order, error: fetchError } = await (supabase as any)
        .from('orders')
        .select('payment_method, status, source')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // If it's a COD order, use the special rejection function
      if (order.payment_method === 'ambassador_cash') {
        if (!rejectionReason) {
          // Open rejection dialog
          setRejectingOrderId(orderId);
          setIsRejectDialogOpen(true);
          return;
        }
        return handleRejectCodAmbassadorOrder(orderId, rejectionReason);
      }

      // Only reject COD orders that are pending approval
      if (order.payment_method !== 'ambassador_cash') {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? `This order is not a COD order. Payment method: ${order.payment_method || 'N/A'}`
            : `Cette commande n'est pas une commande COD. Méthode de paiement: ${order.payment_method || 'N/A'}`,
          variant: 'destructive'
        });
        return;
      }
      
      if (order.status !== 'PENDING_ADMIN_APPROVAL') {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? `Order status must be PENDING_ADMIN_APPROVAL to reject. Current status: ${order.status || 'N/A'}`
            : `Le statut de la commande doit être PENDING_ADMIN_APPROVAL pour rejeter. Statut actuel: ${order.status || 'N/A'}`,
          variant: 'destructive'
        });
        return;
      }

      const updateData: any = {
        status: 'REJECTED',
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await (supabase as any)
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Log the rejection
      await (supabase as any)
        .from('order_logs')
        .insert({
          order_id: orderId,
          action: 'rejected',
          performed_by: null,
          performed_by_type: 'admin',
          details: { 
            old_status: 'PENDING_ADMIN_APPROVAL',
            new_status: 'REJECTED',
            rejection_reason: rejectionReason || null,
            admin_action: true 
          }
        });

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Order rejected' : 'Commande rejetée',
        variant: 'default'
      });
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) {
        setIsOrderDetailsOpen(false);
      }
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to reject order' : 'Échec du rejet de la commande'),
        variant: 'destructive'
      });
    }
  };

  // Admin Skip Ambassador Confirmation - NEW FEATURE
  const handleSkipAmbassadorConfirmation = async (orderId: string, reason?: string) => {
    setSkippingOrder(true);
    try {
      const apiBase = sanitizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8082');
      const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_SKIP_AMBASSADOR_CONFIRMATION, apiBase);
      
      if (!apiUrl) {
        throw new Error('Invalid API URL configuration');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: includes cookies for admin auth
        body: JSON.stringify({
          orderId,
          reason: reason || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting (429)
        if (response.status === 429) {
          toast({
            title: language === 'en' ? 'Rate Limit Exceeded' : 'Limite de Taux Dépassée',
            description: language === 'en' 
              ? 'Too many requests. Please try again later.'
              : 'Trop de demandes. Veuillez réessayer plus tard.',
            variant: 'destructive'
          });
          return;
        }

        // Handle validation errors
        throw new Error(data.details || data.error || (language === 'en' ? 'Failed to skip ambassador confirmation' : 'Échec de la confirmation de l\'ambassadeur'));
      }

      // Success
      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en'
          ? `Order approved successfully. Tickets: ${data.ticketsCount || 0}, Email: ${data.emailSent ? 'Sent' : 'Failed'}, SMS: ${data.smsSent ? 'Sent' : 'Failed'}`
          : `Commande approuvée avec succès. Billets: ${data.ticketsCount || 0}, Email: ${data.emailSent ? 'Envoyé' : 'Échoué'}, SMS: ${data.smsSent ? 'Envoyé' : 'Échoué'}`,
        variant: 'default'
      });

      // Close dialog and refresh data
      setIsSkipConfirmationDialogOpen(false);
      setSkippingOrderId(null);
      setSkipReason('');
      fetchAmbassadorSalesData();
      
      if (selectedOrder?.id === orderId) {
        setIsOrderDetailsOpen(false);
      }
    } catch (error: any) {
      console.error('Error skipping ambassador confirmation:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to skip ambassador confirmation' : 'Échec de la confirmation de l\'ambassadeur'),
        variant: 'destructive'
      });
    } finally {
      setSkippingOrder(false);
    }
  };

  // Admin Resend Ticket Email - NEW FEATURE
  const handleResendTicketEmail = async (orderId: string) => {
    setResendingTicketEmail(true);
    try {
      const apiBase = sanitizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8082');
      const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_RESEND_TICKET_EMAIL, apiBase);
      
      if (!apiUrl) {
        throw new Error('Invalid API URL configuration');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: includes cookies for admin auth
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting (429)
        if (response.status === 429) {
          toast({
            title: language === 'en' ? 'Rate Limit Exceeded' : 'Limite de Taux Dépassée',
            description: language === 'en' 
              ? 'Too many resend requests for this order. Please wait before trying again (max 5 per hour).'
              : 'Trop de demandes de renvoi pour cette commande. Veuillez attendre avant de réessayer (max 5 par heure).',
            variant: 'destructive'
          });
          return;
        }

        // Handle validation errors
        const errorMessage = data.details || data.error || (language === 'en' ? 'Failed to resend ticket email' : 'Échec du renvoi de l\'email des billets');
        throw new Error(errorMessage);
      }

      // Success
      toast({
        title: language === 'en' ? 'Email Resent' : 'Email Renvoyé',
        description: language === 'en'
          ? `Ticket email resent successfully. Tickets: ${data.ticketsCount || 0}`
          : `Email de billet renvoyé avec succès. Billets: ${data.ticketsCount || 0}`,
        variant: 'default'
      });

      // Refresh email logs if order details are open
      if (selectedOrder?.id === orderId) {
        // Refresh email delivery logs
        setLoadingEmailLogs(true);
        try {
          const logsResponse = await apiFetch(`/api/email-delivery-logs/${orderId}`);
          if (logsResponse.ok) {
            const logsData = await logsResponse.json();
            setEmailDeliveryLogs(logsData.logs || []);
          }
        } catch (logsError) {
          console.error('Error fetching email logs:', logsError);
        } finally {
          setLoadingEmailLogs(false);
        }
      }
    } catch (error: any) {
      console.error('Error resending ticket email:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to resend ticket email' : 'Échec du renvoi de l\'email des billets'),
        variant: 'destructive'
      });
    } finally {
      setResendingTicketEmail(false);
    }
  };

  // Complete COD order (changes status from APPROVED to COMPLETED)
  const handleCompleteOrderAsAdmin = async (orderId: string) => {
    try {
      // Get current order to check status
      const { data: order, error: fetchError } = await (supabase as any)
        .from('orders')
        .select('payment_method, status')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // For COD orders, only complete if status is APPROVED
      if (order.payment_method === 'ambassador_cash' && order.status !== 'APPROVED') {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'COD orders must be approved before they can be completed'
            : 'Les commandes COD doivent être approuvées avant de pouvoir être terminées',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await (supabase as any)
        .from('orders')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Log the completion
      await (supabase as any)
        .from('order_logs')
        .insert({
          order_id: orderId,
          action: 'completed',
          performed_by: null,
          performed_by_type: 'admin',
          details: { 
            old_status: order.status,
            new_status: 'COMPLETED',
            admin_action: true 
          }
        });

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Order completed' : 'Commande terminée',
        variant: 'default'
      });
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) {
        setIsOrderDetailsOpen(false);
      }
    } catch (error: any) {
      console.error('Error completing order:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to complete order' : 'Échec de la finalisation de la commande'),
        variant: 'destructive'
      });
    }
  };

  // Update online order payment status
  const updateOnlineOrderStatus = async (orderId: string, newStatus: 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'REFUNDED') => {
    try {
      const { error } = await (supabase as any)
        .from('orders')
        .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      // Log the action
      await (supabase as any).from('order_logs').insert({
        order_id: orderId,
        action: 'status_changed',
        performed_by_type: 'admin',
        details: {
          old_payment_status: selectedOnlineOrder?.payment_status,
          new_payment_status: newStatus,
          action: `Marked as ${newStatus}`
        }
      });

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? `Order status updated to ${newStatus}` : `Statut de la commande mis à jour vers ${newStatus}`,
        variant: "default",
      });

      // Refresh orders
      await fetchOnlineOrders();
      if (selectedOnlineOrder?.id === orderId) {
        const updatedOrder = onlineOrders.find(o => o.id === orderId);
        if (updatedOrder) {
          setSelectedOnlineOrder({ ...updatedOrder, payment_status: newStatus });
        }
      }
    } catch (error: any) {
      console.error('Error updating order status:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to update order status' : 'Échec de la mise à jour du statut'),
        variant: "destructive",
      });
    }
  };

  const fetchPerformanceReports = async () => {
    setLoadingPerformance(true);
    try {
      // Fetch all orders (ambassador + online)
      const { data: allOrders } = await (supabase as any)
        .from('orders')
        .select('*');

      if (!allOrders) return;

      // Separate ambassador orders and online orders
      const ambassadorOrders = (allOrders as any[]).filter((o: any) => 
        o.source === 'platform_cod' || o.source === 'ambassador_manual'
      );
      const onlineOrders = (allOrders as any[]).filter((o: any) => o.source === 'platform_online');

      // Total orders (all sources)
      const total = allOrders.length;
      
      // Completed orders: 
      // - For ambassador orders: status === 'COMPLETED'
      // - For online orders: payment_status === 'PAID'
      const completedAmbassador = ambassadorOrders.filter((o: any) => 
        o.status?.toUpperCase() === 'COMPLETED'
      ).length;
      const completedOnline = onlineOrders.filter((o: any) => 
        o.payment_status === 'PAID'
      ).length;
      const totalCompleted = completedAmbassador + completedOnline;
      
      const successRate = total > 0 ? ((totalCompleted / total) * 100).toFixed(1) : '0';

      // Calculate average response time (only for ambassador orders with assigned/accepted)
      const acceptedOrders = ambassadorOrders.filter((o: any) => o.accepted_at && o.assigned_at);
      const avgResponseTime = acceptedOrders.length > 0
        ? (acceptedOrders.reduce((sum: number, o: any) => {
            const assigned = new Date(o.assigned_at).getTime();
            const accepted = new Date(o.accepted_at).getTime();
            return sum + (accepted - assigned);
          }, 0) / acceptedOrders.length / 1000 / 60).toFixed(1)
        : '0';

      setPerformanceReports({
        totalOrders: total,
        totalCompleted,
        completedAmbassador,
        completedOnline,
        successRate,
        avgResponseTime
      });
    } catch (error) {
      console.error('Error fetching performance reports:', error);
    } finally {
      setLoadingPerformance(false);
    }
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
          content: updatedContent as any,
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
      
      // Use only basic columns that definitely exist (id, phone_number, created_at)
      // Don't try to detect optional columns - it causes 400 errors
      const { data, error } = await supabase
        .from('phone_subscribers' as any)
        .select('id, phone_number, created_at')
        .order('created_at', { ascending: false });
      
      if (error) {
        // If even basic query fails, table might not exist or RLS issue
        console.warn('phone_subscribers query error:', error);
        setPhoneSubscribers([]);
        return;
      }
      
      // Map data to expected format (use created_at as subscribed_at fallback)
      setPhoneSubscribers((data || []).map((item: any) => ({
        id: item.id,
        phone_number: item.phone_number,
        subscribed_at: item.created_at || new Date().toISOString(),
        city: undefined // city column doesn't exist, always undefined
      })));
      
    } catch (error) {
      console.error('Error fetching phone subscribers:', error);
      setPhoneSubscribers([]);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  // Import phone numbers from ambassador applications
  const handleImportFromApplications = async () => {
    try {
      setImportingFromApplications(true);
      
      // Fetch all ambassador applications with phone numbers
      const { data: applications, error } = await supabase
        .from('ambassador_applications')
        .select('phone_number, city')
        .not('phone_number', 'is', null);

      if (error) throw error;

      if (!applications || applications.length === 0) {
        toast({
          title: language === 'en' ? 'No Data' : 'Aucune Donnée',
          description: language === 'en' 
            ? 'No ambassador applications found with phone numbers'
            : 'Aucune candidature d\'ambassadeur trouvée avec numéros de téléphone',
          variant: 'default'
        });
        return;
      }

      // Prepare phone numbers with city info (only include city if column exists)
      // We'll try to insert with city, but handle errors gracefully
      const phonesToImport = applications
        .filter(app => app.phone_number)
        .map(app => ({
          phone_number: app.phone_number,
          language: 'en' as const,
          ...(app.city ? { city: app.city } : {}) // Only include city if it exists
        }));

      if (phonesToImport.length === 0) {
        toast({
          title: language === 'en' ? 'No Data' : 'Aucune Donnée',
          description: language === 'en' 
            ? 'No valid phone numbers found in applications'
            : 'Aucun numéro de téléphone valide trouvé dans les candidatures',
          variant: 'default'
        });
        return;
      }

      // Get all existing phone numbers in one query (batch check)
      const existingPhones = phonesToImport.map(p => p.phone_number);
      const { data: existingSubscribers, error: checkError } = await supabase
        .from('phone_subscribers')
        .select('phone_number')
        .in('phone_number', existingPhones);

      if (checkError) throw checkError;

      const existingPhoneSet = new Set(
        (existingSubscribers || []).map((s: any) => s.phone_number)
      );

      // Filter out duplicates
      const newPhonesToImport = phonesToImport.filter(
        phone => !existingPhoneSet.has(phone.phone_number)
      );

      let duplicates = phonesToImport.length - newPhonesToImport.length;
      const results: string[] = [];
      const errors: Array<{ phone: string; error: string }> = [];

      // Batch insert all new phones at once (in chunks of 100 to avoid payload limits)
      const chunkSize = 100;
      for (let i = 0; i < newPhonesToImport.length; i += chunkSize) {
        const chunk = newPhonesToImport.slice(i, i + chunkSize);
        
        try {
          const { data: inserted, error: insertError } = await supabase
            .from('phone_subscribers')
            .insert(chunk)
            .select('phone_number');

          if (insertError) {
            // Check if error is about city column not existing
            const isCityColumnError = insertError.message?.includes('city') && 
                                     (insertError.code === '42703' || insertError.code === 'PGRST116');
            
            if (isCityColumnError) {
              // Retry insert without city column
              const chunkWithoutCity = chunk.map((p: any) => {
                const { city, ...rest } = p;
                return rest;
              });
              
              const { data: insertedWithoutCity, error: errorWithoutCity } = await supabase
                .from('phone_subscribers')
                .insert(chunkWithoutCity)
                .select('phone_number');
              
              if (errorWithoutCity) {
                // If still fails, try individual inserts
                for (const phone of chunkWithoutCity) {
                  try {
                    const { error: singleError } = await supabase
                      .from('phone_subscribers')
                      .insert(phone);

                    if (singleError) {
                      if (singleError.code === '23505') {
                        duplicates++;
                      } else {
                        errors.push({ phone: phone.phone_number, error: singleError.message });
                      }
                    } else {
                      results.push(phone.phone_number);
                    }
                  } catch (err: any) {
                    errors.push({ phone: phone.phone_number, error: err.message });
                  }
                }
              } else {
                if (insertedWithoutCity) {
                  results.push(...insertedWithoutCity.map((item: any) => item.phone_number));
                }
              }
            } else {
              // If batch insert fails for other reasons, try individual inserts for this chunk
              for (const phone of chunk) {
                try {
                  const { error: singleError } = await supabase
                    .from('phone_subscribers')
                    .insert(phone);

                  if (singleError) {
                    if (singleError.code === '23505') {
                      // Duplicate (race condition)
                      duplicates++;
                    } else {
                      errors.push({ phone: phone.phone_number, error: singleError.message });
                    }
                  } else {
                    results.push(phone.phone_number);
                  }
                } catch (err: any) {
                  errors.push({ phone: phone.phone_number, error: err.message });
                }
              }
            }
          } else {
            // Success - add all inserted phone numbers to results
            if (inserted) {
              results.push(...inserted.map((item: any) => item.phone_number));
            }
          }
        } catch (err: any) {
          // If batch fails completely, log error
          console.error('Batch insert error:', err);
          errors.push({ phone: 'batch', error: err.message });
        }
      }

      // Refresh subscribers list
      await fetchPhoneSubscribers();

      toast({
        title: language === 'en' ? 'Import Complete' : 'Importation Terminée',
        description: language === 'en'
          ? `Imported: ${results.length}, Duplicates: ${duplicates.length}, Errors: ${errors.length}`
          : `Importé: ${results.length}, Doublons: ${duplicates.length}, Erreurs: ${errors.length}`,
        variant: results.length > 0 ? 'default' : 'destructive'
      });

      if (errors.length > 0) {
        console.error('Import errors:', errors);
      }
    } catch (error: any) {
      console.error('Error importing from applications:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to import phone numbers' : 'Échec de l\'importation des numéros'),
        variant: 'destructive'
      });
    } finally {
      setImportingFromApplications(false);
    }
  };

  // Fetch SMS logs
  const fetchSmsLogs = async () => {
    try {
      setLoadingLogs(true);
      // Note: sms_logs table may not exist in schema
      const { data, error } = await supabase
        .from('sms_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('sms_logs table not found, skipping:', error);
        setSmsLogs([]);
        return;
      }
      setSmsLogs((data || []) as unknown as Array<{id: string; phone_number: string; message: string; status: string; error_message?: string; sent_at?: string; created_at: string; api_response?: any}>);
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
      // Note: site_logs table may not exist in schema
      const { data, error } = await supabase
        .from('site_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.warn('site_logs table not found, skipping:', error);
        setSiteLogs([]);
        return;
      }
      setSiteLogs((data || []) as unknown as Array<{id: string; log_type: string; category: string; message: string; details: any; user_type: string; created_at: string}>);
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
      setUploadingFavicon({ type, loading: true });
      const result = await uploadFavicon(file, type);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Reload favicon settings
      await loadFaviconSettings();

      // Force favicon reload by triggering a custom event
      window.dispatchEvent(new Event('favicon-updated'));

      toast({
        title: language === 'en' ? 'Favicon Uploaded' : 'Favicon Téléchargé',
        description: language === 'en' 
          ? 'Favicon uploaded successfully. The favicon should update automatically. If not, try refreshing the page (Ctrl+Shift+R or Cmd+Shift+R).' 
          : 'Favicon téléchargé avec succès. Le favicon devrait se mettre à jour automatiquement. Sinon, essayez d\'actualiser la page (Ctrl+Shift+R ou Cmd+Shift+R).',
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
      setUploadingFavicon({ type: '', loading: false });
    }
  };

  // Load current OG image URL
  const loadOGImageUrl = async () => {
    try {
      const url = await getOGImageUrl();
      setCurrentOGImageUrl(url);
    } catch (error) {
      console.error('Error loading OG image URL:', error);
      setCurrentOGImageUrl(null);
    }
  };

  // Handle OG image upload
  const handleUploadOGImage = async (file: File) => {
    try {
      setUploadingOGImage(true);
      
      // Validate image dimensions first
      const validation = await validateOGImage(file);
      if (!validation.valid) {
        toast({
          title: language === 'en' ? 'Invalid Image' : 'Image Invalide',
          description: validation.error || (language === 'en' ? 'Image validation failed' : 'Échec de la validation de l\'image'),
          variant: 'destructive',
        });
        return;
      }

      // Upload the image
      const result = await uploadOGImage(file);
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Reload the OG image URL
      await loadOGImageUrl();

      toast({
        title: language === 'en' ? 'OG Image Uploaded' : 'Image OG Téléchargée',
        description: language === 'en' 
          ? 'OG image uploaded successfully. Use Facebook Debugger to clear cache and see the new image.' 
          : 'Image OG téléchargée avec succès. Utilisez le Facebook Debugger pour vider le cache et voir la nouvelle image.',
      });
    } catch (error) {
      console.error('Error uploading OG image:', error);
      toast({
        title: language === 'en' ? 'Upload Failed' : 'Échec du Téléchargement',
        description: error instanceof Error ? error.message : (language === 'en' ? 'Failed to upload OG image' : 'Échec du téléchargement de l\'image OG'),
        variant: 'destructive',
      });
    } finally {
      setUploadingOGImage(false);
    }
  };

  // Handle OG image delete
  const handleDeleteOGImage = async () => {
    try {
      if (!currentOGImageUrl) {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'No OG image to delete' 
            : 'Aucune image OG à supprimer',
          variant: 'destructive',
        });
        return;
      }

      const result = await deleteOGImage();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete OG image');
      }

      // Wait a moment for deletion to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear the current OG image URL immediately
      setCurrentOGImageUrl(null);

      // Reload the OG image URL to verify deletion (should be null now)
      const verifyUrl = await getOGImageUrl();
      if (verifyUrl) {
        console.warn('OG image URL still exists after deletion - might be cached or deletion failed');
        // Still set to null in UI, but log the issue
        setCurrentOGImageUrl(null);
      }

      toast({
        title: language === 'en' ? 'OG Image Deleted' : 'Image OG Supprimée',
        description: language === 'en' 
          ? 'OG image deleted successfully. Social media platforms will no longer show a preview image until you upload a new one.' 
          : 'Image OG supprimée avec succès. Les plateformes de médias sociaux n\'afficheront plus d\'image d\'aperçu jusqu\'à ce que vous en téléchargiez une nouvelle.',
      });
    } catch (error) {
      console.error('Error deleting OG image:', error);
      toast({
        title: language === 'en' ? 'Delete Failed' : 'Échec de la Suppression',
        description: error instanceof Error ? error.message : (language === 'en' ? 'Failed to delete OG image' : 'Échec de la suppression de l\'image OG'),
        variant: 'destructive',
      });
    }
  };

  // Handle favicon delete
  const handleDeleteFavicon = async (type: 'favicon_ico' | 'favicon_32x32' | 'favicon_16x16' | 'apple_touch_icon') => {
    try {
      const currentUrl = faviconSettings[type];
      if (!currentUrl) {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'No favicon to delete' 
            : 'Aucun favicon à supprimer',
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

      // Force favicon reload by triggering a custom event
      window.dispatchEvent(new Event('favicon-updated'));

      toast({
        title: language === 'en' ? 'Favicon Deleted' : 'Favicon Supprimé',
        description: language === 'en' 
          ? 'Favicon deleted successfully. The change should be visible immediately. If not, try refreshing the page (Ctrl+Shift+R or Cmd+Shift+R).' 
          : 'Favicon supprimé avec succès. Le changement devrait être visible immédiatement. Sinon, essayez d\'actualiser la page (Ctrl+Shift+R ou Cmd+Shift+R).',
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

  // Fetch SMS balance
  const fetchSmsBalance = async () => {
    try {
      setLoadingBalance(true);
      const response = await apiFetch(API_ROUTES.SMS_BALANCE);
      
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

      const response = await apiFetch(API_ROUTES.BULK_PHONES, {
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

  // Send Test SMS - handles all three test modes
  const handleSendTestSms = async () => {
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

    let phoneToSend = '';

    // Determine which phone number to use based on test mode
    if (testMode === 'specific') {
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
      phoneToSend = cleanPhone;
    } else if (testMode === 'broadcast') {
      // Get test number from phone_subscribers (27169458)
      const testNumber = '27169458';
      const { data, error } = await supabase
        .from('phone_subscribers' as any)
        .select('phone_number')
        .eq('phone_number', testNumber)
        .single();
      
      if (error || !data) {
        toast({
          title: language === 'en' ? 'Test Number Not Found' : 'Numéro Test Introuvable',
          description: language === 'en' 
            ? 'Test number 27169458 not found in subscribers. Please run the migration to add it.'
            : 'Le numéro test 27169458 n\'a pas été trouvé. Veuillez exécuter la migration pour l\'ajouter.',
          variant: 'destructive',
        });
        return;
      }
      phoneToSend = testNumber;
    } else if (testMode === 'targeted') {
      if (!testTargetedCity) {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' 
            ? 'Please select a city' 
            : 'Veuillez sélectionner une ville',
          variant: 'destructive',
        });
        return;
      }

      // Get first phone number from ambassador_applications for selected city
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('phone_number')
        .eq('city', testTargetedCity)
        .not('phone_number', 'is', null)
        .limit(1)
        .single();
      
      if (error || !data || !data.phone_number) {
        toast({
          title: language === 'en' ? 'No Numbers Found' : 'Aucun Numéro Trouvé',
          description: language === 'en' 
            ? `No phone numbers found for city: ${testTargetedCity}`
            : `Aucun numéro de téléphone trouvé pour la ville: ${testTargetedCity}`,
          variant: 'destructive',
        });
        return;
      }
      phoneToSend = data.phone_number;
    }

    if (!phoneToSend) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'No phone number available for testing'
          : 'Aucun numéro de téléphone disponible pour le test',
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
      
      const response = await apiFetch(API_ROUTES.SEND_SMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumbers: [phoneToSend], 
          message: testSmsMessage.trim() 
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${text.substring(0, 200)}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
      }

      const responseData = await response.json();

      if (responseData.success) {
        let description = '';
        if (testMode === 'specific') {
          description = language === 'en' 
            ? `Test SMS sent successfully to +216 ${phoneToSend}`
            : `SMS test envoyé avec succès à +216 ${phoneToSend}`;
        } else if (testMode === 'broadcast') {
          description = language === 'en' 
            ? `Broadcast test sent to +216 ${phoneToSend} (test number)`
            : `Test de diffusion envoyé à +216 ${phoneToSend} (numéro test)`;
        } else if (testMode === 'targeted') {
          description = language === 'en' 
            ? `Targeted test sent to +216 ${phoneToSend} in ${testTargetedCity}`
            : `Test ciblé envoyé à +216 ${phoneToSend} à ${testTargetedCity}`;
        }

        toast({
          title: language === 'en' ? 'Test SMS Sent' : 'SMS Test Envoyé',
          description,
        });
        
        await fetchSmsLogs();
        await fetchSmsBalance();
        
        // Clear test fields (only clear phone number for specific mode)
        if (testMode === 'specific') {
          setTestPhoneNumber('');
        }
        setTestSmsMessage('');
      } else {
        throw new Error(responseData.error || 'Failed to send test SMS');
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

  // Fetch count of phone numbers from ambassador applications by city
  const fetchTargetedCount = async (city: string) => {
    if (!city) {
      setTargetedCount(0);
      return;
    }
    
    try {
      setLoadingTargetedCount(true);
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('phone_number')
        .eq('city', city)
        .not('phone_number', 'is', null);
      
      if (error) {
        console.error('Error fetching targeted count:', error);
        setTargetedCount(0);
        return;
      }
      
      setTargetedCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching targeted count:', error);
      setTargetedCount(0);
    } finally {
      setLoadingTargetedCount(false);
    }
  };

  // Handle city change in targeted mode
  const handleTargetedCityChange = async (city: string) => {
    setTargetedCity(city);
    if (city) {
      await fetchTargetedCount(city);
    } else {
      setTargetedCount(0);
    }
  };

  // Send SMS broadcast (popup subscribers only)
  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter a message' 
          : 'Veuillez entrer un message',
        variant: 'destructive',
      });
      return;
    }

    if (phoneSubscribers.length === 0) {
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
      setSendingBroadcast(true);
      
      const phonesToSend = phoneSubscribers.map(sub => sub.phone_number);
      
      const response = await apiFetch(API_ROUTES.SEND_SMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumbers: phonesToSend, 
          message: broadcastMessage.trim() 
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${text.substring(0, 200)}`);
      }

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
        
        await fetchSmsLogs();
        await fetchSmsBalance();
        setBroadcastMessage('');
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
      setSendingBroadcast(false);
    }
  };

  // Send targeted SMS (ambassador applications by city)
  const handleSendTargeted = async () => {
    if (!targetedMessage.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter a message' 
          : 'Veuillez entrer un message',
        variant: 'destructive',
      });
      return;
    }

    if (!targetedCity) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please select a city' 
          : 'Veuillez sélectionner une ville',
        variant: 'destructive',
      });
      return;
    }

    if (targetedCount === 0) {
      toast({
        title: language === 'en' ? 'No Numbers' : 'Aucun Numéro',
        description: language === 'en' 
          ? `No phone numbers found for city: ${targetedCity}`
          : `Aucun numéro de téléphone trouvé pour la ville: ${targetedCity}`,
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
      setSendingTargeted(true);
      
      // Fetch phone numbers from ambassador applications for selected city
      const { data: applicationsData, error } = await supabase
        .from('ambassador_applications')
        .select('phone_number')
        .eq('city', targetedCity)
        .not('phone_number', 'is', null);
      
      if (error) {
        throw new Error(`Failed to fetch phone numbers: ${error.message}`);
      }
      
      const phonesToSend = (applicationsData || []).map((app: any) => app.phone_number).filter((phone: string) => phone);
      
      if (phonesToSend.length === 0) {
        throw new Error('No valid phone numbers found');
      }
      
      const response = await apiFetch(API_ROUTES.SEND_SMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumbers: phonesToSend, 
          message: targetedMessage.trim() 
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${text.substring(0, 200)}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
      }

      const responseData = await response.json();

      if (responseData.success) {
        toast({
          title: language === 'en' ? 'Targeted SMS Sent' : 'SMS Ciblé Envoyé',
          description: language === 'en' 
            ? `Sent: ${responseData.sent}, Failed: ${responseData.failed} out of ${responseData.total}`
            : `Envoyé: ${responseData.sent}, Échoué: ${responseData.failed} sur ${responseData.total}`,
        });
        
        await fetchSmsLogs();
        await fetchSmsBalance();
        setTargetedMessage('');
      } else {
        throw new Error(responseData.error || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('Error sending targeted SMS:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error instanceof Error ? error.message : (language === 'en' ? 'Failed to send SMS' : 'Échec de l\'envoi du SMS'),
        variant: 'destructive',
      });
    } finally {
      setSendingTargeted(false);
    }
  };

  // Fetch current admin role and verify token validity
  // This ensures the 1-hour session is enforced - token expiration is checked periodically
  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 5000; // 5 seconds
    
    const fetchCurrentAdminRole = async (isRetry = false): Promise<void> => {
      try {
        // Use direct fetch instead of apiFetch to avoid auto-redirect on 401
        // We want to handle 401 errors specifically based on the error reason
        const response = await fetch(API_ROUTES.VERIFY_ADMIN, {
          method: 'GET',
          credentials: 'include', // Include cookies for authentication
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Reset retry count on success
          retryCount = 0;
          
          if (data.valid && data.admin) {
            const role = data.admin.role || 'admin';
            setCurrentAdminRole(role);
            setCurrentAdminId(data.admin.id || null);
            setCurrentAdminName(data.admin.name || null);
            setCurrentAdminEmail(data.admin.email || null);
            
            // Update session expiration timestamp from server response
            // STRICT: This is the JWT 'exp' field - immutable, non-resettable
            // The expiration time is set at login and NEVER changes until re-login
            if (data.sessionExpiresAt) {
              const expiration = data.sessionExpiresAt;
              // Only set if not already set (prevents reset on refresh)
              setSessionExpiresAt(prev => {
                // If we already have the same expiration, don't update
                // This ensures the timer never resets on page refresh
                if (prev === expiration) return prev;
                // Only update if we don't have one yet or if it's different (shouldn't happen)
                return prev || expiration;
              });
              // Calculate remaining time from expiration timestamp
              const remaining = Math.max(0, Math.floor((expiration - Date.now()) / 1000));
              setSessionTimeLeft(remaining);
            }
            
            // Show alert if role is not super_admin but user expects it
            if (role !== 'super_admin') {
              console.warn('⚠️ Current role is:', role, '- Expected: super_admin');
              console.warn('💡 If you should be super_admin, run FIX_SUPER_ADMIN_ROLE.sql and log out/in');
            }
          } else {
            // Check if it's a clear token expiration (not a server error)
            const errorReason = data.reason || data.error || '';
            const isTokenExpired = errorReason.includes('expired') || 
                                  errorReason.includes('Token expired') ||
                                  errorReason === 'Token expired - session ended';
            
            if (isTokenExpired || response.status === 401) {
              // Actual token expiration - redirect to login
              console.warn('Admin session expired - redirecting to login');
              window.location.href = '/admin/login';
            } else {
              // Server error or invalid admin - log but don't redirect
              console.warn('Admin verification failed (non-expiration):', errorReason);
              // Don't redirect - token might still be valid, just server issue
            }
          }
        } else {
          // Handle different error status codes appropriately
          if (response.status === 401) {
            // Try to parse error to see if it's actual expiration
            try {
              const errorData = await response.json();
              const errorReason = errorData.reason || errorData.error || '';
              const isTokenExpired = errorReason.includes('expired') || 
                                    errorReason.includes('Token expired') ||
                                    errorReason === 'Token expired - session ended';
              
              if (isTokenExpired) {
                // Actual token expiration - redirect
                console.warn('Admin session expired (401) - redirecting to login');
                window.location.href = '/admin/login';
              } else {
                // 401 but not expiration (e.g., invalid token format) - retry once
                if (retryCount < MAX_RETRIES && !isRetry) {
                  retryCount++;
                  console.warn(`Retrying admin verification (attempt ${retryCount}/${MAX_RETRIES})...`);
                  setTimeout(() => fetchCurrentAdminRole(true), RETRY_DELAY);
                } else {
                  console.error('Admin verification failed after retries:', errorReason);
                }
              }
            } catch (parseError) {
              // Can't parse error - assume it's expiration for security
              console.warn('Admin session expired (401, unparseable) - redirecting to login');
              window.location.href = '/admin/login';
            }
          } else if (response.status === 429) {
            // Rate limited - don't logout, just log and retry later
            console.warn('Admin verification rate limited - will retry on next interval');
            retryCount = 0; // Reset retry count
          } else if (response.status >= 500) {
            // Server error - retry with exponential backoff
            if (retryCount < MAX_RETRIES && !isRetry) {
              retryCount++;
              const backoffDelay = RETRY_DELAY * retryCount;
              console.warn(`Server error (${response.status}), retrying in ${backoffDelay}ms (attempt ${retryCount}/${MAX_RETRIES})...`);
              setTimeout(() => fetchCurrentAdminRole(true), backoffDelay);
            } else {
              console.error('Admin verification failed after retries, status:', response.status);
              // Don't logout on server errors - token might still be valid
            }
          } else {
            // Other client errors (400, 403, etc.) - log but don't logout
            console.error('Admin verification failed, status:', response.status);
            retryCount = 0;
          }
        }
      } catch (error) {
        // Network error or fetch failure - retry with exponential backoff
        if (retryCount < MAX_RETRIES && !isRetry) {
          retryCount++;
          const backoffDelay = RETRY_DELAY * retryCount;
          console.warn(`Network error during admin verification, retrying in ${backoffDelay}ms (attempt ${retryCount}/${MAX_RETRIES})...`);
          setTimeout(() => fetchCurrentAdminRole(true), backoffDelay);
        } else {
          console.error('Network error fetching admin role after retries:', error);
          // Don't logout on network errors - token might still be valid
          retryCount = 0; // Reset for next interval
        }
      }
    };
    
    // Fetch immediately on mount to get the correct session expiration from JWT
    // STRICT: This gets the immutable 'exp' field from the token - never resets
    fetchCurrentAdminRole();
    
    // Verify token periodically to catch expiration
    // STRICT: This only checks expiration - it NEVER extends or resets the timer
    // The JWT 'exp' field is immutable and cannot be changed
    // Changed to 15 minutes as requested
    const interval = setInterval(() => {
      retryCount = 0; // Reset retry count for each interval
      fetchCurrentAdminRole();
    }, 15 * 60 * 1000); // Every 15 minutes
    
    return () => clearInterval(interval);
  }, [navigate]);

  // Fetch all admins (only for super_admin)
  const fetchAdmins = async () => {
    if (currentAdminRole !== 'super_admin') return;
    
    try {
      // Try to fetch with phone first, fallback to without phone if column doesn't exist
      let { data, error } = await supabase
        .from('admins')
        .select('id, name, email, phone, role, is_active, created_at')
        .order('created_at', { ascending: false });
      
      // If error is about missing column, try without phone
      if (error && (error.message?.includes('column') || error.code === '42703')) {
        const { data: dataWithoutPhone, error: errorWithoutPhone } = await supabase
          .from('admins')
          .select('id, name, email, role, is_active, created_at')
          .order('created_at', { ascending: false });
        
        if (!errorWithoutPhone && dataWithoutPhone) {
          // Map data without phone to include optional phone field
          data = dataWithoutPhone.map(admin => ({ ...admin, phone: undefined })) as unknown as typeof data;
          error = null;
        }
      }
      
      if (error) {
        console.error('Error fetching admins:', error);
      } else {
        setAdmins((data || []) as unknown as Array<{id: string; name: string; email: string; phone?: string; role: string; is_active: boolean; created_at: string}>);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  // Add new admin
  const handleAddAdmin = async () => {
    if (!newAdminData.name || !newAdminData.email) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' ? 'Name and email are required' : 'Le nom et l\'email sont requis',
        variant: 'destructive',
      });
      return;
    }

    setProcessingId('new-admin');
    
    try {
      // Generate password
      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin account
      // Build insert payload - only include phone if column exists
      const insertPayload: any = {
        name: newAdminData.name,
        email: newAdminData.email,
        password: hashedPassword,
        role: 'admin',
        is_active: true,
      };
      
      // Only include phone if it's provided (column might not exist)
      if (newAdminData.phone && newAdminData.phone.trim() !== '') {
        insertPayload.phone = newAdminData.phone;
      }
      
      const { data: newAdmin, error: createError } = await supabase
        .from('admins')
        .insert(insertPayload)
        .select()
        .single();
      
      // If error is about missing phone column, try without it
      if (createError && createError.message?.includes('phone')) {
        const { data: retryAdmin, error: retryError } = await supabase
          .from('admins')
          .insert({
            name: newAdminData.name,
            email: newAdminData.email,
            password: hashedPassword,
            role: 'admin',
            is_active: true,
          })
          .select()
          .single();
        
        if (retryError) {
          throw retryError;
        }
        
        // Use retry result
        if (!retryAdmin) {
          throw new Error('Failed to create admin account');
        }
        
        // Continue with email sending using retryAdmin
        const emailConfig = createAdminCredentialsEmail(
          {
            name: newAdminData.name,
            email: newAdminData.email,
            phone: newAdminData.phone || undefined,
            password: password
          },
          `${window.location.origin}/admin/login`
        );

        const emailResult = await sendEmailWithDetails(emailConfig);

        if (emailResult.success) {
          toast({
            title: language === 'en' ? 'Admin Created' : 'Admin Créé',
            description: language === 'en' 
              ? `Admin account created successfully. Credentials sent to ${newAdminData.email}`
              : `Compte admin créé avec succès. Identifiants envoyés à ${newAdminData.email}`,
          });
        } else {
          console.error('Email sending failed:', emailResult.error);
          toast({
            title: language === 'en' ? 'Admin Created - Email Failed' : 'Admin Créé - Email Échoué',
            description: language === 'en' 
              ? `Admin account created, but email failed: ${emailResult.error || 'Unknown error'}. Please check the password manually.`
              : `Compte admin créé, mais l'email a échoué: ${emailResult.error || 'Erreur inconnue'}. Veuillez vérifier le mot de passe manuellement.`,
            variant: 'destructive',
            duration: 10000,
          });
        }

        // Reset form and close dialog
        setNewAdminData({ name: '', email: '', phone: '' });
        setIsAddAdminDialogOpen(false);
        
        // Refresh admins list
        await fetchAdmins();
        setProcessingId(null);
        return;
      }

      if (createError) {
        // If error is about missing phone column, try without it
        if (createError.message?.includes('phone')) {
          const { data: retryAdmin, error: retryError } = await supabase
            .from('admins')
            .insert({
              name: newAdminData.name,
              email: newAdminData.email,
              password: hashedPassword,
              role: 'admin',
              is_active: true,
            })
            .select()
            .single();
          
          if (retryError) throw retryError;
          if (!retryAdmin) throw new Error('Failed to create admin account');
          
          // Use retry result for email sending
          const emailConfig = createAdminCredentialsEmail(
            {
              name: newAdminData.name,
              email: newAdminData.email,
              phone: newAdminData.phone || undefined,
              password: password
            },
            `${window.location.origin}/admin/login`
          );

          const emailResult = await sendEmailWithDetails(emailConfig);

          if (emailResult.success) {
            toast({
              title: language === 'en' ? 'Admin Created' : 'Admin Créé',
              description: language === 'en' 
                ? `Admin account created successfully. Credentials sent to ${newAdminData.email}`
                : `Compte admin créé avec succès. Identifiants envoyés à ${newAdminData.email}`,
            });
          } else {
            console.error('Email sending failed:', emailResult.error);
            toast({
              title: language === 'en' ? 'Admin Created - Email Failed' : 'Admin Créé - Email Échoué',
              description: language === 'en' 
                ? `Admin account created, but email failed: ${emailResult.error || 'Unknown error'}. Please check the password manually.`
                : `Compte admin créé, mais l'email a échoué: ${emailResult.error || 'Erreur inconnue'}. Veuillez vérifier le mot de passe manuellement.`,
              variant: 'destructive',
              duration: 10000,
            });
          }

          // Reset form and close dialog
          setNewAdminData({ name: '', email: '', phone: '' });
          setIsAddAdminDialogOpen(false);
          
          // Refresh admins list
          await fetchAdmins();
          setProcessingId(null);
          return;
        }
        throw createError;
      }
      
      if (!newAdmin) throw new Error('Failed to create admin account');

      // Send credentials email
      const emailConfig = createAdminCredentialsEmail(
        {
          name: newAdminData.name,
          email: newAdminData.email,
          phone: newAdminData.phone,
          password: password
        },
        `${window.location.origin}/admin/login`
      );

      const emailResult = await sendEmailWithDetails(emailConfig);

      if (emailResult.success) {
        toast({
          title: language === 'en' ? 'Admin Created' : 'Admin Créé',
          description: language === 'en' 
            ? `Admin account created successfully. Credentials sent to ${newAdminData.email}`
            : `Compte admin créé avec succès. Identifiants envoyés à ${newAdminData.email}`,
        });
      } else {
        console.error('Email sending failed:', emailResult.error);
        toast({
          title: language === 'en' ? 'Admin Created - Email Failed' : 'Admin Créé - Email Échoué',
          description: language === 'en' 
            ? `Admin account created, but email failed: ${emailResult.error || 'Unknown error'}. Please check the password manually.`
            : `Compte admin créé, mais l'email a échoué: ${emailResult.error || 'Erreur inconnue'}. Veuillez vérifier le mot de passe manuellement.`,
          variant: 'destructive',
          duration: 10000,
        });
      }

      // Reset form and close dialog
      setNewAdminData({ name: '', email: '', phone: '' });
      setIsAddAdminDialogOpen(false);
      
      // Refresh admins list
      await fetchAdmins();
    } catch (error: any) {
      console.error('Error creating admin:', error);
      
      // Provide more specific error message
      let errorMessage = language === 'en' ? 'Failed to create admin account' : 'Échec de la création du compte admin';
      
      if (error?.code === '42501' || error?.message?.includes('policy') || error?.message?.includes('permission')) {
        errorMessage = language === 'en' 
          ? 'Permission denied. Please run FIX_ADMIN_INSERT_POLICY.sql in Supabase SQL Editor.'
          : 'Permission refusée. Veuillez exécuter FIX_ADMIN_INSERT_POLICY.sql dans l\'éditeur SQL Supabase.';
      } else if (error?.code === '23505' || error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
        errorMessage = language === 'en' 
          ? 'An admin with this email already exists.'
          : 'Un admin avec cet email existe déjà.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Edit admin
  const handleEditAdmin = async () => {
    if (!editingAdmin || !editingAdmin.name || !editingAdmin.email) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' ? 'Name and email are required' : 'Le nom et l\'email sont requis',
        variant: 'destructive',
      });
      return;
    }

    setProcessingId(`edit-admin-${editingAdmin.id}`);
    
    try {
      const updatePayload: any = {
        name: editingAdmin.name,
        email: editingAdmin.email,
        role: editingAdmin.role,
        is_active: editingAdmin.is_active,
      };
      
      // Only include phone if it's provided (column might not exist)
      if (editingAdmin.phone !== undefined) {
        if (editingAdmin.phone && editingAdmin.phone.trim() !== '') {
          updatePayload.phone = editingAdmin.phone;
        } else {
          updatePayload.phone = null;
        }
      }
      
      const { error: updateError } = await supabase
        .from('admins')
        .update(updatePayload)
        .eq('id', editingAdmin.id);
      
      if (updateError) {
        // If error is about missing phone column, try without it
        if (updateError.message?.includes('phone')) {
          const { error: retryError } = await supabase
            .from('admins')
            .update({
              name: editingAdmin.name,
              email: editingAdmin.email,
              role: editingAdmin.role,
              is_active: editingAdmin.is_active,
            })
            .eq('id', editingAdmin.id);
          
          if (retryError) throw retryError;
        } else {
          throw updateError;
        }
      }

      toast({
        title: language === 'en' ? 'Admin Updated' : 'Admin Modifié',
        description: language === 'en' 
          ? 'Admin account updated successfully'
          : 'Compte admin modifié avec succès',
      });

      // Reset form and close dialog
      setEditingAdmin(null);
      setIsEditAdminDialogOpen(false);
      
      // Refresh admins list
      await fetchAdmins();
    } catch (error: any) {
      console.error('Error updating admin:', error);
      
      let errorMessage = language === 'en' ? 'Failed to update admin account' : 'Échec de la modification du compte admin';
      
      if (error?.code === '42501' || error?.message?.includes('policy') || error?.message?.includes('permission')) {
        errorMessage = language === 'en' 
          ? 'Permission denied. Please check your admin permissions.'
          : 'Permission refusée. Veuillez vérifier vos permissions d\'admin.';
      } else if (error?.code === '23505' || error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
        errorMessage = language === 'en' 
          ? 'An admin with this email already exists.'
          : 'Un admin avec cet email existe déjà.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Delete admin
  const handleDeleteAdmin = async (adminId: string) => {
    // Prevent deleting yourself
    if (adminId === currentAdminId) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'You cannot delete your own account'
          : 'Vous ne pouvez pas supprimer votre propre compte',
        variant: 'destructive',
      });
      return;
    }

    // Confirm deletion
    const confirmMessage = language === 'en' 
      ? 'Are you sure you want to delete this admin? This action cannot be undone.'
      : 'Êtes-vous sûr de vouloir supprimer cet admin? Cette action ne peut pas être annulée.';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setProcessingId(`delete-admin-${adminId}`);
    
    try {
      const { error: deleteError } = await supabase
        .from('admins')
        .delete()
        .eq('id', adminId);
      
      if (deleteError) {
        throw deleteError;
      }

      toast({
        title: language === 'en' ? 'Admin Deleted' : 'Admin Supprimé',
        description: language === 'en' 
          ? 'Admin account deleted successfully'
          : 'Compte admin supprimé avec succès',
      });
      
      // Refresh admins list
      await fetchAdmins();
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      
      let errorMessage = language === 'en' ? 'Failed to delete admin account' : 'Échec de la suppression du compte admin';
      
      if (error?.code === '42501' || error?.message?.includes('policy') || error?.message?.includes('permission')) {
        errorMessage = language === 'en' 
          ? 'Permission denied. Please check your admin permissions.'
          : 'Permission refusée. Veuillez vérifier vos permissions d\'admin.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Fetch admins when role is super_admin
  useEffect(() => {
    if (currentAdminRole === 'super_admin') {
      fetchAdmins();
    }
  }, [currentAdminRole]);

  // Protect super_admin-only tabs: redirect regular admins away from logs, settings, admins tabs
  useEffect(() => {
    if (currentAdminRole && currentAdminRole !== 'super_admin') {
      // If regular admin tries to access super_admin-only tabs, redirect to overview
      if (activeTab === 'logs' || activeTab === 'settings' || activeTab === 'admins') {
        setActiveTab('overview');
      }
    }
  }, [activeTab, currentAdminRole]);

  // Load passes when editing dialog opens for an existing event
  useEffect(() => {
    const loadPassesForEditing = async () => {
      // Only run if dialog is open, we're editing (has id), and passes are missing or empty
      if (isEventDialogOpen && editingEvent?.id && (!editingEvent.passes || editingEvent.passes.length === 0)) {
        
        const { data: passesData, error: passesError } = await supabase
          .from('event_passes')
          .select('*')
          .eq('event_id', editingEvent.id)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true });
        
        if (passesError && passesError.code !== 'PGRST116' && passesError.message !== 'relation "public.event_passes" does not exist') {
          console.error(`Error fetching passes in useEffect:`, passesError);
          return;
        }
        
        const mappedPasses = (passesData || []).map((p: any) => ({
          id: p.id,
          name: p.name || '',
          price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
          description: p.description || '',
          is_primary: p.is_primary || false
        }));
        
        setEditingEvent(prev => prev ? { ...prev, passes: mappedPasses } : null);
      }
    };
    
    loadPassesForEditing();
  }, [isEventDialogOpen, editingEvent?.id, language]);

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
      else {
        // Fetch passes for each event
        const eventsWithPasses = await Promise.all(
          (eventsData || []).map(async (event) => {
            const { data: passesData, error: passesError } = await supabase
              .from('event_passes')
              .select('*')
              .eq('event_id', event.id)
              .order('is_primary', { ascending: false })
              .order('created_at', { ascending: true });

            // Handle 404 errors gracefully (table might not exist yet)
            if (passesError) {
              // Only log non-404 errors
              if (passesError.code !== 'PGRST116' && passesError.message !== 'relation "public.event_passes" does not exist') {
                console.error(`Error fetching passes for event ${event.id}:`, passesError);
              }
              return { ...event, passes: [], instagram_link: event.whatsapp_link }; // Map database field to UI field
            }

            const mappedPasses = (passesData || []).map((p: any) => ({
              id: p.id,
              name: p.name || '',
              price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
              description: p.description || '',
              is_primary: p.is_primary || false
            }));

            return { ...event, passes: mappedPasses, instagram_link: event.whatsapp_link }; // Map database field to UI field
          })
        );

        setEvents(eventsWithPasses);
      }



      // Fetch ambassadors
      const { data: ambassadorsData, error: ambassadorsError } = await supabase
        .from('ambassadors')
        .select('*')
        .order('created_at', { ascending: false });

      if (ambassadorsError) console.error('Error fetching ambassadors:', ambassadorsError);
      else setAmbassadors(ambassadorsData || []);

      // Fetch sales for all ambassadors
      if (ambassadorsData && ambassadorsData.length > 0) {
        const { data: salesData, error: salesError } = await (supabase as any)
          .from('clients')
          .select('ambassador_id, standard_tickets, vip_tickets');
        if (salesError) {
          // Only log if it's not a handled error (e.g., table doesn't exist is expected)
          if (salesError.code !== '42P01' && salesError.code !== 'PGRST116') {
            console.error('Error fetching ambassador sales:', salesError);
          }
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

      await fetchSalesSettingsData();
      await fetchMaintenanceSettings();
      await fetchAmbassadorApplicationSettings();
      await fetchHeroImages();
      await fetchAboutImages();
      // Marketing/SMS data will be loaded only when Marketing tab is opened
      // SMS Balance check removed - user must click button to check
      await loadFaviconSettings();
      await loadOGImageUrl();

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
            ville: (application.city === 'Sousse' || application.city === 'Tunis') ? (application.ville?.trim() || null) : null,
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
            ville: (application.city === 'Sousse' || application.city === 'Tunis') ? (application.ville?.trim() || null) : null,
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

      // Update application status via API route (bypasses RLS)
      const response = await apiFetch(API_ROUTES.ADMIN_UPDATE_APPLICATION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId: application.id,
          status: 'approved'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error updating application status:', errorData);
        let errorMessage = language === 'en' ? 'Failed to approve application' : 'Échec de l\'approbation';
        if (errorData.details) {
          errorMessage = errorData.details;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const updateData = result.data ? [result.data] : null;

      // Verify the update worked
      if (!updateData || updateData.length === 0) {
        // Check if application still exists and what its status is
        const { data: verifyData } = await supabase
          .from('ambassador_applications')
          .select('id, status')
          .eq('id', application.id)
          .single();
        
        if (verifyData && verifyData.status !== 'approved') {
          console.error('Application status was not updated. Current status:', verifyData.status);
          throw new Error(`Failed to update application status. Current status: ${verifyData.status}. Check RLS policies.`);
        }
      }

      // Store credentials for potential resend (before email attempt)
      setAmbassadorCredentials(prev => ({
        ...prev,
        [application.id]: {
          username: username,
          password: password
        }
      }));

      // Set email status to pending
      setEmailStatus(prev => ({
        ...prev,
        [application.id]: 'pending'
      }));

      // Send approval email with credentials (plain password)
      let emailSent = false;
      let emailError: string | null = null;
      
      try {
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

        emailSent = await sendEmail(emailConfig);

        if (emailSent) {
          // Track successful email
          setEmailSentApplications(prev => new Set([...prev, application.id]));
          setEmailFailedApplications(prev => {
            const newSet = new Set(prev);
            newSet.delete(application.id);
            return newSet;
          });
          setEmailStatus(prev => ({
        ...prev,
            [application.id]: 'sent'
      }));
        } else {
          // Track failed email
        setEmailFailedApplications(prev => new Set([...prev, application.id]));
          setEmailSentApplications(prev => {
            const newSet = new Set(prev);
            newSet.delete(application.id);
            return newSet;
          });
          setEmailStatus(prev => ({
            ...prev,
            [application.id]: 'failed'
          }));
          emailError = 'Email delivery failed. Please use the Resend Email button to retry.';
        }
      } catch (error) {
        // Track failed email with error details
        emailError = error instanceof Error ? error.message : 'Unknown error occurred';
        setEmailFailedApplications(prev => new Set([...prev, application.id]));
        setEmailSentApplications(prev => {
          const newSet = new Set(prev);
          newSet.delete(application.id);
          return newSet;
        });
        setEmailStatus(prev => ({
          ...prev,
          [application.id]: 'failed'
        }));
        console.error('Error sending approval email:', error);
      }

      // Show appropriate toast notification
      if (emailSent) {
      toast({
        title: t.approvalSuccess,
          description: `${t.emailSent} - Credentials sent to ${application.email || application.phone_number}`,
        });
      } else {
        toast({
          title: t.approvalSuccess,
          description: emailError || "Application approved, but email failed to send. Use 'Resend Email' button to retry.",
          variant: "default",
        });
        // Show additional warning toast
        toast({
          title: language === 'en' ? '⚠️ Email Delivery Failed' : '⚠️ Échec de l\'envoi de l\'email',
          description: language === 'en' 
            ? `The approval email could not be sent to ${application.email || application.phone_number}. Please use the 'Resend Email' button to retry.`
            : `L'email d'approbation n'a pas pu être envoyé à ${application.email || application.phone_number}. Veuillez utiliser le bouton 'Renvoyer l'email' pour réessayer.`,
          variant: "destructive",
        });
      }

      // Update the application in the local state immediately for instant UI feedback
      setApplications(prev => prev.map(app => 
        app.id === application.id 
          ? { ...app, status: 'approved' as const }
          : app
      ));

      // Also update ambassadors list if a new one was created
      if (!existingAmbassador) {
        // Refresh ambassadors to include the new one
        const { data: newAmbassadors } = await supabase
          .from('ambassadors')
          .select('*')
          .order('created_at', { ascending: false });
        if (newAmbassadors) {
          setAmbassadors(newAmbassadors);
        }
      } else {
        // Update existing ambassador in the list
        setAmbassadors(prev => prev.map(amb => 
          amb.id === ambassadorId
            ? { 
                ...amb, 
                status: 'approved', 
                ville: (application.city === 'Sousse' || application.city === 'Tunis') ? (application.ville?.trim() || null) : null,
                updated_at: new Date().toISOString() 
              }
            : amb
        ));
      }

      // Then refresh all data to ensure consistency
      await fetchAllData();

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
  // Helper function to extract Instagram username and format it
  const formatInstagramLink = (link: string | undefined): { displayText: string; url: string } | null => {
    if (!link || link === '-') return null;
    
    let username = link.trim();
    
    // Remove common URL patterns
    username = username.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
    username = username.replace(/^instagram\.com\//i, '');
    username = username.replace(/^@/, '');
    username = username.replace(/\/$/, ''); // Remove trailing slash
    username = username.split('?')[0]; // Remove query parameters
    username = username.split('/')[0]; // Take only the first part
    
    if (!username) return null;
    
    // Format as @username
    const displayText = username.startsWith('@') ? username : `@${username}`;
    const url = `https://instagram.com/${username.replace('@', '')}`;
    
    return { displayText, url };
  };

  // Export approved ambassadors list to Excel with branded styling
  const exportApprovedAmbassadorsToExcel = async () => {
    try {
      const approvedAmbassadors = ambassadors.filter(amb => amb.status === 'approved');
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Approved Ambassadors');

      // Define colors matching Andiamo Events theme
      const darkBackground = { argb: 'FF2A2A2A' }; // Grey background (lighter than black)
      const darkCharcoal = { argb: 'FF3A3A3A' }; // Dark grey for headers
      const darkGray1 = { argb: 'FF2F2F2F' }; // Zebra stripe 1
      const darkGray2 = { argb: 'FF353535' }; // Zebra stripe 2
      const white = { argb: 'FFFFFFFF' }; // White text
      const lightGray = { argb: 'FFB0B0B0' }; // Light gray text
      const green = { argb: 'FF00C96D' }; // Green for active

      // Title row - merged cells with centered title
      worksheet.mergeCells('A1:H1');
      const titleRow = worksheet.getRow(1);
      titleRow.height = 30;
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'ANDIAMO EVENTS – APPROVED AMBASSADORS LIST';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: white };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: darkBackground
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.getCell(1).border = {
        top: { style: 'thin', color: { argb: 'FF3A3A3A' } },
        bottom: { style: 'thin', color: { argb: 'FF3A3A3A' } },
        left: { style: 'thin', color: { argb: 'FF3A3A3A' } },
        right: { style: 'thin', color: { argb: 'FF3A3A3A' } }
      };

      // Empty row for spacing
      worksheet.getRow(2).height = 10;

      // Headers row
      const headers = ['Name', 'Age', 'Phone', 'Email', 'City', 'Ville', 'Instagram', 'Joined Date'];
      const headerRow = worksheet.getRow(3);
      headerRow.height = 25;
      
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { name: 'Arial', size: 11, bold: true, color: white };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: darkCharcoal
        };
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF3A3A3A' } },
          bottom: { style: 'thin', color: { argb: 'FF3A3A3A' } },
          left: { style: 'thin', color: { argb: 'FF3A3A3A' } },
          right: { style: 'thin', color: { argb: 'FF3A3A3A' } }
        };
      });

      // Set column widths
      worksheet.getColumn(1).width = 25; // Name
      worksheet.getColumn(2).width = 8;  // Age
      worksheet.getColumn(3).width = 15; // Phone
      worksheet.getColumn(4).width = 30; // Email
      worksheet.getColumn(5).width = 15; // City
      worksheet.getColumn(6).width = 15; // Ville
      worksheet.getColumn(7).width = 25; // Instagram
      worksheet.getColumn(8).width = 15; // Joined Date

      // Fetch age and social_link for each ambassador from applications
      const ambassadorsWithAge = await Promise.all(
        approvedAmbassadors.map(async (ambassador) => {
          let age: number | undefined = ambassador.age;
          let socialLink: string | undefined = ambassador.social_link;
          
          // If age or social_link not in ambassador object, fetch from application
          if (!age || !socialLink) {
            const { data: appData } = await supabase
              .from('ambassador_applications')
              .select('age, social_link')
              .eq('phone_number', ambassador.phone)
              .eq('status', 'approved')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (appData) {
              if (!age) age = appData.age;
              if (!socialLink) socialLink = appData.social_link;
            }
          }
          
          return { ...ambassador, age: age || 0, social_link: socialLink };
        })
      );

      // Data rows with alternating colors
      ambassadorsWithAge.forEach((ambassador, index) => {
        const row = worksheet.getRow(index + 4);
        row.height = 20;
        
        // Alternating row colors (zebra pattern)
        const rowColor = index % 2 === 0 ? darkGray1 : darkGray2;

        const instagramInfo = formatInstagramLink(ambassador.social_link);
        const instagramDisplay = instagramInfo ? instagramInfo.displayText : '-';
        
        const cells = [
          ambassador.full_name,
          ambassador.age || 0,
          ambassador.phone,
          ambassador.email || '-',
          ambassador.city,
          ambassador.ville || '-',
          instagramDisplay,
          new Date(ambassador.created_at).toLocaleDateString()
        ];

        cells.forEach((value, cellIndex) => {
          const cell = row.getCell(cellIndex + 1);
          
          // Instagram column - make it a hyperlink if it's a valid URL
          if (cellIndex === 6 && instagramInfo) {
            cell.value = { text: instagramInfo.displayText, hyperlink: instagramInfo.url };
            cell.font = { name: 'Arial', size: 10, color: { argb: 'FF6B7280' }, underline: true };
          } else {
            cell.value = value;
            // Name and Phone in slightly bolder
            if (cellIndex === 0 || cellIndex === 2) {
              cell.font = { name: 'Arial', size: 10, bold: true, color: white };
            } else {
              cell.font = { name: 'Arial', size: 10, color: lightGray };
            }
          }
          
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: rowColor
          };
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF2A2A2A' } },
            bottom: { style: 'thin', color: { argb: 'FF2A2A2A' } },
            left: { style: 'thin', color: { argb: 'FF2A2A2A' } },
            right: { style: 'thin', color: { argb: 'FF2A2A2A' } }
          };
        });
      });

      // Add outer border to entire table
      const lastRow = ambassadorsWithAge.length + 3;
      for (let row = 1; row <= lastRow; row++) {
        for (let col = 1; col <= 8; col++) {
          const cell = worksheet.getCell(row, col);
          if (row === 1 || row === lastRow || col === 1 || col === 8) {
            if (!cell.border) cell.border = {};
            if (row === 1) cell.border.top = { style: 'medium', color: { argb: 'FF3A3A3A' } };
            if (row === lastRow) cell.border.bottom = { style: 'medium', color: { argb: 'FF3A3A3A' } };
            if (col === 1) cell.border.left = { style: 'medium', color: { argb: 'FF3A3A3A' } };
            if (col === 8) cell.border.right = { style: 'medium', color: { argb: 'FF3A3A3A' } };
          }
        }
      }

      // Add export date at bottom
      const footerRow = worksheet.getRow(lastRow + 2);
      footerRow.height = 20;
      const footerCell = worksheet.getCell(`A${lastRow + 2}`);
      footerCell.value = `Generated by Andiamo Events on ${new Date().toLocaleString()}`;
      footerCell.font = { name: 'Arial', size: 9, color: lightGray, italic: true };
      footerCell.alignment = { horizontal: 'right' };
      worksheet.mergeCells(`A${lastRow + 2}:H${lastRow + 2}`);

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      link.download = `Andiamo_Events_Approved_Ambassadors_${dateStr}_${timeStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: language === 'en' ? 'Export Successful' : 'Exportation réussie',
        description: language === 'en' 
          ? `Exported ${approvedAmbassadors.length} approved ambassadors to Excel`
          : `${approvedAmbassadors.length} ambassadeurs approuvés exportés vers Excel`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: language === 'en' ? 'Export Failed' : 'Échec de l\'exportation',
        description: language === 'en' 
          ? 'Failed to export ambassadors list. Please try again.'
          : 'Échec de l\'exportation de la liste des ambassadeurs. Veuillez réessayer.',
        variant: 'destructive',
      });
    }
  };

  // Export ambassadors list to Excel with branded styling
  const exportAmbassadorsToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ambassadors List');

      // Define colors matching Andiamo Events theme
      const darkBackground = { argb: 'FF2A2A2A' }; // Grey background (lighter than black)
      const darkCharcoal = { argb: 'FF3A3A3A' }; // Dark grey for headers
      const darkGray1 = { argb: 'FF2F2F2F' }; // Zebra stripe 1
      const darkGray2 = { argb: 'FF353535' }; // Zebra stripe 2
      const white = { argb: 'FFFFFFFF' }; // White text
      const lightGray = { argb: 'FFB0B0B0' }; // Light gray text
      const red = { argb: 'FFE21836' }; // Red accent
      const green = { argb: 'FF22C55E' }; // Green for approved
      const redStatus = { argb: 'FFEF4444' }; // Red for rejected/removed
      const orange = { argb: 'FFF97316' }; // Orange for pending
      const grey = { argb: 'FF6B7280' }; // Grey for suspended

      // Title row - merged cells with centered title
      worksheet.mergeCells('A1:I1');
      const titleRow = worksheet.getRow(1);
      titleRow.height = 30;
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'ANDIAMO EVENTS – AMBASSADORS LIST';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: white };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: darkBackground
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.getCell(1).border = {
        top: { style: 'thin', color: { argb: 'FF3A3A3A' } },
        bottom: { style: 'thin', color: { argb: 'FF3A3A3A' } },
        left: { style: 'thin', color: { argb: 'FF3A3A3A' } },
        right: { style: 'thin', color: { argb: 'FF3A3A3A' } }
      };

      // Empty row for spacing
      worksheet.getRow(2).height = 10;

      // Headers row
      const headers = ['Name', 'Age', 'Phone', 'Email', 'City', 'Ville', 'Status', 'Instagram', 'Applied Date'];
      const headerRow = worksheet.getRow(3);
      headerRow.height = 25;
      
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { name: 'Arial', size: 11, bold: true, color: white };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: darkCharcoal
        };
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF3A3A3A' } },
          bottom: { style: 'thin', color: { argb: 'FF3A3A3A' } },
          left: { style: 'thin', color: { argb: 'FF3A3A3A' } },
          right: { style: 'thin', color: { argb: 'FF3A3A3A' } }
        };
      });

      // Set column widths
      worksheet.getColumn(1).width = 25; // Name
      worksheet.getColumn(2).width = 8;  // Age
      worksheet.getColumn(3).width = 15; // Phone
      worksheet.getColumn(4).width = 30; // Email
      worksheet.getColumn(5).width = 15; // City
      worksheet.getColumn(6).width = 15; // Ville
      worksheet.getColumn(7).width = 12; // Status
      worksheet.getColumn(8).width = 25; // Instagram
      worksheet.getColumn(9).width = 15; // Applied Date

      // Data rows with alternating colors
      filteredApplications.forEach((application, index) => {
        const row = worksheet.getRow(index + 4);
        row.height = 20;
        
        // Alternating row colors (zebra pattern)
        const rowColor = index % 2 === 0 ? darkGray1 : darkGray2;
        
        // Get ville from application or matching ambassador
        let ville = application.ville || '';
        if (!ville && (application.city === 'Sousse' || application.city === 'Tunis')) {
          const matchingAmbassador = ambassadors.find(amb => 
            amb.phone === application.phone_number || 
            (application.email && amb.email === application.email)
          );
          ville = matchingAmbassador?.ville || '';
        }

        // Status color
        let statusColor = lightGray;
        let statusText = application.status;
        if (application.status === 'approved') {
          statusColor = green; // Green
          statusText = 'Active';
        } else if (application.status === 'pending') {
          statusColor = orange; // Orange
          statusText = 'Pending';
        } else if (application.status === 'rejected') {
          statusColor = redStatus; // Red
          statusText = 'Rejected';
        } else if (application.status === 'removed') {
          statusColor = redStatus; // Red
          statusText = 'Removed';
        } else if (application.status === 'suspended') {
          statusColor = grey; // Grey
          statusText = 'Paused';
        }

        const instagramInfo = formatInstagramLink(application.social_link);
        const instagramDisplay = instagramInfo ? instagramInfo.displayText : '-';
        
        const cells = [
          application.full_name,
          application.age || 0,
          application.phone_number,
          application.email || '-',
          application.city,
          ville || '-',
          statusText,
          instagramDisplay,
          new Date(application.created_at).toLocaleDateString()
        ];

        cells.forEach((value, cellIndex) => {
          const cell = row.getCell(cellIndex + 1);
          
          // Instagram column - make it a hyperlink if it's a valid URL
          if (cellIndex === 7 && instagramInfo) {
            cell.value = { text: instagramInfo.displayText, hyperlink: instagramInfo.url };
            cell.font = { name: 'Arial', size: 10, color: { argb: 'FF6B7280' }, underline: true };
          } else {
            cell.value = value;
            // Status column gets special color
            if (cellIndex === 6) {
              cell.font = { name: 'Arial', size: 10, bold: true, color: statusColor };
            } else if (cellIndex === 0 || cellIndex === 2) {
              // Name and Phone in slightly bolder
              cell.font = { name: 'Arial', size: 10, bold: true, color: white };
            } else {
              cell.font = { name: 'Arial', size: 10, color: lightGray };
            }
          }
          
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: rowColor
          };
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF2A2A2A' } },
            bottom: { style: 'thin', color: { argb: 'FF2A2A2A' } },
            left: { style: 'thin', color: { argb: 'FF2A2A2A' } },
            right: { style: 'thin', color: { argb: 'FF2A2A2A' } }
          };
        });
      });

      // Add outer border to entire table
      const lastRow = filteredApplications.length + 3;
      for (let row = 1; row <= lastRow; row++) {
        for (let col = 1; col <= 9; col++) {
          const cell = worksheet.getCell(row, col);
          if (row === 1 || row === lastRow || col === 1 || col === 9) {
            if (!cell.border) cell.border = {};
            if (row === 1) cell.border.top = { style: 'medium', color: { argb: 'FF3A3A3A' } };
            if (row === lastRow) cell.border.bottom = { style: 'medium', color: { argb: 'FF3A3A3A' } };
            if (col === 1) cell.border.left = { style: 'medium', color: { argb: 'FF3A3A3A' } };
            if (col === 9) cell.border.right = { style: 'medium', color: { argb: 'FF3A3A3A' } };
          }
        }
      }

      // Add export date at bottom
      const footerRow = worksheet.getRow(lastRow + 2);
      footerRow.height = 20;
      const footerCell = worksheet.getCell(`A${lastRow + 2}`);
      footerCell.value = `Generated by Andiamo Events on ${new Date().toLocaleString()}`;
      footerCell.font = { name: 'Arial', size: 9, color: lightGray, italic: true };
      footerCell.alignment = { horizontal: 'right' };
      worksheet.mergeCells(`A${lastRow + 2}:I${lastRow + 2}`);

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      link.download = `Andiamo_Events_Ambassadors_List_${dateStr}_${timeStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: language === 'en' ? 'Export Successful' : 'Exportation réussie',
        description: language === 'en' 
          ? `Exported ${filteredApplications.length} ambassadors to Excel`
          : `${filteredApplications.length} ambassadeurs exportés vers Excel`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: language === 'en' ? 'Export Failed' : 'Échec de l\'exportation',
        description: language === 'en' 
          ? 'Failed to export ambassadors list. Please try again.'
          : 'Échec de l\'exportation de la liste des ambassadeurs. Veuillez réessayer.',
        variant: 'destructive',
      });
    }
  };

  const resendEmail = async (application: AmbassadorApplication) => {
    setProcessingId(application.id);
    
    try {
      // Normalize phone number (remove spaces, dashes, etc. for better matching)
      const normalizePhone = (phone: string) => {
        return phone.replace(/[\s\-\(\)]/g, '').trim();
      };
      
      const normalizedPhone = normalizePhone(application.phone_number);
      
      // Try multiple lookup strategies to find the ambassador
      let ambassador = null;
      
      // Strategy 1: Try exact phone match first
      let { data: ambassadorByPhone } = await supabase
        .from('ambassadors')
        .select('id, email, phone, full_name')
        .eq('phone', application.phone_number)
        .maybeSingle();
      
      if (ambassadorByPhone) {
        ambassador = ambassadorByPhone;
      } else {
        // Strategy 2: Try phone match with different formats (remove common formatting)
        // Try variations: with/without spaces, with/without country code prefix
        const phoneVariations = [
          application.phone_number.replace(/\s/g, ''), // Remove spaces
          application.phone_number.replace(/[\s\-]/g, ''), // Remove spaces and dashes
          application.phone_number.replace(/^\+216/, ''), // Remove +216 prefix
          application.phone_number.replace(/^216/, ''), // Remove 216 prefix
        ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
        
        for (const phoneVar of phoneVariations) {
          if (phoneVar === application.phone_number) continue; // Already tried
          
          const { data: ambByVar } = await supabase
            .from('ambassadors')
            .select('id, email, phone, full_name')
            .eq('phone', phoneVar)
            .maybeSingle();
          
          if (ambByVar) {
            ambassador = ambByVar;
            break;
          }
        }
        
        // Strategy 3: If still not found and we have an email, try by email
        if (!ambassador && application.email) {
          const { data: ambassadorByEmail } = await supabase
            .from('ambassadors')
            .select('id, email, phone, full_name')
            .eq('email', application.email)
            .maybeSingle();
          
          if (ambassadorByEmail) {
            ambassador = ambassadorByEmail;
          }
        }
      }

      if (!ambassador) {
        console.error('❌ Ambassador not found for resend email:', {
          applicationId: application.id,
          phoneNumber: application.phone_number,
          normalizedPhone: normalizedPhone,
          email: application.email,
          applicationStatus: application.status,
          fullName: application.full_name
        });
        
        // Log available ambassadors for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
          const { data: allAmbassadors } = await supabase
            .from('ambassadors')
            .select('id, phone, email, full_name')
            .limit(10);
        }
        
        toast({
          title: t.error,
          description: language === 'en' 
            ? `Ambassador not found for phone ${application.phone_number}. Please verify the ambassador exists and try again, or approve the application again if needed.` 
            : `Ambassadeur introuvable pour le téléphone ${application.phone_number}. Veuillez vérifier que l'ambassadeur existe et réessayer, ou approuver à nouveau la candidature si nécessaire.`,
          variant: "destructive",
        });
        setProcessingId(null);
        return;
      }
      
      // Determine the email address to use - prefer application email, fallback to ambassador email
      const emailToUse = application.email || ambassador.email;
      
      // Validate that we have an email address
      if (!emailToUse || !emailToUse.trim()) {
        toast({
          title: language === 'en' ? "❌ Email Address Required" : "❌ Adresse email requise",
          description: language === 'en' 
            ? "No email address found for this ambassador. Please add an email address to the ambassador record or application before resending."
            : "Aucune adresse email trouvée pour cet ambassadeur. Veuillez ajouter une adresse email à l'enregistrement de l'ambassadeur ou à la candidature avant de renvoyer.",
          variant: "destructive",
        });
        setProcessingId(null);
        return;
      }

      // Check if this is a manually added ambassador
      const isManual = application.manually_added;
      // For manually added, we need to find the actual application record
      let actualApplicationId = application.id;
      if (isManual) {
        // Find the application record for this manually added ambassador
        const result: any = await (supabase as any)
          .from('ambassador_applications')
          .select('id')
          .eq('phone_number', application.phone_number)
          .eq('status', 'approved')
          .eq('manually_added', true)
          .maybeSingle();
        const appRecord = result?.data || result;
        if (appRecord) {
          actualApplicationId = appRecord.id;
        }
      }

      // Check if we have credentials in state, if not, generate new ones
      let credentials = ambassadorCredentials[actualApplicationId];
      let password = credentials?.password;
      let needsPasswordUpdate = false;

      if (!credentials || !password) {
        // Generate new credentials
        password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Update ambassador's password in database
        const { error: updateError } = await supabase
          .from('ambassadors')
          .update({ 
            password: hashedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', ambassador.id);

        if (updateError) {
          console.error('Error updating ambassador password:', updateError);
          toast({
            title: t.error,
            description: language === 'en' 
              ? "Failed to update ambassador password. Please try again." 
              : "Échec de la mise à jour du mot de passe de l'ambassadeur. Veuillez réessayer.",
            variant: "destructive",
          });
          setProcessingId(null);
          return;
        }

        // Store new credentials in state
        credentials = {
          username: application.phone_number,
          password: password
        };
        setAmbassadorCredentials(prev => ({
          ...prev,
          [actualApplicationId]: credentials!
        }));
        needsPasswordUpdate = true;
      }

      // Set status to pending
      setEmailStatus(prev => ({
        ...prev,
        [actualApplicationId]: 'pending'
      }));

      const emailConfig = createApprovalEmail(
        {
          fullName: application.full_name,
          phone: application.phone_number,
          email: emailToUse, // Use the validated email address
          city: application.city,
          password: password
        },
        `${window.location.origin}/ambassador/auth`,
        ambassador.id
      );

      let emailSent = false;
      let emailError: string | null = null;

      try {
        const emailResult = await sendEmailWithDetails(emailConfig);
        emailSent = emailResult.success;
        emailError = emailResult.error || null;

        if (emailSent) {
          // Update status to sent
          setEmailSentApplications(prev => new Set([...prev, actualApplicationId]));
          setEmailFailedApplications(prev => {
            const newSet = new Set(prev);
            newSet.delete(actualApplicationId);
            return newSet;
          });
          setEmailStatus(prev => ({
            ...prev,
            [actualApplicationId]: 'sent'
          }));

          toast({
            title: language === 'en' ? "✅ Email Sent Successfully" : "✅ Email envoyé avec succès",
            description: language === 'en' 
              ? needsPasswordUpdate
                ? `Approval email with new credentials has been successfully delivered to ${emailToUse}`
                : `Approval email has been successfully delivered to ${emailToUse}`
              : needsPasswordUpdate
                ? `L'email d'approbation avec de nouvelles identifiants a été envoyé avec succès à ${emailToUse}`
                : `L'email d'approbation a été envoyé avec succès à ${emailToUse}`,
          });
        } else {
          // Update status to failed
          setEmailFailedApplications(prev => new Set([...prev, actualApplicationId]));
          setEmailSentApplications(prev => {
            const newSet = new Set(prev);
            newSet.delete(actualApplicationId);
            return newSet;
          });
          setEmailStatus(prev => ({
            ...prev,
            [actualApplicationId]: 'failed'
          }));

          // Use the actual error message from the server if available
          const errorMessage = emailError || 'Email delivery failed. Please check the email address and try again.';

          toast({
            title: language === 'en' ? "❌ Email Failed to Send" : "❌ Échec de l'envoi de l'email",
            description: language === 'en' 
              ? `The email could not be sent to ${emailToUse}. ${errorMessage}`
              : `L'email n'a pas pu être envoyé à ${emailToUse}. ${errorMessage}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        emailError = error instanceof Error ? error.message : 'Unknown error occurred';
        setEmailFailedApplications(prev => new Set([...prev, actualApplicationId]));
        setEmailSentApplications(prev => {
          const newSet = new Set(prev);
          newSet.delete(actualApplicationId);
          return newSet;
        });
        setEmailStatus(prev => ({
          ...prev,
          [actualApplicationId]: 'failed'
        }));

        toast({
          title: language === 'en' ? "❌ Email Error" : "❌ Erreur d'email",
          description: language === 'en' 
            ? `Failed to send email: ${emailError}`
            : `Échec de l'envoi de l'email : ${emailError}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error resending email:', error);
      // Try to find the actual application ID for manually added
      let actualApplicationId = application.id;
      if (application.manually_added) {
        const result: any = await (supabase as any)
          .from('ambassador_applications')
          .select('id')
          .eq('phone_number', application.phone_number)
          .eq('status', 'approved')
          .eq('manually_added', true)
          .maybeSingle();
        const appRecord = result?.data || result;
        if (appRecord) {
          actualApplicationId = appRecord.id;
        }
      }
      setEmailStatus(prev => ({
        ...prev,
        [actualApplicationId]: 'failed'
      }));
      toast({
        title: t.error,
        description: language === 'en' 
          ? "An unexpected error occurred while resending the email. Please try again."
          : "Une erreur inattendue s'est produite lors de la nouvelle tentative d'envoi. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const updateSalesSettingsData = async (enabled: boolean) => {
    setLoadingSalesSettings(true);
    try {
      await updateSalesSettings(enabled);
      setSalesEnabled(enabled);
      toast({
        title: language === 'en' ? 'Settings Updated' : 'Paramètres Mis à Jour',
        description: enabled
          ? (language === 'en' ? 'Sales are now enabled for ambassadors' : 'Les ventes sont maintenant activées pour les ambassadeurs')
          : (language === 'en' ? 'Sales are now disabled for ambassadors' : 'Les ventes sont maintenant désactivées pour les ambassadeurs'),
      });
      await fetchSalesSettingsData();
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

  const updateMaintenanceSettings = async (enabled: boolean, message?: string, allowAmbassador?: boolean) => {
    setLoadingMaintenanceSettings(true);
    try {
      const { error } = await supabase
        .from('site_content')
        .upsert({
          key: 'maintenance_settings',
          content: { 
            enabled, 
            message: message !== undefined ? message : maintenanceMessage, 
            allowAmbassadorApplication: allowAmbassador !== undefined ? allowAmbassador : allowAmbassadorApplication
          },
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
      if (allowAmbassador !== undefined) {
        setAllowAmbassadorApplication(allowAmbassador);
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
      // Check if this is a manually added ambassador
      const isManual = application.manually_added;
      let actualApplicationId = application.id;
      
      if (isManual) {
        // Find the application record for this manually added ambassador
        const { data: appRecord } = await supabase
          .from('ambassador_applications')
          .select('id')
          .eq('phone_number', application.phone_number)
          .eq('status', 'approved')
          .eq('manually_added', true)
          .maybeSingle();
        if (appRecord) {
          actualApplicationId = appRecord.id;
        }
      }

      let credentials = ambassadorCredentials[actualApplicationId];
      
      // If credentials not found, try to get from ambassador
      if (!credentials) {
        const { data: ambassador } = await supabase
          .from('ambassadors')
          .select('id, phone')
          .eq('phone', application.phone_number)
          .maybeSingle();
        
        if (ambassador) {
          // Generate new credentials for display
          const password = generatePassword();
          credentials = {
            username: application.phone_number,
            password: password
          };
        }
      }

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
      // Calculate reapply delay date (30 days from now)
      const REAPPLY_DELAY_DAYS = 30;
      const reapplyDelayDate = new Date();
      reapplyDelayDate.setDate(reapplyDelayDate.getDate() + REAPPLY_DELAY_DAYS);

      // Update application status and reapply_delay_date via API route (bypasses RLS)
      const response = await apiFetch(API_ROUTES.ADMIN_UPDATE_APPLICATION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId: application.id,
          status: 'rejected',
          reapply_delay_date: reapplyDelayDate.toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error updating application status:', errorData);
        let errorMessage = language === 'en' ? 'Failed to reject application' : 'Échec du rejet';
        if (errorData.details) {
          errorMessage = errorData.details;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const updateData = result.data ? [result.data] : null;

      // Verify the update worked
      if (!updateData || updateData.length === 0) {
        // Check if application still exists and what its status is
        const { data: verifyData } = await supabase
          .from('ambassador_applications')
          .select('id, status')
          .eq('id', application.id)
          .single();
        
        if (verifyData && verifyData.status !== 'rejected') {
          console.error('Application status was not updated. Current status:', verifyData.status);
          throw new Error(`Failed to update application status. Current status: ${verifyData.status}. Check RLS policies.`);
        }
      }

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

      // Update the application in the local state immediately for instant UI feedback
      setApplications(prev => prev.map(app => 
        app.id === application.id 
          ? { ...app, status: 'rejected' as const }
          : app
      ));

      // Then refresh all data to ensure consistency
      await fetchAllData();

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
      // Validate Instagram link
      if (event.instagram_link && !isInstagramUrl(event.instagram_link)) {
        toast({
          title: language === 'en' ? "Invalid Instagram Link" : "Lien Instagram Invalide",
          description: language === 'en' 
            ? "Please enter a valid Instagram URL (e.g., https://www.instagram.com/username)" 
            : "Veuillez entrer une URL Instagram valide (ex: https://www.instagram.com/username)",
          variant: "destructive",
        });
        return;
      }
      // Validate passes before saving
      const passes = event.passes || [];
      
      // Ensure at least one pass exists
      if (passes.length === 0) {
        toast({
          title: t.error,
          description: language === 'en' 
            ? 'At least one pass (Standard) is required' 
            : 'Au moins un pass (Standard) est requis',
          variant: "destructive",
        });
        return;
      }

      // Validate passes with strict rules
      if (!passes || passes.length === 0) {
        toast({
          title: language === 'en' ? "Validation Error" : "Erreur de validation",
          description: language === 'en' 
            ? "At least one pass is required. You cannot publish an event without passes." 
            : "Au moins un pass est requis. Vous ne pouvez pas publier un événement sans passes.",
          variant: "destructive",
        });
        return;
      }

      // Count primary passes
      const primaryPassCount = passes.filter(p => p.is_primary).length;
      if (primaryPassCount === 0) {
        toast({
          title: language === 'en' ? "Validation Error" : "Erreur de validation",
          description: language === 'en' 
            ? "Exactly one primary pass is required. Please mark one pass as primary." 
            : "Exactement un pass principal est requis. Veuillez marquer un pass comme principal.",
          variant: "destructive",
        });
        return;
      }
      if (primaryPassCount > 1) {
        toast({
          title: language === 'en' ? "Validation Error" : "Erreur de validation",
          description: language === 'en' 
            ? "Only one primary pass is allowed. Please ensure exactly one pass is marked as primary." 
            : "Un seul pass principal est autorisé. Veuillez vous assurer qu'exactement un pass est marqué comme principal.",
          variant: "destructive",
        });
        return;
      }

      // Validate each pass - collect all errors
      const errors: Record<number, {name?: string; price?: string; description?: string}> = {};
      const passNames = new Set<string>();
      let hasErrors = false;

      for (let i = 0; i < passes.length; i++) {
        const pass = passes[i];
        const passErrors: {name?: string; price?: string; description?: string} = {};

        // Check required fields - Name
        if (!pass.name || pass.name.trim() === '') {
          passErrors.name = language === 'en' 
            ? 'Pass name is required' 
            : 'Le nom du pass est requis';
          hasErrors = true;
        }

        // Check for unique names (case-insensitive) - only if name is provided
        if (pass.name && pass.name.trim() !== '') {
          const normalizedName = pass.name.trim().toLowerCase();
          if (passNames.has(normalizedName)) {
            passErrors.name = language === 'en' 
              ? `Duplicate pass name. Pass names must be unique.` 
              : `Nom de pass dupliqué. Les noms de passes doivent être uniques.`;
            hasErrors = true;
          } else {
            passNames.add(normalizedName);
          }
        }

        // Check required fields - Price MUST be > 0
        if (pass.price === undefined || pass.price === null || isNaN(pass.price) || pass.price <= 0) {
          passErrors.price = language === 'en' 
            ? 'Price is required and must be greater than 0 TND' 
            : 'Le prix est requis et doit être supérieur à 0 TND';
          hasErrors = true;
        }

        // Description is optional, but if provided, it should not be empty
        if (pass.description !== undefined && pass.description !== null && pass.description.trim() === '') {
          // Allow empty description, but if it's explicitly set to empty string, that's fine
          // Only validate if it's a required field (which it's not according to requirements)
        }

        if (Object.keys(passErrors).length > 0) {
          errors[i] = passErrors;
        }
      }

      // Set validation errors and prevent save if there are errors
      setPassValidationErrors(errors);
      
      if (hasErrors) {
        // Don't show toast - errors are displayed inline in the dialog
        // Scroll to first error if needed
        setTimeout(() => {
          const firstErrorField = document.querySelector('.border-red-500');
          if (firstErrorField) {
            firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return; // Don't close dialog, just return
      }

      // Clear errors if validation passes
      setPassValidationErrors({});

      // Passes are ready to save - no transformation needed
      const updatedPasses = passes;

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

      // Upload pending gallery files if event is gallery type
      let finalGalleryImages = event.gallery_images || [];
      let finalGalleryVideos = event.gallery_videos || [];
      
      if (event.event_type === 'gallery') {
        setUploadingGallery(true);
        try {
          // Upload pending images
          if (pendingGalleryImages.length > 0) {
            const uploadedImageUrls = await uploadPendingGalleryFiles('images');
            finalGalleryImages = [...finalGalleryImages, ...uploadedImageUrls];
          }
          
          // Upload pending videos
          if (pendingGalleryVideos.length > 0) {
            const uploadedVideoUrls = await uploadPendingGalleryFiles('videos');
            finalGalleryVideos = [...finalGalleryVideos, ...uploadedVideoUrls];
          }
        } catch (error) {
          console.error('Error uploading gallery files:', error);
          toast({
            title: language === 'en' ? "Upload failed" : "Échec du téléchargement",
            description: language === 'en' 
              ? "Failed to upload gallery files" 
              : "Échec du téléchargement des fichiers de galerie",
            variant: "destructive",
          });
          setUploadingGallery(false);
          return;
        } finally {
          setUploadingGallery(false);
        }
      }

      let eventId = event.id;

      // Convert date from datetime-local format to ISO string if needed
      let eventDate = event.date;
      if (eventDate) {
        // Check if date is in datetime-local format (YYYY-MM-DDTHH:mm) without timezone
        // ISO format includes 'Z' or timezone offset (+/-HH:mm)
        const isDatetimeLocal = eventDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        if (isDatetimeLocal) {
          // Convert datetime-local to ISO by creating a Date object
          const dateObj = new Date(eventDate);
          if (!isNaN(dateObj.getTime())) {
            eventDate = dateObj.toISOString();
          }
        }
      }

      if (event.id) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update({
            name: event.name,
            date: eventDate,
            venue: event.venue,
            city: event.city,
            description: event.description,
            poster_url: posterUrl,
            ticket_link: event.ticket_link,
            whatsapp_link: event.instagram_link, // Database column is still whatsapp_link, but we use instagram_link in UI
            featured: event.featured,
            event_type: event.event_type || 'upcoming',
            gallery_images: finalGalleryImages,
            gallery_videos: finalGalleryVideos,
            updated_at: new Date().toISOString()
          })
          .eq('id', event.id);

        if (error) throw error;

        // Update passes: delete existing and insert new ones
        // First, delete all existing passes for this event
        const { error: deleteError } = await supabase
          .from('event_passes')
          .delete()
          .eq('event_id', event.id);

        if (deleteError && deleteError.code !== 'PGRST116' && deleteError.message !== 'relation "public.event_passes" does not exist') {
          throw deleteError;
        }

        // Insert updated passes
        if (updatedPasses.length > 0) {
          const passesToInsert = updatedPasses.map(p => {
            // Ensure price is a valid number > 0 (NUMERIC(10, 2) in database)
            const price = typeof p.price === 'number' 
              ? Number(p.price.toFixed(2))
              : Number(parseFloat(String(p.price)).toFixed(2));
            
            if (price <= 0) {
              throw new Error(`Invalid price for pass "${p.name}": price must be > 0`);
            }
            
            return {
              event_id: event.id,
              name: p.name.trim(),
              price: price,
              description: p.description || '',
              is_primary: p.is_primary || false
            };
          });

          const { error: insertError } = await supabase
            .from('event_passes')
            .insert(passesToInsert);

          if (insertError) {
            throw insertError;
          }
        }
      } else {
        // Create new event
        const { data: newEventData, error } = await supabase
          .from('events')
          .insert({
            name: event.name,
            date: eventDate,
            venue: event.venue,
            city: event.city,
            description: event.description,
            poster_url: posterUrl,
            ticket_link: event.ticket_link,
            whatsapp_link: event.instagram_link, // Database column is still whatsapp_link, but we use instagram_link in UI
            featured: event.featured,
            event_type: event.event_type || 'upcoming',
            gallery_images: finalGalleryImages,
            gallery_videos: finalGalleryVideos
          })
          .select()
          .single();

        if (error) throw error;

        eventId = newEventData.id;

        // Insert passes for the new event
        if (updatedPasses.length > 0) {
          const passesToInsert = updatedPasses.map(p => {
            // Ensure price is a valid number > 0 (NUMERIC(10, 2) in database)
            const price = typeof p.price === 'number' 
              ? Number(p.price.toFixed(2))
              : Number(parseFloat(String(p.price)).toFixed(2));
            
            if (price <= 0) {
              throw new Error(`Invalid price for pass "${p.name}": price must be > 0`);
            }
            
            return {
              event_id: eventId,
              name: p.name.trim(),
              price: price,
              description: p.description || '',
              is_primary: p.is_primary || false
            };
          });

          const { error: insertError } = await supabase
            .from('event_passes')
            .insert(passesToInsert);

          if (insertError) {
            throw insertError;
          }
        }
      }

      toast({
        title: t.eventSaved,
        description: language === 'en' ? "Event saved successfully" : "Événement enregistré avec succès",
      });

      // Update local state immediately for instant UI feedback
      if (event.id) {
        // Update existing event in the list
        setEvents(prev => prev.map(e => 
          e.id === event.id
            ? { 
                ...e, 
                ...event, 
                poster_url: posterUrl, 
                passes: updatedPasses, 
                gallery_images: finalGalleryImages,
                gallery_videos: finalGalleryVideos,
                instagram_link: event.instagram_link,
                updated_at: new Date().toISOString() 
              }
            : e
        ));
      } else {
        // For new events, use the data returned from database and add passes/gallery
        const newEvent: Event = {
          ...newEventData,
          instagram_link: newEventData.whatsapp_link || event.instagram_link, // Map from database whatsapp_link to UI instagram_link
          passes: updatedPasses,
          gallery_images: finalGalleryImages,
          gallery_videos: finalGalleryVideos,
        };
        // Add to the beginning of the list (newest first)
        setEvents(prev => [newEvent, ...prev]);
      }

      // Clear pending files after successful save
      setPendingGalleryImages([]);
      setPendingGalleryVideos([]);
      setEditingEvent(null);
      setIsEventDialogOpen(false);
      
      // Invalidate events cache so frontend shows updated data
      invalidateEvents();
      
      // Refresh all data to ensure consistency (but don't wait for it to close dialog)
      // The optimistic update above already shows the event immediately
      fetchAllData().catch(err => {
        console.error('Error refreshing data after save:', err);
        // If refresh fails, the optimistic update is still there, so UI is fine
      });

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

  // Validation functions
  const validateEmail = (email: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return false;
    // Remove all non-digit characters
    const cleanedPhone = phone.replace(/\D/g, '');
    // Check if it's exactly 8 digits and starts with 2, 4, 9, or 5
    return cleanedPhone.length === 8 && /^[2495]/.test(cleanedPhone);
  };

  const validatePassword = (password: string): boolean => {
    if (!password) return false;
    // Password must be at least 6 characters
    return password.length >= 6;
  };

  // Toggle ambassador status between approved and suspended
  const handleToggleAmbassadorStatus = async (ambassador: Ambassador) => {
    const newStatus = ambassador.status === 'approved' ? 'suspended' : 'approved';
    setProcessingId(ambassador.id);

    try {
      // Update ambassador status
      const { error: ambassadorError } = await supabase
        .from('ambassadors')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ambassador.id);

      if (ambassadorError) {
        console.error('Error updating ambassador status:', ambassadorError);
        throw ambassadorError;
      }

      // Find and update corresponding application(s) by phone number or email
      let matchingApplications: any[] = [];
      
      // Query by phone number
      const { data: phoneMatches, error: phoneError } = await supabase
        .from('ambassador_applications')
        .select('id')
        .eq('phone_number', ambassador.phone)
        .in('status', ['approved', 'suspended']);

      if (!phoneError && phoneMatches) {
        matchingApplications = phoneMatches;
      }

      // If email exists, also query by email and combine results
      if (ambassador.email) {
        const { data: emailMatches, error: emailError } = await supabase
          .from('ambassador_applications')
          .select('id')
          .eq('email', ambassador.email)
          .in('status', ['approved', 'suspended']);

        if (!emailError && emailMatches) {
          // Combine results, avoiding duplicates
          const existingIds = new Set(matchingApplications.map(app => app.id));
          emailMatches.forEach(app => {
            if (!existingIds.has(app.id)) {
              matchingApplications.push(app);
            }
          });
        }
      }

      if (matchingApplications && matchingApplications.length > 0) {
        // Update all matching applications
        const { error: updateAppError } = await supabase
          .from('ambassador_applications')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .in('id', matchingApplications.map(app => app.id));

        if (updateAppError) {
          console.error('Error updating application status:', updateAppError);
          // Show warning but continue - ambassador update succeeded
          toast({
            title: language === 'en' ? '⚠️ Partial Update' : '⚠️ Mise à Jour Partielle',
            description: language === 'en' 
              ? `Ambassador status updated, but application status update failed: ${updateAppError.message}`
              : `Statut de l'ambassadeur mis à jour, mais la mise à jour du statut de la candidature a échoué : ${updateAppError.message}`,
            variant: 'destructive',
          });
        } else {
          // Update local state for applications
          setApplications(prev => prev.map(app => {
            const phoneMatch = app.phone_number === ambassador.phone;
            const emailMatch = ambassador.email && app.email && app.email === ambassador.email;
            if ((phoneMatch || emailMatch) && (app.status === 'approved' || app.status === 'suspended')) {
              return { ...app, status: newStatus as 'approved' | 'suspended' };
            }
            return app;
          }));
        }
      } else {
        // No matching applications found - this is okay, might be a manually added ambassador
      }

      // Update local state for ambassadors
      setAmbassadors(prev => prev.map(amb => 
        amb.id === ambassador.id 
          ? { ...amb, status: newStatus }
          : amb
      ));

      // Refresh data to ensure consistency
      await fetchAllData();

      toast({
        title: language === 'en' ? 'Status Updated' : 'Statut Mis à Jour',
        description: language === 'en' 
          ? `Ambassador ${newStatus === 'suspended' ? 'paused' : 'activated'} successfully`
          : `Ambassadeur ${newStatus === 'suspended' ? 'mis en pause' : 'activé'} avec succès`,
      });
    } catch (error) {
      console.error('Error toggling ambassador status:', error);
      toast({
        title: language === 'en' ? 'Update Failed' : 'Échec de la Mise à Jour',
        description: language === 'en' 
          ? 'Failed to update ambassador status. Please try again.'
          : 'Échec de la mise à jour du statut. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveAmbassador = async (ambassador: Ambassador) => {
    try {
      // For editing existing ambassadors, use the old logic
      if (ambassador.id) {
        // Validate age if provided
        if (ambassador.age !== undefined && (ambassador.age < 16 || ambassador.age > 99)) {
          toast({
            title: language === 'en' ? "Validation Error" : "Erreur de validation",
            description: language === 'en' ? "Age must be between 16 and 99" : "L'âge doit être entre 16 et 99",
            variant: "destructive",
          });
          return;
        }

        // Update existing ambassador
        const updateData: any = {
            full_name: ambassador.full_name,
            phone: ambassador.phone,
            email: ambassador.email,
            city: ambassador.city,
            ville: (ambassador.city === 'Sousse' || ambassador.city === 'Tunis') ? (ambassador.ville?.trim() || null) : null,
            status: ambassador.status,
            commission_rate: ambassador.commission_rate,
            updated_at: new Date().toISOString()
        };

        // Validate social_link format if provided
        if (ambassador.social_link && ambassador.social_link.trim() && 
            !ambassador.social_link.trim().startsWith('https://www.instagram.com/') && 
            !ambassador.social_link.trim().startsWith('https://instagram.com/')) {
          toast({
            title: language === 'en' ? "Validation Error" : "Erreur de validation",
            description: language === 'en' ? "Instagram link must start with https://www.instagram.com/ or https://instagram.com/" : "Le lien Instagram doit commencer par https://www.instagram.com/ ou https://instagram.com/",
            variant: "destructive",
          });
          return;
        }

        // Only update password if it's provided and different
        if (ambassador.password && ambassador.password.trim()) {
          if (!validatePassword(ambassador.password)) {
            toast({
              title: language === 'en' ? "Validation Error" : "Erreur de validation",
              description: language === 'en' ? "Password must be at least 6 characters long" : "Le mot de passe doit contenir au moins 6 caractères",
              variant: "destructive",
            });
            return;
          }
        // Hash the password before saving
          updateData.password = await bcrypt.hash(ambassador.password, 10);
        }
        
        const { error } = await supabase
          .from('ambassadors')
          .update(updateData)
          .eq('id', ambassador.id);

        if (error) throw error;

        // Update age, social_link, and ville in corresponding application record(s) if provided
        // This ensures age, social_link, and ville are synchronized between ambassador and application records
        const appUpdateData: any = {};
        if (ambassador.age !== undefined && ambassador.age !== null) {
          appUpdateData.age = ambassador.age;
        }
        if (ambassador.social_link !== undefined) {
          appUpdateData.social_link = ambassador.social_link.trim() || null;
        }
        if (ambassador.ville !== undefined && (ambassador.city === 'Sousse' || ambassador.city === 'Tunis')) {
          appUpdateData.ville = ambassador.ville.trim() || null;
        }

        if (Object.keys(appUpdateData).length > 0) {
          // Find all application records for this ambassador (by phone number)
          // Update all statuses to ensure complete synchronization
          const { error: appUpdateError } = await supabase
            .from('ambassador_applications')
            .update(appUpdateData)
            .eq('phone_number', ambassador.phone);

          if (appUpdateError) {
            console.error('Error updating application:', appUpdateError);
            // Don't fail the whole operation, just log the error
            toast({
              title: language === 'en' ? "Warning" : "Avertissement",
              description: language === 'en' 
                ? "Ambassador updated, but synchronization with application may have failed" 
                : "Ambassadeur mis à jour, mais la synchronisation avec la candidature a peut-être échoué",
              variant: "default",
            });
          }
        }

      toast({
        title: t.ambassadorSaved,
          description: language === 'en' ? "Ambassador updated successfully" : "Ambassadeur mis à jour avec succès",
        });

        setEditingAmbassador(null);
        setIsAmbassadorDialogOpen(false);
        await fetchAllData();
        return;
      }

      // For new ambassadors, use the new form data
      const errors: {
        full_name?: string;
        email?: string;
        phone?: string;
        password?: string;
        city?: string;
        ville?: string;
      } = {};
      let hasErrors = false;

      // Validate required fields
      if (!newAmbassadorForm.full_name || !newAmbassadorForm.full_name.trim()) {
        errors.full_name = language === 'en' ? "Full name is required" : "Le nom complet est requis";
        hasErrors = true;
      }

      if (!newAmbassadorForm.age || !newAmbassadorForm.age.trim()) {
        errors.full_name = language === 'en' ? "Age is required" : "L'âge est requis";
        hasErrors = true;
      } else if (isNaN(parseInt(newAmbassadorForm.age)) || parseInt(newAmbassadorForm.age) < 16 || parseInt(newAmbassadorForm.age) > 99) {
        errors.full_name = language === 'en' ? "Age must be between 16 and 99" : "L'âge doit être entre 16 et 99";
        hasErrors = true;
      }

      // Validate email
      if (!newAmbassadorForm.email || !newAmbassadorForm.email.trim()) {
        errors.email = language === 'en' ? "Email is required" : "L'email est requis";
        hasErrors = true;
      } else if (!validateEmail(newAmbassadorForm.email)) {
        errors.email = language === 'en' ? "Please enter a valid email address" : "Veuillez entrer une adresse email valide";
        hasErrors = true;
      }

      // Validate phone
      if (!newAmbassadorForm.phone_number || !newAmbassadorForm.phone_number.trim()) {
        errors.phone = language === 'en' ? "Phone number is required" : "Le numéro de téléphone est requis";
        hasErrors = true;
      } else if (!validatePhone(newAmbassadorForm.phone_number)) {
        errors.phone = language === 'en' ? "Phone number must be 8 digits starting with 2, 4, 9, or 5" : "Le numéro de téléphone doit contenir 8 chiffres commençant par 2, 4, 9 ou 5";
        hasErrors = true;
      }

      // Validate city
      if (!newAmbassadorForm.city || !newAmbassadorForm.city.trim()) {
        errors.city = language === 'en' ? "City is required" : "La ville est requise";
        hasErrors = true;
      } else if (!CITIES.includes(newAmbassadorForm.city as any)) {
        errors.city = language === 'en' ? "Please select a valid city from the list" : "Veuillez sélectionner une ville valide dans la liste";
        hasErrors = true;
      }

      // Validate ville is required for Sousse
      if (newAmbassadorForm.city === 'Sousse' && (!newAmbassadorForm.ville || !SOUSSE_VILLES.includes(newAmbassadorForm.ville as any))) {
        errors.ville = language === 'en' ? "Ville (neighborhood) is required for Sousse" : "Le quartier est requis pour Sousse";
        hasErrors = true;
      }
      if (newAmbassadorForm.city === 'Tunis' && (!newAmbassadorForm.ville || !TUNIS_VILLES.includes(newAmbassadorForm.ville as any))) {
        errors.ville = language === 'en' ? "Ville (neighborhood) is required for Tunis" : "Le quartier est requis pour Tunis";
        hasErrors = true;
      }


      // Validate Instagram link format if provided
      if (newAmbassadorForm.social_link && newAmbassadorForm.social_link.trim() && 
          !newAmbassadorForm.social_link.trim().startsWith('https://www.instagram.com/') && 
          !newAmbassadorForm.social_link.trim().startsWith('https://instagram.com/')) {
        errors.social_link = language === 'en' ? "Instagram link must start with https://www.instagram.com/ or https://instagram.com/" : "Le lien Instagram doit commencer par https://www.instagram.com/ ou https://instagram.com/";
        hasErrors = true;
      }

      if (hasErrors) {
        setAmbassadorErrors(errors);
        toast({
          title: language === 'en' ? "Validation Error" : "Erreur de validation",
          description: language === 'en' ? "Please fix the errors in the form" : "Veuillez corriger les erreurs dans le formulaire",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate phone number in both ambassadors and applications tables
      const { data: existingAmbByPhone } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('phone', newAmbassadorForm.phone_number)
        .maybeSingle();

      if (existingAmbByPhone) {
        toast({
          title: language === 'en' ? "Duplicate Phone Number" : "Numéro de téléphone dupliqué",
          description: language === 'en' ? "An ambassador with this phone number already exists" : "Un ambassadeur avec ce numéro de téléphone existe déjà",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate phone in applications (approved/pending statuses)
      const { data: existingAppByPhone } = await supabase
        .from('ambassador_applications')
        .select('id, status')
        .eq('phone_number', newAmbassadorForm.phone_number)
        .in('status', ['pending', 'approved', 'suspended'])
        .maybeSingle();

      if (existingAppByPhone) {
        toast({
          title: language === 'en' ? "Duplicate Phone Number" : "Numéro de téléphone dupliqué",
          description: language === 'en' 
            ? `An application with this phone number already exists with status: ${existingAppByPhone.status}`
            : `Une candidature avec ce numéro de téléphone existe déjà avec le statut : ${existingAppByPhone.status}`,
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate email in both ambassadors and applications tables
      if (newAmbassadorForm.email) {
        const { data: existingAmbByEmail } = await supabase
          .from('ambassadors')
          .select('id')
          .eq('email', newAmbassadorForm.email)
          .maybeSingle();

        if (existingAmbByEmail) {
          toast({
            title: language === 'en' ? "Duplicate Email" : "Email dupliqué",
            description: language === 'en' ? "An ambassador with this email already exists" : "Un ambassadeur avec cet email existe déjà",
            variant: "destructive",
          });
          return;
        }

        // Check for duplicate email in applications (approved/pending statuses)
        const { data: existingAppByEmail } = await supabase
          .from('ambassador_applications')
          .select('id, status')
          .eq('email', newAmbassadorForm.email)
          .in('status', ['pending', 'approved', 'suspended'])
          .maybeSingle();

        if (existingAppByEmail) {
          toast({
            title: language === 'en' ? "Duplicate Email" : "Email dupliqué",
            description: language === 'en' 
              ? `An application with this email already exists with status: ${existingAppByEmail.status}`
              : `Une candidature avec cet email existe déjà avec le statut : ${existingAppByEmail.status}`,
            variant: "destructive",
          });
          return;
        }
      }

      setProcessingId('new-ambassador');

      // Generate username and password
      const username = newAmbassadorForm.phone_number;
      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);

      // Clean phone number
      const cleanedPhone = newAmbassadorForm.phone_number.replace(/\D/g, '');

      // Create ambassador
      const { data: newAmbassador, error: createError } = await supabase
        .from('ambassadors')
        .insert({
          full_name: newAmbassadorForm.full_name.trim(),
          phone: cleanedPhone,
          email: newAmbassadorForm.email.trim().toLowerCase(),
          city: newAmbassadorForm.city.trim(),
          ville: (newAmbassadorForm.city === 'Sousse' || newAmbassadorForm.city === 'Tunis') ? newAmbassadorForm.ville.trim() : null,
          password: hashedPassword,
          status: 'approved',
          commission_rate: 10,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      if (!newAmbassador) throw new Error('Failed to create ambassador');

      // Create application record with approved status and manual indicator
      // This is mandatory - every ambassador must have a corresponding application record
      const applicationData: any = {
        full_name: newAmbassadorForm.full_name.trim(),
        age: parseInt(newAmbassadorForm.age),
        phone_number: cleanedPhone,
        email: newAmbassadorForm.email.trim().toLowerCase(),
        city: newAmbassadorForm.city.trim(),
        ville: newAmbassadorForm.city === 'Tunis' ? newAmbassadorForm.ville.trim() : null,
        social_link: newAmbassadorForm.social_link?.trim() || null,
        motivation: newAmbassadorForm.motivation?.trim() || (language === 'en' ? 'Manually added by admin' : 'Ajouté manuellement par l\'administrateur'),
        status: 'approved'
      };

      // Add manually_added field if column exists (will be added via migration)
      // Try to include it, but if it fails due to missing column, we'll retry without it
      const { error: appError } = await supabase
        .from('ambassador_applications')
        .insert({
          ...applicationData,
          manually_added: true
        });

      // If error is due to missing column, retry without manually_added
      let finalAppError = appError;
      if (appError && appError.message?.includes('manually_added')) {
        const { error: retryError } = await supabase
          .from('ambassador_applications')
          .insert(applicationData);
        finalAppError = retryError;
      }

      if (finalAppError) {
        console.error('Error creating application record:', finalAppError);
        // If application creation fails, delete the ambassador to maintain data consistency
        await supabase
          .from('ambassadors')
          .delete()
          .eq('id', newAmbassador.id);
        
        throw new Error(language === 'en' 
          ? `Failed to create application record: ${finalAppError.message}. Ambassador creation was rolled back. Please run the migration: 20250203000001-ensure-manually-added-column.sql`
          : `Échec de la création de la candidature : ${finalAppError.message}. La création de l'ambassadeur a été annulée. Veuillez exécuter la migration : 20250203000001-ensure-manually-added-column.sql`);
      }

      // Find the application record we just created to get its ID
      // Try to find by manually_added first, if that fails, find by phone and status
      let result: any = await (supabase as any)
        .from('ambassador_applications')
        .select('id')
        .eq('phone_number', cleanedPhone)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // If manually_added column exists, filter by it
      try {
        const resultWithManual = await (supabase as any)
          .from('ambassador_applications')
          .select('id')
          .eq('phone_number', cleanedPhone)
          .eq('status', 'approved')
          .eq('manually_added', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (resultWithManual?.data || resultWithManual) {
          result = resultWithManual;
        }
      } catch (e) {
        // Column doesn't exist, use the result without manually_added filter
      }
      
      const createdApp = (result?.data || result) as { id: string } | null;

      const applicationId = createdApp?.id || newAmbassador.id;

      // Store credentials for email sending
      setAmbassadorCredentials(prev => ({
        ...prev,
        [applicationId]: {
          username: username,
          password: password
        }
      }));

      // Set email status to pending
      setEmailStatus(prev => ({
        ...prev,
        [applicationId]: 'pending'
      }));

      // Send approval email
      let emailSent = false;
      let emailError: string | null = null;

      try {
        const emailConfig = createApprovalEmail(
          {
            fullName: newAmbassadorForm.full_name.trim(),
            phone: cleanedPhone,
            email: newAmbassadorForm.email.trim().toLowerCase(),
            city: newAmbassadorForm.city.trim(),
            password: password
          },
          `${window.location.origin}/ambassador/auth`,
          newAmbassador.id
        );

        emailSent = await sendEmail(emailConfig);

        if (emailSent) {
          setEmailSentApplications(prev => new Set([...prev, applicationId]));
          setEmailFailedApplications(prev => {
            const newSet = new Set(prev);
            newSet.delete(applicationId);
            return newSet;
          });
          setEmailStatus(prev => ({
            ...prev,
            [applicationId]: 'sent'
          }));
      } else {
          setEmailFailedApplications(prev => new Set([...prev, applicationId]));
          setEmailSentApplications(prev => {
            const newSet = new Set(prev);
            newSet.delete(applicationId);
            return newSet;
          });
          setEmailStatus(prev => ({
            ...prev,
            [applicationId]: 'failed'
          }));
          emailError = 'Email delivery failed. Please use the Resend Email button to retry.';
        }
      } catch (error) {
        emailError = error instanceof Error ? error.message : 'Unknown error occurred';
        setEmailFailedApplications(prev => new Set([...prev, applicationId]));
        setEmailStatus(prev => ({
          ...prev,
          [applicationId]: 'failed'
        }));
        console.error('Error sending approval email:', error);
      }

      // Show appropriate toast notifications
      if (emailSent) {
        toast({
          title: language === 'en' ? "✅ Ambassador Added Successfully" : "✅ Ambassadeur ajouté avec succès",
          description: language === 'en' 
            ? `Ambassador created and approval email sent to ${newAmbassadorForm.email}`
            : `Ambassadeur créé et email d'approbation envoyé à ${newAmbassadorForm.email}`,
        });
      } else {
        toast({
          title: language === 'en' ? "✅ Ambassador Added" : "✅ Ambassadeur ajouté",
          description: emailError || (language === 'en' 
            ? "Ambassador created, but email failed to send. Use 'Resend Email' button to retry."
            : "Ambassadeur créé, mais l'email n'a pas pu être envoyé. Utilisez le bouton 'Renvoyer Email' pour réessayer."),
          variant: "default",
        });
        toast({
          title: language === 'en' ? '⚠️ Email Delivery Failed' : '⚠️ Échec de l\'envoi de l\'email',
          description: language === 'en' 
            ? `The approval email could not be sent to ${newAmbassadorForm.email}. Please use the 'Resend Email' button to retry.`
            : `L'email d'approbation n'a pas pu être envoyé à ${newAmbassadorForm.email}. Veuillez utiliser le bouton 'Renvoyer Email' pour réessayer.`,
          variant: "destructive",
        });
      }

      // Reset form
      setNewAmbassadorForm({
        full_name: '',
        age: '',
        phone_number: '',
        email: '',
        city: '',
        ville: '',
        social_link: ''
      });
      setEditingAmbassador(null);
      setIsAmbassadorDialogOpen(false);
      setAmbassadorErrors({});
      
      // Refresh all data
      await fetchAllData();

    } catch (error) {
      console.error('Error saving ambassador:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to save ambassador" : "Échec de l'enregistrement",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
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

      // Update local state immediately for instant UI feedback
      setEvents(prev => prev.filter(e => e.id !== eventToDelete.id));

      // Verify deletion by checking if the event still exists
      const { data: verifyData, error: verifyError } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventToDelete.id)
        .single();

      if (verifyError && verifyError.code === 'PGRST116') {
        // Event was successfully deleted (not found)
        // Invalidate events cache so frontend shows updated data
        invalidateEvents();
        
        toast({
          title: language === 'en' ? "Event deleted" : "Événement supprimé",
          description: language === 'en' ? "Event deleted successfully" : "Événement supprimé avec succès",
        });
      } else if (verifyData) {
        // Event still exists - deletion failed, revert UI
        setEvents(prev => [...prev, eventToDelete].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ));
        console.error('Event still exists after deletion attempt');
        toast({
          title: t.error,
          description: language === 'en' ? "Event deletion failed - please check RLS policies" : "Échec de la suppression - vérifiez les politiques RLS",
          variant: "destructive",
        });
        return; // Don't continue if deletion failed
      }

      // Refresh all data to ensure consistency
      await fetchAllData();

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
      const { data: deleteData, error: deleteError } = await supabase
        .from('ambassadors')
        .delete()
        .eq('id', ambassadorId)
        .select();

      if (deleteError) {
        console.error('Delete ambassador error:', deleteError);
        // Provide more specific error message
        let errorMessage = language === 'en' ? 'Failed to delete ambassador' : 'Échec de la suppression de l\'ambassadeur';
        if (deleteError.code === '42501' || deleteError.message?.includes('policy') || deleteError.message?.includes('permission')) {
          errorMessage = language === 'en' 
            ? 'Permission denied. Please run the migration 20250131000002-fix-ambassador-delete-policy.sql in Supabase SQL Editor.'
            : 'Permission refusée. Veuillez exécuter la migration 20250131000002-fix-ambassador-delete-policy.sql dans l\'éditeur SQL Supabase.';
        } else if (deleteError.message) {
          errorMessage = deleteError.message;
        }
        throw new Error(errorMessage);
      }

      // Verify deletion
      if (!deleteData || deleteData.length === 0) {
        // Check if ambassador still exists
        const { data: verifyData } = await supabase
          .from('ambassadors')
          .select('id')
          .eq('id', ambassadorId)
          .single();
        
        if (verifyData) {
          throw new Error('Deletion failed - ambassador still exists. Check RLS policies.');
        }
      }

      // Find and update the corresponding application status to 'removed'
      let applicationId: string | null = null;
      if (ambassador) {
        // First, find the application by phone or email
        let applicationData: { id: string } | null = null;
        
        if (ambassador.email && ambassador.email.trim() !== '') {
          // Search by phone OR email, prefer approved status
          const result = await supabase
          .from('ambassador_applications')
            .select('id')
            .eq('status', 'approved')
            .or(`phone_number.eq.${ambassador.phone},email.eq.${ambassador.email}`)
            .maybeSingle();
          applicationData = result.data;
          if (result.error && result.error.code !== 'PGRST116') {
            console.error('Error finding application:', result.error);
          }
        } else {
          // Search by phone only, prefer approved status
          const result = await supabase
            .from('ambassador_applications')
            .select('id')
            .eq('phone_number', ambassador.phone)
            .eq('status', 'approved')
            .maybeSingle();
          applicationData = result.data;
          if (result.error && result.error.code !== 'PGRST116') {
            console.error('Error finding application:', result.error);
          }
        }
        
        if (applicationData) {
          applicationId = applicationData.id;
          
          // Calculate reapply delay date (30 days from now)
          const REAPPLY_DELAY_DAYS = 30;
          const reapplyDelayDate = new Date();
          reapplyDelayDate.setDate(reapplyDelayDate.getDate() + REAPPLY_DELAY_DAYS);
          
          // Update application status to 'removed' and set reapply_delay_date
          const { error: updateAppError } = await supabase
            .from('ambassador_applications')
            .update({
              status: 'removed',
              reapply_delay_date: reapplyDelayDate.toISOString()
            })
            .eq('id', applicationId);

          if (updateAppError) {
            console.error('Error updating application status to removed:', updateAppError);
            // Try alternative update method
            if (ambassador.email && ambassador.email.trim() !== '') {
              await supabase
                .from('ambassador_applications')
                .update({
                  status: 'removed',
                  reapply_delay_date: reapplyDelayDate.toISOString()
                })
                .eq('status', 'approved')
                .or(`phone_number.eq.${ambassador.phone},email.eq.${ambassador.email}`);
            } else {
              await supabase
                .from('ambassador_applications')
                .update({
                  status: 'removed',
                  reapply_delay_date: reapplyDelayDate.toISOString()
                })
                .eq('phone_number', ambassador.phone)
                .eq('status', 'approved');
            }
          }
        }
      }

      // Verify deletion was successful before updating UI
      const { data: verifyData } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('id', ambassadorId)
        .single();

      if (verifyData) {
        // Ambassador still exists - deletion failed
        throw new Error('Deletion failed - ambassador still exists. Please check RLS policies.');
      }

      // Update local state immediately for instant UI feedback
      setAmbassadors(prev => prev.filter(amb => amb.id !== ambassadorId));
      
      // Update application status in local state if found
      if (applicationId) {
        setApplications(prev => prev.map(app => 
          app.id === applicationId 
            ? { ...app, status: 'removed' as const }
            : app
        ));
      } else if (ambassador) {
        // Fallback: update by phone/email match
        setApplications(prev => prev.map(app => {
          const phoneMatch = app.phone_number === ambassador.phone;
          const emailMatch = ambassador.email && app.email && app.email === ambassador.email;
          if ((phoneMatch || emailMatch) && app.status === 'approved') {
            return { ...app, status: 'removed' as const };
          }
          return app;
        }));
      }

      toast({
        title: language === 'en' ? "Ambassador Removed" : "Ambassadeur Retiré",
        description: language === 'en' 
          ? "Ambassador removed from active list. Application status updated to 'removed' to preserve history." 
          : "Ambassadeur retiré de la liste active. Statut de la candidature mis à jour à 'retiré' pour préserver l'historique.",
      });
      
      // Close delete dialog
      setAmbassadorToDelete(null);
      
      // Refresh all data to ensure consistency
      await fetchAllData();
    } catch (error) {
      console.error('Error deleting ambassador:', error);
      const errorMessage = error instanceof Error ? error.message : (language === 'en' ? "Failed to delete ambassador" : "Échec de la suppression");
      toast({
        title: language === 'en' ? "Error" : "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
      // Revert UI changes on error
      await fetchAllData();
    }
    setAmbassadorToDelete(null);
  };

  // Find ambassadors without corresponding applications
  const getAmbassadorsWithoutApplications = () => {
    return ambassadors.filter(amb => {
      return !applications.some(app => 
        app.status === 'approved' && 
        (app.phone_number === amb.phone || 
         (app.email && amb.email && app.email === amb.email))
      );
    });
  };

  // Create application records for ambassadors that don't have them
  const handleCreateApplicationsForAmbassadors = async () => {
    try {
      const ambassadorsWithoutApps = getAmbassadorsWithoutApplications();
      
      if (ambassadorsWithoutApps.length === 0) {
        toast({
          title: language === 'en' ? "All Ambassadors Have Applications" : "Tous les Ambassadeurs ont des Candidatures",
          description: language === 'en' 
            ? "All ambassadors have corresponding approved applications." 
            : "Tous les ambassadeurs ont des candidatures approuvées correspondantes.",
        });
        return;
      }

      // Create application records for each ambassador
      const applicationsToCreate = ambassadorsWithoutApps.map(amb => ({
        full_name: amb.full_name,
        age: 0, // Default age, can be updated later
        phone_number: amb.phone,
        email: amb.email || '',
        city: amb.city,
        social_link: '',
        motivation: language === 'en' 
          ? 'Ambassador created directly (application record created retroactively)' 
          : 'Ambassadeur créé directement (candidature créée rétroactivement)',
        status: 'approved',
        created_at: amb.created_at || new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('ambassador_applications')
        .insert(applicationsToCreate);

      if (insertError) {
        throw insertError;
      }

      toast({
        title: language === 'en' ? "Applications Created" : "Candidatures Créées",
        description: language === 'en' 
          ? `Created ${ambassadorsWithoutApps.length} application record(s) for ambassadors.` 
          : `${ambassadorsWithoutApps.length} candidature(s) créée(s) pour les ambassadeurs.`,
      });

      // Refresh data
      await fetchAllData();
    } catch (error) {
      console.error('Error creating applications for ambassadors:', error);
      toast({
        title: language === 'en' ? "Error" : "Erreur",
        description: language === 'en' 
          ? "Failed to create application records." 
          : "Échec de la création des candidatures.",
        variant: "destructive",
      });
    }
  };

  // Clean up orphaned approved applications (approved but no corresponding ambassador)
  const handleCleanupOrphanedApplications = async () => {
    try {
      // Find all approved applications
      const approvedApps = applications.filter(app => app.status === 'approved');
      
      // Find orphaned applications (approved but no corresponding ambassador)
      const orphanedApps = approvedApps.filter(app => {
        return !ambassadors.some(amb => 
          amb.phone === app.phone_number || 
          (app.email && amb.email && amb.email === app.email)
        );
      });

      if (orphanedApps.length === 0) {
        toast({
          title: language === 'en' ? "No Orphaned Applications" : "Aucune Candidature Orpheline",
          description: language === 'en' 
            ? "All approved applications have corresponding ambassadors." 
            : "Toutes les candidatures approuvées ont des ambassadeurs correspondants.",
        });
        return;
      }

      // Delete orphaned applications
      const orphanedIds = orphanedApps.map(app => app.id);
      const { error: deleteError } = await supabase
        .from('ambassador_applications')
        .delete()
        .in('id', orphanedIds);

      if (deleteError) {
        throw deleteError;
      }

      // Update local state
      setApplications(prev => prev.filter(app => !orphanedIds.includes(app.id)));

      toast({
        title: language === 'en' ? "Cleanup Complete" : "Nettoyage Terminé",
        description: language === 'en' 
          ? `Deleted ${orphanedApps.length} orphaned approved application(s).` 
          : `${orphanedApps.length} candidature(s) orpheline(s) supprimée(s).`,
      });

      // Refresh data
      await fetchAllData();
    } catch (error) {
      console.error('Error cleaning up orphaned applications:', error);
      toast({
        title: language === 'en' ? "Error" : "Erreur",
        description: language === 'en' 
          ? "Failed to clean up orphaned applications." 
          : "Échec du nettoyage des candidatures orphelines.",
        variant: "destructive",
      });
    }
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
      // Update local state immediately for instant UI feedback
      if (isNew && affectedRows > 0) {
        // Add new sponsor to the list
        const newSponsor = { ...sponsorData, id: sponsorId, created_at: new Date().toISOString() };
        setSponsors(prev => [...prev, newSponsor].sort((a, b) => 
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        ));
      } else if (!isNew && affectedRows > 0) {
        // Update existing sponsor in the list
        setSponsors(prev => prev.map(s => 
          s.id === sponsorId
            ? { ...s, ...sponsorData, updated_at: new Date().toISOString() }
            : s
        ));
      }
      
      if ((isNew && affectedRows > 0) || (!isNew && affectedRows > 0)) {
        closeSponsorDialog();
        toast({
          title: language === 'en' ? 'Sponsor saved' : 'Sponsor enregistré',
          description: language === 'en' ? 'Sponsor details updated successfully.' : 'Détails du sponsor mis à jour avec succès.',
        });
      } else {
        // Refresh from database if update failed
        const { data: sponsorsData } = await supabase.from('sponsors').select('*').order('created_at', { ascending: true });
        if (sponsorsData) setSponsors(sponsorsData);
        
        toast({
          title: t.error,
          description: language === 'en' ? 'No sponsor was updated. Please check your data.' : 'Aucun sponsor n\'a été mis à jour. Veuillez vérifier vos données.',
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
    
    try {
      // Update local state immediately for instant UI feedback
      const sponsorIdToDelete = sponsorToDelete.id;
      setSponsors(prev => prev.filter(s => s.id !== sponsorIdToDelete));
      
      // Delete from database
      const { error: sponsorError } = await supabase
        .from('sponsors')
        .delete()
        .eq('id', sponsorIdToDelete);
      
      if (sponsorError) {
        // Revert UI change on error
        const { data: allSponsors } = await supabase.from('sponsors').select('*').order('created_at', { ascending: true });
        if (allSponsors) setSponsors(allSponsors);
        throw sponsorError;
      }
      
      // Delete associated event sponsors
      const { error: eventSponsorError } = await supabase
        .from('event_sponsors')
        .delete()
        .eq('sponsor_id', sponsorIdToDelete);
      
      if (eventSponsorError) {
        console.error('Error deleting event sponsors:', eventSponsorError);
        // Don't throw here as the sponsor was already deleted
      }
      
      toast({
        title: language === 'en' ? "Sponsor deleted" : "Sponsor supprimé",
        description: language === 'en' ? "Sponsor deleted successfully" : "Sponsor supprimé avec succès",
      });
      
      closeDeleteDialog();
    } catch (error) {
      console.error('Error deleting sponsor:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to delete sponsor" : "Échec de la suppression du sponsor",
        variant: "destructive",
      });
    }
  };


  const handleLogout = async () => {
    try {
      // Log admin logout before clearing state
      if (currentAdminId) {
        logger.action('Admin logged out', {
          category: 'authentication',
          userType: 'admin',
          details: { 
            name: currentAdminName || 'Unknown',
            email: currentAdminEmail || 'Unknown',
            adminId: currentAdminId 
          }
        });
      }
      
      // Call Vercel API route to clear JWT cookie
      // This will remove the httpOnly cookie containing the JWT token
      await apiFetch(API_ROUTES.ADMIN_LOGOUT, {
        method: 'POST',
        credentials: 'include', // Important: Include cookies in request
      });
      
      // Clear any local state that might contain admin info
      setCurrentAdminRole(null);
      setCurrentAdminId(null);
      setCurrentAdminName(null);
      setCurrentAdminEmail(null);
      
      toast({
        title: language === 'en' ? "Logged Out" : "Déconnecté",
        description: language === 'en' 
          ? "You have been successfully logged out. Please re-enter your credentials to continue."
          : "Vous avez été déconnecté avec succès. Veuillez ré-entrer vos identifiants pour continuer.",
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout API call fails, still navigate to login
      // The ProtectedAdminRoute will handle authentication check
    } finally {
      // Navigate to login page - admin must re-enter credentials
      // The login form will be empty and require fresh credentials
      navigate('/admin/login', { replace: true });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22C55E' }} title={t.approved} />; // Green
      case 'rejected':
        return <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} title={t.rejected} />; // Red
      case 'removed':
        return <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} title={language === 'en' ? 'Removed' : 'Retiré'} />; // Red
      case 'suspended':
        return <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6B7280' }} title={language === 'en' ? 'Paused' : 'En Pause'} />; // Grey
      default:
        return <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F97316' }} title={t.pending} />; // Orange
    }
  };

  // Get status color and label for small circle indicators
  const getOrderStatusInfo = (status: string): { color: string; label: string } => {
    const normalizedStatus = (status || '').toUpperCase();
    
    // Status color and label mapping - Using brand semantic colors
    const statusConfig: Record<string, { color: string; label: string; bgColor: string; textColor: string }> = {
      // Enabled/Active/Open statuses - Red
      'COMPLETED': {
        color: '#E21836',
        bgColor: 'rgba(226, 24, 54, 0.15)',
        textColor: '#E21836',
        label: language === 'en' ? 'Completed' : 'Terminé'
      },
      'MANUAL_COMPLETED': {
        color: '#E21836',
        bgColor: 'rgba(226, 24, 54, 0.15)',
        textColor: '#E21836',
        label: language === 'en' ? 'Manual Completed' : 'Terminé Manuel'
      },
      'ACCEPTED': {
        color: '#E21836',
        bgColor: 'rgba(226, 24, 54, 0.15)',
        textColor: '#E21836',
        label: language === 'en' ? 'Accepted' : 'Accepté'
      },
      'MANUAL_ACCEPTED': {
        color: '#E21836',
        bgColor: 'rgba(226, 24, 54, 0.15)',
        textColor: '#E21836',
        label: language === 'en' ? 'Manual Accepted' : 'Accepté Manuel'
      },
      'PAID': {
        color: '#E21836',
        bgColor: 'rgba(226, 24, 54, 0.15)',
        textColor: '#E21836',
        label: language === 'en' ? 'Paid' : 'Payé'
      },
      'PENDING': {
        color: '#FFC93C',
        bgColor: 'rgba(255, 201, 60, 0.15)',
        textColor: '#FFC93C',
        label: language === 'en' ? 'Pending' : 'En Attente'
      },
      'PENDING_PAYMENT': {
        color: '#FFC93C',
        bgColor: 'rgba(255, 201, 60, 0.15)',
        textColor: '#FFC93C',
        label: language === 'en' ? 'Pending Payment' : 'Paiement en Attente'
      },
      'ON_HOLD': {
        color: '#FFC93C',
        bgColor: 'rgba(255, 201, 60, 0.15)',
        textColor: '#FFC93C',
        label: language === 'en' ? 'On Hold' : 'En Attente'
      },
      'REFUNDED': {
        color: '#FFC93C',
        bgColor: 'rgba(255, 201, 60, 0.15)',
        textColor: '#FFC93C',
        label: language === 'en' ? 'Refunded' : 'Remboursé'
      },
      'FRAUD_FLAGGED': {
        color: '#FFC93C',
        bgColor: 'rgba(255, 201, 60, 0.15)',
        textColor: '#FFC93C',
        label: language === 'en' ? 'Fraud Flagged' : 'Signalé comme Fraude'
      },
      
      // Info statuses - Cyan
      'CANCELLED': {
        color: '#00CFFF',
        bgColor: 'rgba(0, 207, 255, 0.15)',
        textColor: '#00CFFF',
        label: language === 'en' ? 'Cancelled' : 'Annulé'
      },
      'CANCELLED_BY_AMBASSADOR': {
        color: '#00CFFF',
        bgColor: 'rgba(0, 207, 255, 0.15)',
        textColor: '#00CFFF',
        label: language === 'en' ? 'Cancelled by Ambassador' : 'Annulé par Ambassadeur'
      },
      'CANCELLED_BY_ADMIN': {
        color: '#00CFFF',
        bgColor: 'rgba(0, 207, 255, 0.15)',
        textColor: '#00CFFF',
        label: language === 'en' ? 'Cancelled by Admin' : 'Annulé par Admin'
      },
      
      // Disabled statuses - Gray
      'FAILED': {
        color: '#8C8C8C',
        bgColor: 'rgba(140, 140, 140, 0.15)',
        textColor: '#8C8C8C',
        label: language === 'en' ? 'Failed' : 'Échoué'
      },
      'IGNORED': {
        color: '#8C8C8C',
        bgColor: 'rgba(140, 140, 140, 0.15)',
        textColor: '#8C8C8C',
        label: language === 'en' ? 'Ignored' : 'Ignoré'
      },
      'FRAUD_SUSPECT': {
        color: '#8C8C8C',
        bgColor: 'rgba(140, 140, 140, 0.15)',
        textColor: '#8C8C8C',
        label: language === 'en' ? 'Fraud Suspect' : 'Fraude Suspecte'
      }
    };
    
    const config = statusConfig[normalizedStatus] || {
      color: '#8C8C8C',
      bgColor: 'rgba(140, 140, 140, 0.15)',
      textColor: '#8C8C8C',
      label: status || (language === 'en' ? 'Unknown' : 'Inconnu')
    };
    
    return config;
  };

  // Small circle status indicator component with tooltip
  const OrderStatusIndicator = ({ status }: { status: string }) => {
    const statusInfo = getOrderStatusInfo(status);
    const [showTooltip, setShowTooltip] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const handleMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setShowTooltip(true);
    };
    
    const handleMouseLeave = () => {
      timeoutRef.current = setTimeout(() => {
        setShowTooltip(false);
      }, 100);
    };
    
    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);
    
    return (
      <div
        className="relative inline-flex items-center justify-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="w-3 h-3 rounded-full cursor-help shadow-sm"
          style={{ backgroundColor: statusInfo.color }}
        />
        {showTooltip && (
          <div
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 px-2 py-1 bg-popover border border-border rounded-md shadow-lg text-sm font-medium whitespace-nowrap pointer-events-none"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {statusInfo.label}
          </div>
        )}
      </div>
    );
  };

  // Helper function to detect Instagram URLs
  const isInstagramUrl = (url: string) => {
    if (!url) return false;
    const instagramPattern = /^https?:\/\/(www\.)?(instagram\.com|ig\.com)\/.+/i;
    return instagramPattern.test(url);
  };

  // Social link component with icon only for table
  const SocialLink = ({ url, iconOnly = false }: { url: string; iconOnly?: boolean }) => {
    if (isInstagramUrl(url)) {
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`inline-flex items-center ${iconOnly ? 'justify-center' : 'space-x-2'} text-primary hover:text-primary/80 transition-colors duration-300 transform hover:scale-110`}
          title="View Instagram Profile"
        >
          <Instagram className="w-4 h-4" />
          {!iconOnly && <span className="text-sm">Instagram Profile</span>}
        </a>
      );
    }
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-primary hover:underline text-sm transition-colors duration-300"
        title={url}
      >
        {iconOnly ? <ExternalLink className="w-4 h-4" /> : url}
      </a>
    );
  };

  // Store gallery files temporarily (upload on save)
  const handleGalleryFileSelect = (files: File[], type: 'images' | 'videos') => {
    if (type === 'images') {
      setPendingGalleryImages(prev => [...prev, ...files]);
    } else {
      setPendingGalleryVideos(prev => [...prev, ...files]);
    }
    
    toast({
      title: language === 'en' ? "Files selected" : "Fichiers sélectionnés",
      description: language === 'en' 
        ? `${files.length} file(s) will be uploaded when you save` 
        : `${files.length} fichier(s) seront téléchargés lors de l'enregistrement`,
    });
  };

  // Remove pending gallery file
  const removePendingGalleryFile = (index: number, type: 'images' | 'videos') => {
    if (type === 'images') {
      setPendingGalleryImages(prev => {
        const newFiles = [...prev];
        newFiles.splice(index, 1);
        return newFiles;
      });
    } else {
      setPendingGalleryVideos(prev => {
        const newFiles = [...prev];
        newFiles.splice(index, 1);
        return newFiles;
      });
    }
  };

  // Passes are managed by admin - no auto-adding of passes

  // Upload all pending gallery files
  const uploadPendingGalleryFiles = async (type: 'images' | 'videos'): Promise<string[]> => {
    const files = type === 'images' ? pendingGalleryImages : pendingGalleryVideos;
    if (files.length === 0) return [];

    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const uploadResult = await uploadImage(file, 'gallery');
      
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }
      
      uploadedUrls.push(uploadResult.url);
    }
    
    return uploadedUrls;
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
  // Count approved applications that have corresponding ambassadors (1:1 relationship)
  const approvedCount = applications.filter(app => 
    app.status === 'approved' && 
    ambassadors.some(amb => 
      amb.phone === app.phone_number || 
      (app.email && amb.email && app.email === amb.email)
    )
  ).length;
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
        price: (event.passes && event.passes.length > 0 && event.passes[0]?.price) ? event.passes[0].price : 50 + (index * 10),
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
      // Update local state immediately for instant UI feedback
      if (isNew && affectedRows > 0) {
        // Add new team member to the list
        const newMember = { ...teamData, id: teamMemberId, created_at: new Date().toISOString() };
        setTeamMembers(prev => [...prev, newMember].sort((a, b) => 
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        ));
      } else if (!isNew && affectedRows > 0) {
        // Update existing team member in the list
        setTeamMembers(prev => prev.map(m => 
          m.id === teamMemberId
            ? { ...m, ...teamData, updated_at: new Date().toISOString() }
            : m
        ));
      }
      
      if ((isNew && affectedRows > 0) || (!isNew && affectedRows > 0)) {
        closeTeamDialog();
        toast({
          title: language === 'en' ? 'Team member saved' : 'Membre enregistré',
          description: language === 'en' ? 'Team member details updated successfully.' : 'Détails du membre mis à jour avec succès.',
        });
      } else {
        // Refresh from database if update failed
        const { data: teamDataList } = await supabase.from('team_members').select('*').order('created_at', { ascending: true });
        if (teamDataList) setTeamMembers(teamDataList);
        
        toast({
          title: t.error,
          description: language === 'en' ? 'No team member was updated. Please check your data.' : 'Aucun membre n\'a été mis à jour. Veuillez vérifier vos données.',
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
      const memberIdToDelete = teamMemberToDelete.id;
      
      // Update local state immediately for instant UI feedback
      setTeamMembers(prev => prev.filter(m => m.id !== memberIdToDelete));
      
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberIdToDelete);
      
      if (error) {
        // Revert UI change on error
        const { data: allMembers } = await supabase.from('team_members').select('*').order('created_at', { ascending: true });
        if (allMembers) setTeamMembers(allMembers);
        throw error;
      }
      
      closeDeleteTeamDialog();
      toast({
        title: language === 'en' ? 'Team member deleted' : 'Membre supprimé',
        description: language === 'en' ? 'Team member removed successfully.' : 'Membre supprimé avec succès.',
      });
    } catch (err) {
      console.error('Delete team member error:', err);
      toast({
        title: t.error,
        description: language === 'en' ? 'Failed to delete team member. Please try again.' : 'Échec de la suppression. Veuillez réessayer.',
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
      const messageIdToDelete = messageToDelete.id;
      
      const { error, data } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', messageIdToDelete)
        .select();
      
      if (error) {
        console.error('Delete message error:', error);
        let errorMessage = language === 'en' ? 'Failed to delete message' : 'Échec de la suppression';
        if (error.code === '42501' || error.message?.includes('policy') || error.message?.includes('permission')) {
          errorMessage = language === 'en' 
            ? 'Permission denied. Check RLS policies for "contact_messages" table.' 
            : 'Permission refusée. Vérifiez les politiques RLS pour la table "contact_messages".';
        } else if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }
      
      // Verify deletion was successful
      if (!data || data.length === 0) {
        // Check if message still exists
        const { data: verifyData } = await supabase
          .from('contact_messages')
          .select('id')
          .eq('id', messageIdToDelete)
          .maybeSingle();
        
        if (verifyData) {
          throw new Error(language === 'en' 
            ? 'Failed to delete message. Check RLS policies.' 
            : 'Échec de la suppression. Vérifiez les politiques RLS.');
        }
      }
      
      // Update local state after successful deletion
      setContactMessages(prev => prev.filter(m => m.id !== messageIdToDelete));
      
      closeDeleteMessageDialog();
      toast({
        title: language === 'en' ? 'Message deleted' : 'Message supprimé',
        description: language === 'en' ? 'Contact message removed successfully.' : 'Message supprimé avec succès.',
      });
    } catch (err: any) {
      console.error('Delete message error:', err);
      toast({
        title: t.error,
        description: err.message || (language === 'en' ? 'Failed to delete message. Please try again.' : 'Échec de la suppression. Veuillez réessayer.'),
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

  // Session timer - calculates remaining time from expiration timestamp
  // STRICT SESSION TIMER: Based on immutable JWT 'exp' field
  // Timer NEVER resets, NEVER extends - only counts down from login time
  // The expiration timestamp is fixed at login and cannot be changed
  useEffect(() => {
    if (!sessionExpiresAt) {
      // No expiration set yet - wait for server response
      return;
    }

    const timer = setInterval(() => {
      // Calculate remaining time from the immutable expiration timestamp
      // STRICT: This is based on JWT 'exp' - never changes until re-login
      const remaining = Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000));
      setSessionTimeLeft(remaining);
      
      if (remaining <= 0) {
        // Session expired - JWT 'exp' has passed
        // Clear timer and redirect to login
        clearInterval(timer);
        toast({
          title: language === 'en' ? "Session Expired" : "Session expirée",
          description: language === 'en' 
            ? "Your session has expired. Please login again."
            : "Votre session a expiré. Veuillez vous reconnecter.",
          variant: "destructive",
        });
        // Use window.location for hard redirect (clears all state)
        window.location.href = '/admin/login';
      }
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, [sessionExpiresAt, toast, language]);

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
                <div className="relative bg-gradient-to-br from-primary to-primary/80 p-4 rounded-2xl shadow-lg">
                  <Settings className="w-12 h-12 text-primary-foreground" />
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent mb-2">
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
                className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 h-12 text-base font-semibold"
              >
                {language === 'en' ? 'Back to Login' : 'Retour à la Connexion'}
              </Button>
            </div>

            {/* Decorative elements */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="pt-16 min-h-screen min-w-0" style={{ backgroundColor: '#1A1A1A' }}>
      <div className="flex">
        {/* Sidebar */}
        <div 
          className="w-64 min-h-screen flex flex-col"
          style={{
            background: '#1A1A1A',
            borderRight: '1px solid #2A2A2A'
          }}
        >
          <div className="p-4 border-b" style={{ borderColor: '#2A2A2A' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>Navigation</h2>
          </div>
          <div className="p-2 flex-1">
            <div className="space-y-1 animate-in slide-in-from-left-4 duration-700">
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-100 ${
                  activeTab === "overview" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "overview" ? '#E21836' : '#B0B0B0',
                  background: activeTab === "overview" ? 'rgba(226, 24, 54, 0.15)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "overview") {
                    e.currentTarget.style.color = '#E21836';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "overview") {
                    e.currentTarget.style.color = '#B0B0B0';
                  }
                }}
              >
                <BarChart3 className={`w-4 h-4 transition-transform duration-300 ${activeTab === "overview" ? "animate-pulse" : ""}`} />
                <span>{t.overview}</span>
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-200 ${
                  activeTab === "events" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "events" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "events" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <CalendarIcon className={`w-4 h-4 transition-transform duration-300 ${activeTab === "events" ? "animate-pulse" : ""}`} />
                <span>{t.events}</span>
              </button>
              <button
                onClick={() => setActiveTab("ambassadors")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-300 ${
                  activeTab === "ambassadors" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "ambassadors" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "ambassadors" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <Users className={`w-4 h-4 transition-transform duration-300 ${activeTab === "ambassadors" ? "animate-pulse" : ""}`} />
                <span>{t.ambassadors}</span>
              </button>
              <button
                onClick={() => setActiveTab("applications")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-400 ${
                  activeTab === "applications" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "applications" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "applications" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <FileText className={`w-4 h-4 transition-transform duration-300 ${activeTab === "applications" ? "animate-pulse" : ""}`} />
                <span>{t.applications}</span>
              </button>
              <button
                onClick={() => setActiveTab("sponsors")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-500 ${
                  activeTab === "sponsors" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "sponsors" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "sponsors" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <Building2 className={`w-4 h-4 transition-transform duration-300 ${activeTab === "sponsors" ? "animate-pulse" : ""}`} />
                <span>Sponsors</span>
              </button>
              <button
                onClick={() => setActiveTab("team")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-600 ${
                  activeTab === "team" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "team" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "team" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <Users2 className={`w-4 h-4 transition-transform duration-300 ${activeTab === "team" ? "animate-pulse" : ""}`} />
                <span>Team</span>
              </button>
              {/* Debug: Show current role */}
              {process.env.NODE_ENV === 'development' && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Role: {currentAdminRole || 'loading...'}
                </div>
              )}
              {currentAdminRole === 'super_admin' && (
                <button
                  onClick={() => setActiveTab("admins")}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-700 ${
                    activeTab === "admins" 
                      ? "shadow-lg" 
                      : ""
                  }`}
                  style={{
                    color: activeTab === "admins" ? '#E21836' : '#B8B8B8',
                    background: activeTab === "admins" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                  }}
                >
                  <User className={`w-4 h-4 transition-transform duration-300 ${activeTab === "admins" ? "animate-pulse" : ""}`} />
                  <span>{language === 'en' ? 'Admins' : 'Administrateurs'}</span>
                </button>
              )}
              <button
                onClick={() => setActiveTab("contact")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-${currentAdminRole === 'super_admin' ? '800' : '700'} ${
                  activeTab === "contact" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "contact" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "contact" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <MessageCircle className={`w-4 h-4 transition-transform duration-300 ${activeTab === "contact" ? "animate-pulse" : ""}`} />
                <span>Contact Messages</span>
              </button>
              <button
                onClick={() => setActiveTab("tickets")}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-800 ${
                  activeTab === "tickets" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "tickets" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "tickets" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <DollarSign className={`w-4 h-4 transition-transform duration-300 ${activeTab === "tickets" ? "animate-pulse" : ""}`} />
                <span>Ticket Management</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("ambassador-sales");
                  if (codAmbassadorOrders.length === 0) {
                    fetchAmbassadorSalesData();
                  }
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-825 ${
                  activeTab === "ambassador-sales" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "ambassador-sales" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "ambassador-sales" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <Package className={`w-4 h-4 transition-transform duration-300 ${activeTab === "ambassador-sales" ? "animate-pulse" : ""}`} />
                <span>{language === 'en' ? 'Ambassador Sales' : 'Ventes Ambassadeurs'}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("online-orders");
                  if (onlineOrders.length === 0) {
                    fetchOnlineOrders();
                  }
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-850 ${
                  activeTab === "online-orders" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "online-orders" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "online-orders" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <CreditCard className={`w-4 h-4 transition-transform duration-300 ${activeTab === "online-orders" ? "animate-pulse" : ""}`} />
                <span>{language === 'en' ? 'Online Orders' : 'Commandes en Ligne'}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("marketing");
                  // Load marketing data only when Marketing tab is opened
                  if (phoneSubscribers.length === 0) {
                    fetchPhoneSubscribers();
                  }
                  if (smsLogs.length === 0) {
                    fetchSmsLogs();
                  }
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-850 ${
                  activeTab === "marketing" 
                    ? "shadow-lg" 
                    : ""
                }`}
                style={{
                  color: activeTab === "marketing" ? '#E21836' : '#B8B8B8',
                  background: activeTab === "marketing" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                }}
              >
                <Megaphone className={`w-4 h-4 transition-transform duration-300 ${activeTab === "marketing" ? "animate-pulse" : ""}`} />
                <span>{language === 'en' ? 'Marketing' : 'Marketing'}</span>
              </button>
              {currentAdminRole === 'super_admin' && (
                <button
                  onClick={() => {
                    setActiveTab("logs");
                    if (siteLogs.length === 0) {
                      fetchSiteLogs();
                    }
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-875 ${
                    activeTab === "logs" 
                      ? "shadow-lg" 
                      : ""
                  }`}
                  style={{
                    color: activeTab === "logs" ? '#E21836' : '#B8B8B8',
                    background: activeTab === "logs" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                  }}
                >
                  <Activity className={`w-4 h-4 transition-transform duration-300 ${activeTab === "logs" ? "animate-pulse" : ""}`} />
                  <span>{language === 'en' ? 'Logs' : 'Journaux'}</span>
                </button>
              )}
              {currentAdminRole === 'super_admin' && (
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-left-4 duration-500 delay-925 ${
                    activeTab === "settings" 
                      ? "shadow-lg" 
                      : ""
                  }`}
                  style={{
                    color: activeTab === "settings" ? '#E21836' : '#B8B8B8',
                    background: activeTab === "settings" ? 'rgba(226, 24, 54, 0.08)' : 'transparent'
                  }}
                >
                  <Settings className={`w-4 h-4 transition-transform duration-300 ${activeTab === "settings" ? "animate-pulse" : ""}`} />
                  <span>{t.settings}</span>
                </button>
              )}
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
                <h1 
                  className="text-4xl font-heading font-bold mb-2 animate-in slide-in-from-left-4 duration-1000 uppercase"
                  style={{
                    color: '#E21836',
                    textShadow: '0 0 12px rgba(226, 24, 54, 0.45)'
                  }}
                >
                  {t.title}
                </h1>
                <p 
                  className="animate-in slide-in-from-left-4 duration-1000 delay-300"
                  style={{ color: '#B0B0B0' }}
                >
                  {t.subtitle}
                </p>
              </div>
              {/* Session Timer */}
              <div 
                className="flex items-center gap-2 px-4 py-2 rounded-lg"
                style={{
                  background: '#1F1F1F',
                  border: '1px solid #2A2A2A',
                  color: '#B8B8B8'
                }}
              >
                <Clock className="w-4 h-4 animate-pulse" style={{ color: '#E21836' }} />
                <span className="text-sm font-medium">
                  {language === 'en' ? 'Session:' : 'Session:'} {Math.floor(sessionTimeLeft / 3600)}h {Math.floor((sessionTimeLeft % 3600) / 60)}m {sessionTimeLeft % 60}s
                </span>
              </div>
            </div>

            {/* Tabs Content - keeping all existing content exactly the same */}
            <Tabs 
              value={activeTab} 
              onValueChange={(value) => {
                // Prevent regular admins from accessing super_admin-only tabs
                if (currentAdminRole !== 'super_admin' && (value === 'logs' || value === 'settings' || value === 'admins')) {
                  return; // Don't allow tab change
                }
                setActiveTab(value);
              }} 
              className="space-y-6 min-w-0"
            >
              {/* Tabs Content - separated from navigation */}
              <TabsContent value="overview" className="space-y-6 mt-20 sm:mt-0">
                {/* Welcome Header */}
                <div className="animate-in slide-in-from-top-4 fade-in duration-700">
                  <Card 
                    className="shadow-xl"
                    style={{
                      backgroundColor: '#1F1F1F',
                      borderColor: '#2A2A2A'
                    }}
                  >
                    <CardContent className="p-8">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <h2 className="text-3xl font-heading font-bold" style={{ color: '#E21836' }}>
                            {language === 'en' ? 'Welcome Back!' : 'Bon Retour !'}
                          </h2>
                          <p className="text-lg font-heading" style={{ color: '#B0B0B0' }}>
                            {language === 'en' 
                              ? 'Here\'s what\'s happening with your events today'
                              : 'Voici ce qui se passe avec vos événements aujourd\'hui'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-heading" style={{ color: '#B0B0B0' }}>
                              {language === 'en' ? 'Active Events' : 'Événements Actifs'}
                            </p>
                            <p className="text-2xl font-bold font-heading" style={{ color: '#E21836' }}>
                              {events.filter(e => e.event_type === 'upcoming' && new Date(e.date) >= new Date()).length}
                            </p>
                          </div>
                          <div className="h-12 w-px" style={{ backgroundColor: '#2A2A2A' }} />
                          <div className="text-right">
                            <p className="text-sm font-heading" style={{ color: '#B0B0B0' }}>
                              {language === 'en' ? 'Total Revenue' : 'Revenus Totaux'}
                            </p>
                            <p className="text-2xl font-bold font-heading" style={{ color: '#E21836' }}>
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
                    className={`group relative overflow-hidden transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                      animatedCards.has(0) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                        : 'opacity-0 translate-y-8'
                    }`}
                    style={{
                      backgroundColor: '#1F1F1F',
                      borderColor: '#2A2A2A'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3A3A3A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                    }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl" />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(107, 107, 107, 0.2)' }}>
                          <Clock className="w-6 h-6" style={{ color: '#6B6B6B' }} />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-heading">
                          <TrendingUp className="w-3 h-3" style={{ color: '#E21836' }} />
                          <span style={{ color: '#E21836' }}>+12%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-heading" style={{ color: '#B0B0B0' }}>{t.pendingApplications}</p>
                        <p className="text-3xl font-bold font-heading" style={{ color: '#FFFFFF' }}>
                            {pendingApplications.length}
                          </p>
                        <p className="text-xs font-heading" style={{ color: '#B0B0B0' }}>
                          {language === 'en' ? 'Awaiting review' : 'En attente de révision'}
                        </p>
                        </div>
                      {/* Mini Sparkline */}
                      <div className="mt-4 h-8 flex items-end gap-1">
                        {(() => {
                          const barValues = [3, 5, 4, 7, 6, 8, pendingApplications.length];
                          const maxValue = Math.max(...barValues, 1); // Ensure at least 1 to avoid division by zero
                          return barValues.map((h, i) => (
                            <div 
                              key={i}
                              className="flex-1 bg-yellow-500/30 rounded-t transition-all duration-300 hover:bg-yellow-500/50"
                              style={{ height: `${(h / maxValue) * 100}%` }}
                            />
                          ));
                        })()}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Approved Applications Card */}
                  <Card 
                    className={`group relative overflow-hidden transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                      animatedCards.has(1) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200' 
                        : 'opacity-0 translate-y-8'
                    }`}
                    style={{
                      backgroundColor: '#1F1F1F',
                      borderColor: '#2A2A2A'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3A3A3A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                    }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(226, 24, 54, 0.05)' }} />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(226, 24, 54, 0.2)' }}>
                          <CheckCircle className="w-6 h-6" style={{ color: '#E21836' }} />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-heading">
                          <TrendingUp className="w-3 h-3" style={{ color: '#E21836' }} />
                          <span style={{ color: '#E21836' }}>+8%</span>
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
                            className="flex-1 rounded-t transition-all duration-300"
                            style={{ backgroundColor: 'rgba(226, 24, 54, 0.3)', height: `${(h / 15) * 100}%` }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(226, 24, 54, 0.5)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(226, 24, 54, 0.3)'}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Events Card */}
                  <Card 
                    className={`group relative overflow-hidden transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                      animatedCards.has(2) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400' 
                        : 'opacity-0 translate-y-8'
                    }`}
                    style={{
                      backgroundColor: '#1F1F1F',
                      borderColor: '#2A2A2A'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3A3A3A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                    }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(0, 207, 255, 0.05)' }} />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(107, 107, 107, 0.2)' }}>
                          <CalendarIcon className="w-6 h-6" style={{ color: '#6B6B6B' }} />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-heading">
                          <TrendingUp className="w-3 h-3" style={{ color: '#E21836' }} />
                          <span style={{ color: '#E21836' }}>+15%</span>
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
                            className="flex-1 rounded-t transition-all duration-300"
                            style={{ backgroundColor: 'rgba(0, 207, 255, 0.3)', height: `${(h / 10) * 100}%` }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 207, 255, 0.5)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 207, 255, 0.3)'}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Approved Ambassadors Card */}
                  <Card 
                    className={`group relative overflow-hidden transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
                      animatedCards.has(3) 
                        ? 'animate-in slide-in-from-bottom-4 fade-in duration-700 delay-600' 
                        : 'opacity-0 translate-y-8'
                    }`}
                    style={{
                      backgroundColor: '#1F1F1F',
                      borderColor: '#2A2A2A'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3A3A3A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                    }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(107, 107, 107, 0.2)' }}>
                          <Users className="w-6 h-6" style={{ color: '#6B6B6B' }} />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-heading">
                          <TrendingUp className="w-3 h-3" style={{ color: '#E21836' }} />
                          <span style={{ color: '#E21836' }}>+22%</span>
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
                            className="flex-1 bg-primary/30 rounded-t transition-all duration-300 hover:bg-primary/50"
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
                  <Card 
                    className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-800 hover:shadow-lg transition-all duration-300"
                    style={{
                      backgroundColor: '#1F1F1F',
                      borderColor: '#2A2A2A'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3A3A3A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                    }}
                  >
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
                                className="w-full bg-gradient-to-t from-primary to-primary/80 rounded-t transition-all duration-300 group-hover:opacity-80 cursor-pointer"
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
                  <Card 
                    className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-1000 hover:shadow-lg transition-all duration-300"
                    style={{
                      backgroundColor: '#1F1F1F',
                      borderColor: '#2A2A2A'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3A3A3A';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                    }}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-heading" style={{ color: '#FFFFFF' }}>
                        <Target className="w-5 h-5" style={{ color: '#E21836' }} />
                        {language === 'en' ? 'Quick Actions' : 'Actions Rapides'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button 
                        onClick={() => setActiveTab("events")}
                        className="w-full justify-start font-heading"
                        style={{
                          backgroundColor: '#E21836',
                          color: '#FFFFFF',
                          border: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#C4162F';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#E21836';
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'Create New Event' : 'Créer un Nouvel Événement'}
                      </Button>
                      <Button 
                        onClick={() => setActiveTab("applications")}
                        className="w-full justify-start font-heading"
                        style={{
                          backgroundColor: '#1F1F1F',
                          color: '#FFFFFF',
                          borderColor: '#2A2A2A'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#252525';
                          e.currentTarget.style.borderColor = '#3A3A3A';
                          e.currentTarget.style.color = '#E21836';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#1F1F1F';
                          e.currentTarget.style.borderColor = '#2A2A2A';
                          e.currentTarget.style.color = '#FFFFFF';
                        }}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'Review Applications' : 'Examiner les Candidatures'}
                      </Button>
                      <Button 
                        onClick={() => setActiveTab("ambassadors")}
                        className="w-full justify-start font-heading"
                        style={{
                          backgroundColor: '#1F1F1F',
                          color: '#FFFFFF',
                          borderColor: '#2A2A2A'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#252525';
                          e.currentTarget.style.borderColor = '#3A3A3A';
                          e.currentTarget.style.color = '#E21836';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#1F1F1F';
                          e.currentTarget.style.borderColor = '#2A2A2A';
                          e.currentTarget.style.color = '#FFFFFF';
                        }}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'Manage Ambassadors' : 'Gérer les Ambassadeurs'}
                      </Button>
                      <Button 
                        onClick={() => setActiveTab("tickets")}
                        className="w-full justify-start font-heading"
                        style={{
                          backgroundColor: '#1F1F1F',
                          color: '#FFFFFF',
                          borderColor: '#2A2A2A'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#252525';
                          e.currentTarget.style.borderColor = '#3A3A3A';
                          e.currentTarget.style.color = '#E21836';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#1F1F1F';
                          e.currentTarget.style.borderColor = '#2A2A2A';
                          e.currentTarget.style.color = '#FFFFFF';
                        }}
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
                          <CalendarIcon className="w-5 h-5 text-primary" />
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
                                      <CalendarIcon className="w-3 h-3" />
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
                            <div 
                              className="p-2 rounded-lg"
                              style={{
                                backgroundColor: app.status === 'approved' 
                                  ? 'rgba(34, 197, 94, 0.2)' // Green
                                  : app.status === 'rejected' || app.status === 'removed'
                                  ? 'rgba(239, 68, 68, 0.2)' // Red
                                  : app.status === 'suspended'
                                  ? 'rgba(107, 114, 128, 0.2)' // Grey
                                  : 'rgba(249, 115, 22, 0.2)' // Orange
                              }}
                            >
                              {app.status === 'approved' ? (
                                <CheckCircle className="w-5 h-5" style={{ color: '#22C55E' }} /> // Green
                              ) : app.status === 'rejected' || app.status === 'removed' ? (
                                <XCircle className="w-5 h-5" style={{ color: '#EF4444' }} /> // Red
                              ) : app.status === 'suspended' ? (
                                <Pause className="w-5 h-5" style={{ color: '#6B7280' }} /> // Grey
                              ) : (
                                <Clock className="w-5 h-5" style={{ color: '#F97316' }} /> // Orange
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
                          // Initialize with empty passes and default event_type - admin must add at least one pass
                          setEditingEvent({
                            passes: [],
                            event_type: 'upcoming',
                            featured: false
                          } as Event);
                          // Clear pending files and validation errors when opening dialog
                          setPendingGalleryImages([]);
                          setPendingGalleryVideos([]);
                          setPassValidationErrors({});
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
                          <Label htmlFor="eventInstagramLink" className="flex items-center gap-2">
                            <Instagram className="w-4 h-4" />
                            {t.eventInstagramLink} *
                          </Label>
                          <Input
                            id="eventInstagramLink"
                            type="url"
                            value={editingEvent?.instagram_link || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditingEvent(prev => ({ ...prev, instagram_link: value }));
                            }}
                            placeholder="https://www.instagram.com/username"
                            className={editingEvent?.instagram_link && !isInstagramUrl(editingEvent.instagram_link) ? 'border-red-500' : ''}
                            required
                          />
                          {editingEvent?.instagram_link && !isInstagramUrl(editingEvent.instagram_link) && (
                            <p className="text-sm text-red-500 mt-1">
                              {language === 'en' 
                                ? 'Must be a valid Instagram URL (e.g., https://www.instagram.com/username)' 
                                : 'Doit être une URL Instagram valide (ex: https://www.instagram.com/username)'}
                            </p>
                          )}
                          {!editingEvent?.instagram_link && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {language === 'en' 
                                ? 'Must start with https://www.instagram.com/ or https://instagram.com/' 
                                : 'Doit commencer par https://www.instagram.com/ ou https://instagram.com/'}
                            </p>
                          )}
                        </div>
                        {/* Pass Management Section - All Passes Always Visible */}
                        <div className="space-y-4 border-t pt-6">
                          {/* Error Summary Banner - Show if there are validation errors */}
                          {Object.keys(passValidationErrors).length > 0 && (
                            <Alert variant="destructive" className="mb-4 animate-in slide-in-from-top-4">
                              <XCircle className="h-4 w-4" />
                              <AlertDescription>
                                <div className="font-semibold mb-2">
                                  {language === 'en' ? 'Please fix the following errors before saving:' : 'Veuillez corriger les erreurs suivantes avant d\'enregistrer :'}
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                  {Object.entries(passValidationErrors).map(([index, errors]) => {
                                    const pass = editingEvent?.passes?.[parseInt(index)];
                                    const passName = pass?.name || (language === 'en' ? `Pass #${parseInt(index) + 1}` : `Pass #${parseInt(index) + 1}`);
                                    return Object.entries(errors).map(([field, message]) => (
                                      <li key={`${index}-${field}`}>
                                        <strong>{passName}</strong> - {field === 'name' 
                                          ? (language === 'en' ? 'Name: ' : 'Nom : ') 
                                          : field === 'price' 
                                          ? (language === 'en' ? 'Price: ' : 'Prix : ')
                                          : (language === 'en' ? 'Description: ' : 'Description : ')}
                                        {message}
                                      </li>
                                    ));
                                  })}
                                </ul>
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-lg font-semibold">
                                {language === 'en' ? 'Pass Management' : 'Gestion des Passes'}
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                {language === 'en' 
                                  ? 'All passes are displayed below. At least one pass is required. Exactly one pass must be marked as primary.' 
                                  : 'Tous les passes sont affichés ci-dessous. Au moins un pass est requis. Exactement un pass doit être marqué comme principal.'}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Check for duplicate names before adding
                                const existingNames = (editingEvent?.passes || []).map(p => p.name.trim().toLowerCase());
                                const newPass: EventPass = {
                                  name: '',
                                  price: 0,
                                  description: '',
                                  is_primary: false
                                };
                                setEditingEvent(prev => ({
                                  ...prev,
                                  passes: [...(prev?.passes || []), newPass]
                                }));
                              }}
                              className="flex items-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              {language === 'en' ? 'Add New Pass' : 'Ajouter un Pass'}
                            </Button>
                          </div>
                          
                          {/* Display ALL passes - Primary first, then by price */}
                          <div className="space-y-4">
                            {(() => {
                              const passes = editingEvent?.passes || [];
                              
                              if (passes.length === 0) {
                                return (
                                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                                    {language === 'en' 
                                      ? 'No passes found. Add at least one pass to publish this event.' 
                                      : 'Aucun pass trouvé. Ajoutez au moins un pass pour publier cet événement.'}
                                  </div>
                                );
                              }
                              
                              // Sort: Primary first, then others by price, but keep track of original indices
                              const passesWithIndex = passes.map((pass, idx) => ({ pass, originalIndex: idx }));
                              const sortedPassesWithIndex = [...passesWithIndex].sort((a, b) => {
                                if (a.pass.is_primary && !b.pass.is_primary) return -1;
                                if (!a.pass.is_primary && b.pass.is_primary) return 1;
                                // If both primary or both non-primary, sort by price
                                const priceA = typeof a.pass.price === 'number' ? a.pass.price : parseFloat(String(a.pass.price)) || 0;
                                const priceB = typeof b.pass.price === 'number' ? b.pass.price : parseFloat(String(b.pass.price)) || 0;
                                return priceA - priceB;
                              });

                              return sortedPassesWithIndex.map(({ pass, originalIndex }) => {
                                const isPrimary = pass.is_primary;
                                
                                return (
                                  <Card 
                                    key={originalIndex} 
                                    className={`${isPrimary ? 'border-2 border-primary/50 bg-primary/5 shadow-md' : 'border border-border'}`}
                                  >
                                    <CardContent className="p-5">
                                      {/* Header with Badge and Delete */}
                                      <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                          {isPrimary && (
                                            <Badge variant="default" className="text-xs font-semibold">
                                              {language === 'en' ? 'PRIMARY PASS' : 'PASS PRINCIPAL'}
                                            </Badge>
                                          )}
                                          {!isPrimary && (
                                            <Badge variant="outline" className="text-xs">
                                              {language === 'en' ? 'Pass' : 'Pass'}
                                            </Badge>
                                          )}
                                          <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-foreground">
                                              {pass.name || (language === 'en' ? 'New Pass' : 'Nouveau Pass')}
                                            </span>
                                            {pass.price !== undefined && pass.price !== null && (
                                              <span className="text-lg font-bold text-primary">
                                                {typeof pass.price === 'number' ? pass.price.toFixed(2) : parseFloat(String(pass.price)).toFixed(2)} TND
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const updatedPasses = editingEvent.passes?.filter((_, i) => i !== originalIndex) || [];
                                            setEditingEvent(prev => ({ ...prev, passes: updatedPasses }));
                                          }}
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            title={language === 'en' ? 'Remove this pass' : 'Supprimer ce pass'}
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                      </div>
                                      
                                      {/* Pass Details - Always Visible */}
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Pass Name */}
                                        <div>
                                          <Label htmlFor={`pass-name-${originalIndex}`} className="flex items-center gap-2">
                                            {language === 'en' ? 'Pass Name' : 'Nom du Pass'} *
                                          </Label>
                                          <Input
                                            id={`pass-name-${originalIndex}`}
                                            value={pass.name}
                                            onChange={(e) => {
                                              const newName = e.target.value;
                                              // Clear error for this field when user types
                                              if (passValidationErrors[originalIndex]?.name) {
                                                const newErrors = { ...passValidationErrors };
                                                delete newErrors[originalIndex]?.name;
                                                if (Object.keys(newErrors[originalIndex] || {}).length === 0) {
                                                  delete newErrors[originalIndex];
                                                }
                                                setPassValidationErrors(newErrors);
                                              }
                                              
                                              // Check for duplicates (case-insensitive)
                                              const existingNames = editingEvent.passes
                                                ?.filter((p, i) => i !== originalIndex)
                                                .map(p => p.name.trim().toLowerCase()) || [];
                                              
                                              if (existingNames.includes(newName.trim().toLowerCase()) && newName.trim() !== '') {
                                                setPassValidationErrors(prev => ({
                                                  ...prev,
                                                  [originalIndex]: {
                                                    ...prev[originalIndex],
                                                    name: language === 'en' 
                                                      ? `A pass with the name "${newName}" already exists.` 
                                                      : `Un pass avec le nom "${newName}" existe déjà.`
                                                  }
                                                }));
                                                return;
                                              }
                                              
                                              const updatedPasses = [...(editingEvent.passes || [])];
                                              updatedPasses[originalIndex] = { ...pass, name: newName };
                                              setEditingEvent(prev => ({ ...prev, passes: updatedPasses }));
                                            }}
                                            placeholder={language === 'en' ? 'e.g., VIP, Early Bird, Standard' : 'ex: VIP, Early Bird, Standard'}
                                            className={passValidationErrors[originalIndex]?.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
                                            required
                                          />
                                          {passValidationErrors[originalIndex]?.name && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                              <XCircle className="w-3 h-3" />
                                              {passValidationErrors[originalIndex].name}
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* Price - Always Editable */}
                                        <div>
                                          <Label htmlFor={`pass-price-${originalIndex}`}>
                                            {language === 'en' ? 'Price (TND)' : 'Prix (TND)'} *
                                          </Label>
                                          <Input
                                            id={`pass-price-${originalIndex}`}
                                            type="number"
                                            min="1"
                                            step="0.01"
                                            value={pass.price !== undefined && pass.price !== null ? pass.price : ''}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              // Allow empty input while typing
                                              if (value === '') {
                                                const updatedPasses = [...(editingEvent.passes || [])];
                                                updatedPasses[originalIndex] = { ...pass, price: undefined };
                                                setEditingEvent(prev => ({ ...prev, passes: updatedPasses }));
                                                return;
                                              }
                                              
                                              const numValue = parseFloat(value);
                                              
                                              // Clear error for this field when user types valid value
                                              if (passValidationErrors[originalIndex]?.price && !isNaN(numValue) && numValue > 0) {
                                                const newErrors = { ...passValidationErrors };
                                                delete newErrors[originalIndex]?.price;
                                                if (Object.keys(newErrors[originalIndex] || {}).length === 0) {
                                                  delete newErrors[originalIndex];
                                                }
                                                setPassValidationErrors(newErrors);
                                              }
                                              
                                              if (isNaN(numValue) || numValue <= 0) {
                                                return;
                                              }
                                              
                                              const updatedPasses = [...(editingEvent.passes || [])];
                                              updatedPasses[originalIndex] = { ...pass, price: numValue };
                                              setEditingEvent(prev => ({ ...prev, passes: updatedPasses }));
                                            }}
                                            placeholder="0.00"
                                            required
                                            className={`font-semibold ${passValidationErrors[originalIndex]?.price ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                                          />
                                          {passValidationErrors[originalIndex]?.price && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                              <XCircle className="w-3 h-3" />
                                              {passValidationErrors[originalIndex].price}
                                            </p>
                                          )}
                                          {!passValidationErrors[originalIndex]?.price && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              {language === 'en' ? 'Must be > 0 TND' : 'Doit être > 0 TND'}
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* Description - Optional */}
                                        <div className="md:col-span-1">
                                          <Label htmlFor={`pass-description-${originalIndex}`}>
                                            {language === 'en' ? 'Description' : 'Description'}
                                          </Label>
                                          <Textarea
                                            id={`pass-description-${originalIndex}`}
                                            value={pass.description || ''}
                                            onChange={(e) => {
                                              // Clear error for this field when user types
                                              if (passValidationErrors[originalIndex]?.description) {
                                                const newErrors = { ...passValidationErrors };
                                                delete newErrors[originalIndex]?.description;
                                                if (Object.keys(newErrors[originalIndex] || {}).length === 0) {
                                                  delete newErrors[originalIndex];
                                                }
                                                setPassValidationErrors(newErrors);
                                              }
                                              
                                              const updatedPasses = [...(editingEvent.passes || [])];
                                              updatedPasses[originalIndex] = { ...pass, description: e.target.value };
                                              setEditingEvent(prev => ({ ...prev, passes: updatedPasses }));
                                            }}
                                            placeholder={language === 'en' 
                                              ? 'What does this pass include? (optional)' 
                                              : 'Que comprend ce pass ? (optionnel)'}
                                            rows={3}
                                            className={passValidationErrors[originalIndex]?.description ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
                                          />
                                          {passValidationErrors[originalIndex]?.description && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                              <XCircle className="w-3 h-3" />
                                              {passValidationErrors[originalIndex].description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Primary Pass Checkbox */}
                                      <div className="mt-4 flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={`pass-primary-${originalIndex}`}
                                          checked={pass.is_primary || false}
                                          onChange={(e) => {
                                            const isPrimary = e.target.checked;
                                            // If setting this pass as primary, unset all others
                                            const updatedPasses = (editingEvent.passes || []).map((p, i) => ({
                                              ...p,
                                              is_primary: i === originalIndex ? isPrimary : false
                                            }));
                                            setEditingEvent(prev => ({ ...prev, passes: updatedPasses }));
                                          }}
                                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <Label htmlFor={`pass-primary-${originalIndex}`} className="text-sm font-medium cursor-pointer">
                                          {language === 'en' 
                                            ? 'Mark as primary pass (selected by default on frontend)' 
                                            : 'Marquer comme pass principal (sélectionné par défaut sur le frontend)'}
                                        </Label>
                                      </div>
                                      
                                      {/* Info Message for Primary */}
                                      {isPrimary && (
                                        <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                                          <p className="text-xs text-foreground flex items-center gap-2">
                                            <Info className="w-4 h-4 text-primary" />
                                            {language === 'en' 
                                              ? 'This is the primary pass. It will be selected by default on the event page.' 
                                              : 'Ceci est le pass principal. Il sera sélectionné par défaut sur la page de l\'événement.'}
                                          </p>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                );
                              });
                            })()}
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
                        <div>
                          <Label>{t.eventPoster}</Label>
                          <FileUpload
                            onFileSelect={(file) => setEditingEvent(prev => ({ ...prev, _uploadFile: file }))}
                            onUrlChange={(url) => setEditingEvent(prev => ({ ...prev, poster_url: url }))}
                            currentUrl={editingEvent?.poster_url}
                            accept="image/*"
                          />
                        </div>
                        {/* Gallery Images & Videos - Only show for Gallery Events */}
                        {editingEvent?.event_type === 'gallery' && (
                          <div className="space-y-6 border-t pt-6">
                            {/* Gallery Images Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-lg font-semibold flex items-center gap-2">
                                  <Image className="w-5 h-5" />
                                  {t.galleryImages}
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
                                        handleGalleryFileSelect(files, 'images');
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
                                    {t.addGalleryFile}
                                  </Label>
                                </div>
                              </div>
                              {/* Existing uploaded images */}
                              {editingEvent?.gallery_images && editingEvent.gallery_images.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {language === 'en' ? 'Uploaded Images' : 'Images Téléchargées'}
                                  </Label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {editingEvent.gallery_images.map((url, index) => (
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
                                          onClick={() => removeGalleryFile(index, 'images')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Pending images (to be uploaded on save) */}
                              {pendingGalleryImages.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {language === 'en' ? `Pending Images (${pendingGalleryImages.length}) - Will upload on save` : `Images en Attente (${pendingGalleryImages.length}) - Sera téléchargé lors de l'enregistrement`}
                                  </Label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {pendingGalleryImages.map((file, index) => (
                                      <div key={`pending-${index}`} className="relative group">
                                        <img
                                          src={URL.createObjectURL(file)}
                                          alt={`Pending image ${index + 1}`}
                                          className="w-full h-32 object-cover rounded-lg border border-dashed border-primary"
                                        />
                                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Badge variant="secondary" className="text-xs">
                                            {language === 'en' ? 'Pending' : 'En Attente'}
                                          </Badge>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => removePendingGalleryFile(index, 'images')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(!editingEvent?.gallery_images || editingEvent.gallery_images.length === 0) && pendingGalleryImages.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  {language === 'en' 
                                    ? 'No gallery images. Select images to upload when you save.' 
                                    : 'Aucune image de galerie. Sélectionnez des images à télécharger lors de l\'enregistrement.'}
                                </p>
                              )}
                            </div>

                            {/* Gallery Videos Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-lg font-semibold flex items-center gap-2">
                                  <Video className="w-5 h-5" />
                                  {t.galleryVideos}
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
                                        handleGalleryFileSelect(files, 'videos');
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
                                    {t.addGalleryFile}
                                  </Label>
                                </div>
                              </div>
                              {/* Existing uploaded videos */}
                              {editingEvent?.gallery_videos && editingEvent.gallery_videos.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {language === 'en' ? 'Uploaded Videos' : 'Vidéos Téléchargées'}
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {editingEvent.gallery_videos.map((url, index) => (
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
                                          onClick={() => removeGalleryFile(index, 'videos')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Pending videos (to be uploaded on save) */}
                              {pendingGalleryVideos.length > 0 && (
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">
                                    {language === 'en' ? `Pending Videos (${pendingGalleryVideos.length}) - Will upload on save` : `Vidéos en Attente (${pendingGalleryVideos.length}) - Sera téléchargé lors de l'enregistrement`}
                                  </Label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {pendingGalleryVideos.map((file, index) => (
                                      <div key={`pending-video-${index}`} className="relative group">
                                        <video
                                          src={URL.createObjectURL(file)}
                                          controls
                                          className="w-full h-48 object-cover rounded-lg border border-dashed border-primary"
                                        />
                                        <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded text-xs">
                                          <Badge variant="secondary">
                                            {language === 'en' ? 'Pending' : 'En Attente'}
                                          </Badge>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                          onClick={() => removePendingGalleryFile(index, 'videos')}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(!editingEvent?.gallery_videos || editingEvent.gallery_videos.length === 0) && pendingGalleryVideos.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  {language === 'en' 
                                    ? 'No gallery videos. Select videos to upload when you save.' 
                                    : 'Aucune vidéo de galerie. Sélectionnez des vidéos à télécharger lors de l\'enregistrement.'}
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
                                {event.passes.length} {language === 'en' ? 'pass(es)' : 'pass(es)'} available
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4 animate-in slide-in-from-bottom-4 duration-500 delay-700">
                          <Button 
                            size="sm" 
                            variant="outline" 
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
                              setPendingGalleryImages([]);
                              setPendingGalleryVideos([]);
                              setPassValidationErrors({});
                              
                              // Set editingEvent first, then open dialog after a microtask
                              // This ensures the state is set before the dialog renders
                              setEditingEvent(eventWithPasses);
                              
                              
                              // Use setTimeout to ensure state update completes before dialog opens
                              // This prevents the dialog from rendering with stale/empty passes
                              setTimeout(() => {
                                setIsEventDialogOpen(true);
                              }, 0);
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

              {/* Admins Management Tab - Only visible to super_admin */}
              {currentAdminRole === 'super_admin' && (
                <TabsContent value="admins" className="space-y-6">
                  <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
                    <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">
                      {language === 'en' ? 'Admin Management' : 'Gestion des Administrateurs'}
                    </h2>
                    <Dialog open={isAddAdminDialogOpen} onOpenChange={setIsAddAdminDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          onClick={() => {
                            setNewAdminData({ name: '', email: '', phone: '' });
                            setIsAddAdminDialogOpen(true);
                          }}
                          className="animate-in slide-in-from-right-4 duration-1000 delay-300 transform hover:scale-105 transition-all duration-300"
                        >
                          <Plus className="w-4 h-4 mr-2 animate-pulse" />
                          {language === 'en' ? 'Add Admin' : 'Ajouter un Admin'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl animate-in zoom-in-95 duration-300">
                        <DialogHeader>
                          <DialogTitle>
                            {language === 'en' ? 'Add New Admin' : 'Ajouter un Nouvel Admin'}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="adminName">{language === 'en' ? 'Name' : 'Nom'}</Label>
                            <Input
                              id="adminName"
                              value={newAdminData.name}
                              onChange={(e) => setNewAdminData({ ...newAdminData, name: e.target.value })}
                              placeholder={language === 'en' ? 'Enter admin name' : 'Entrez le nom de l\'admin'}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="adminEmail">{language === 'en' ? 'Email' : 'Email'}</Label>
                            <Input
                              id="adminEmail"
                              type="email"
                              value={newAdminData.email}
                              onChange={(e) => setNewAdminData({ ...newAdminData, email: e.target.value })}
                              placeholder={language === 'en' ? 'Enter admin email' : 'Entrez l\'email de l\'admin'}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="adminPhone">{language === 'en' ? 'Phone Number' : 'Numéro de Téléphone'}</Label>
                            <Input
                              id="adminPhone"
                              type="tel"
                              value={newAdminData.phone}
                              onChange={(e) => setNewAdminData({ ...newAdminData, phone: e.target.value })}
                              placeholder={language === 'en' ? 'Enter phone number (optional)' : 'Entrez le numéro de téléphone (optionnel)'}
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => setIsAddAdminDialogOpen(false)}
                            >
                              {language === 'en' ? 'Cancel' : 'Annuler'}
                            </Button>
                            <Button
                              onClick={handleAddAdmin}
                              disabled={processingId === 'new-admin'}
                            >
                              {processingId === 'new-admin' ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  {language === 'en' ? 'Creating...' : 'Création...'}
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-2" />
                                  {language === 'en' ? 'Create Admin' : 'Créer l\'Admin'}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Edit Admin Dialog */}
                  <Dialog open={isEditAdminDialogOpen} onOpenChange={setIsEditAdminDialogOpen}>
                    <DialogContent className="max-w-2xl animate-in zoom-in-95 duration-300">
                      <DialogHeader>
                        <DialogTitle>
                          {language === 'en' ? 'Edit Admin' : 'Modifier l\'Admin'}
                        </DialogTitle>
                      </DialogHeader>
                      {editingAdmin && (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="editAdminName">{language === 'en' ? 'Name' : 'Nom'}</Label>
                            <Input
                              id="editAdminName"
                              value={editingAdmin.name}
                              onChange={(e) => setEditingAdmin({ ...editingAdmin, name: e.target.value })}
                              placeholder={language === 'en' ? 'Enter admin name' : 'Entrez le nom de l\'admin'}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="editAdminEmail">{language === 'en' ? 'Email' : 'Email'}</Label>
                            <Input
                              id="editAdminEmail"
                              type="email"
                              value={editingAdmin.email}
                              onChange={(e) => setEditingAdmin({ ...editingAdmin, email: e.target.value })}
                              placeholder={language === 'en' ? 'Enter admin email' : 'Entrez l\'email de l\'admin'}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="editAdminPhone">{language === 'en' ? 'Phone Number' : 'Numéro de Téléphone'}</Label>
                            <Input
                              id="editAdminPhone"
                              type="tel"
                              value={editingAdmin.phone || ''}
                              onChange={(e) => setEditingAdmin({ ...editingAdmin, phone: e.target.value })}
                              placeholder={language === 'en' ? 'Enter phone number (optional)' : 'Entrez le numéro de téléphone (optionnel)'}
                            />
                          </div>
                          <div>
                            <Label htmlFor="editAdminRole">{language === 'en' ? 'Role' : 'Rôle'}</Label>
                            <Select 
                              value={editingAdmin.role} 
                              onValueChange={(value: 'admin' | 'super_admin') => setEditingAdmin({ ...editingAdmin, role: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">{language === 'en' ? 'Admin' : 'Admin'}</SelectItem>
                                <SelectItem value="super_admin">{language === 'en' ? 'Super Admin' : 'Super Admin'}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="editAdminActive"
                              checked={editingAdmin.is_active}
                              onChange={(e) => setEditingAdmin({ ...editingAdmin, is_active: e.target.checked })}
                            />
                            <Label htmlFor="editAdminActive">{language === 'en' ? 'Active' : 'Actif'}</Label>
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingAdmin(null);
                                setIsEditAdminDialogOpen(false);
                              }}
                            >
                              {language === 'en' ? 'Cancel' : 'Annuler'}
                            </Button>
                            <Button
                              onClick={handleEditAdmin}
                              disabled={processingId === `edit-admin-${editingAdmin.id}`}
                            >
                              {processingId === `edit-admin-${editingAdmin.id}` ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  {language === 'en' ? 'Saving...' : 'Enregistrement...'}
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  {language === 'en' ? 'Save Changes' : 'Enregistrer les Modifications'}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  <Card className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300">
                    <CardHeader>
                      <CardTitle>{language === 'en' ? 'All Admins' : 'Tous les Admins'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === 'en' ? 'Name' : 'Nom'}</TableHead>
                            <TableHead>{language === 'en' ? 'Email' : 'Email'}</TableHead>
                            <TableHead>{language === 'en' ? 'Phone' : 'Téléphone'}</TableHead>
                            <TableHead>{language === 'en' ? 'Role' : 'Rôle'}</TableHead>
                            <TableHead>{language === 'en' ? 'Status' : 'Statut'}</TableHead>
                            <TableHead>{language === 'en' ? 'Created' : 'Créé'}</TableHead>
                            <TableHead>{language === 'en' ? 'Actions' : 'Actions'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {admins.map((admin) => (
                            <TableRow key={admin.id}>
                              <TableCell className="font-medium">{admin.name}</TableCell>
                              <TableCell>{admin.email}</TableCell>
                              <TableCell>{admin.phone || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                                  {admin.role === 'super_admin' 
                                    ? (language === 'en' ? 'Super Admin' : 'Super Admin')
                                    : (language === 'en' ? 'Admin' : 'Admin')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={admin.is_active ? 'default' : 'destructive'}>
                                  {admin.is_active 
                                    ? (language === 'en' ? 'Active' : 'Actif')
                                    : (language === 'en' ? 'Inactive' : 'Inactif')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(admin.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingAdmin({
                                        id: admin.id,
                                        name: admin.name,
                                        email: admin.email,
                                        phone: admin.phone,
                                        role: admin.role,
                                        is_active: admin.is_active,
                                      });
                                      setIsEditAdminDialogOpen(true);
                                    }}
                                    disabled={processingId === `edit-admin-${admin.id}`}
                                    className="transform hover:scale-105 transition-all duration-300"
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    {processingId === `edit-admin-${admin.id}` ? (language === 'en' ? 'Saving...' : 'Enregistrement...') : (language === 'en' ? 'Edit' : 'Modifier')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteAdmin(admin.id)}
                                    disabled={processingId === `delete-admin-${admin.id}` || admin.id === currentAdminId}
                                    className="transform hover:scale-105 transition-all duration-300"
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    {processingId === `delete-admin-${admin.id}` ? (language === 'en' ? 'Deleting...' : 'Suppression...') : (language === 'en' ? 'Delete' : 'Supprimer')}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {admins.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                {language === 'en' ? 'No admins found' : 'Aucun admin trouvé'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}


              

              {/* Ambassadors Tab */}
              <TabsContent value="ambassadors" className="space-y-6">
                <div className="flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-700">
                  <h2 className="text-2xl font-bold text-gradient-neon animate-in slide-in-from-left-4 duration-1000">Ambassadors Management</h2>
                  <div className="flex items-center gap-3 animate-in slide-in-from-right-4 duration-1000 delay-300">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportApprovedAmbassadorsToExcel}
                      className="transform hover:scale-105 transition-all duration-300"
                      style={{
                        background: '#1F1F1F',
                        borderColor: '#2A2A2A',
                        color: '#FFFFFF'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#E21836';
                        e.currentTarget.style.borderColor = '#E21836';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#1F1F1F';
                        e.currentTarget.style.borderColor = '#2A2A2A';
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {language === 'en' ? 'Export to Excel' : 'Exporter vers Excel'}
                    </Button>
                    <Dialog open={isAmbassadorDialogOpen} onOpenChange={setIsAmbassadorDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          onClick={() => {
                            setEditingAmbassador({} as Ambassador);
                              setAmbassadorErrors({});
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
                      {editingAmbassador?.id ? (
                        // Edit form for existing ambassadors
                      <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                              <Label htmlFor="ambassadorName">{t.ambassadorName} <span className="text-destructive">*</span></Label>
                            <Input
                              id="ambassadorName"
                              value={editingAmbassador?.full_name || ''}
                                onChange={(e) => {
                                  setEditingAmbassador(prev => ({ ...prev, full_name: e.target.value }));
                                  if (ambassadorErrors.full_name) {
                                    setAmbassadorErrors(prev => ({ ...prev, full_name: undefined }));
                                  }
                                }}
                                className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.full_name ? 'border-destructive' : ''}`}
                                required
                              />
                              {ambassadorErrors.full_name && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.full_name}</p>
                              )}
                          </div>
                          <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                              <Label htmlFor="ambassadorAge">{language === 'en' ? 'Age' : 'Âge'} <span className="text-destructive">*</span></Label>
                            <Input
                              id="ambassadorAge"
                              type="number"
                              min="16"
                              max="99"
                              value={editingAmbassador?.age || ''}
                                onChange={(e) => {
                                  const ageValue = e.target.value;
                                  setEditingAmbassador(prev => ({ ...prev, age: ageValue ? parseInt(ageValue) : undefined }));
                                }}
                                className="transition-all duration-300 focus:scale-105"
                                required
                              />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                              <Label htmlFor="ambassadorPhone">{t.ambassadorPhone} <span className="text-destructive">*</span></Label>
                            <Input
                              id="ambassadorPhone"
                              value={editingAmbassador?.phone || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const digitsOnly = value.replace(/\D/g, '');
                                  const limited = digitsOnly.slice(0, 8);
                                  setEditingAmbassador(prev => ({ ...prev, phone: limited }));
                                  if (ambassadorErrors.phone) {
                                    setAmbassadorErrors(prev => ({ ...prev, phone: undefined }));
                                  }
                                }}
                                placeholder="24951234"
                                className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.phone ? 'border-destructive' : ''}`}
                                required
                              />
                              {ambassadorErrors.phone && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.phone}</p>
                              )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <Label htmlFor="ambassadorEmail">{t.ambassadorEmail} <span className="text-destructive">*</span></Label>
                            <Input
                              id="ambassadorEmail"
                              type="email"
                              value={editingAmbassador?.email || ''}
                                onChange={(e) => {
                                  setEditingAmbassador(prev => ({ ...prev, email: e.target.value }));
                                  if (ambassadorErrors.email) {
                                    setAmbassadorErrors(prev => ({ ...prev, email: undefined }));
                                  }
                                }}
                                className={ambassadorErrors.email ? 'border-destructive' : ''}
                                required
                              />
                              {ambassadorErrors.email && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.email}</p>
                              )}
                          </div>
                          <div>
                              <Label htmlFor="ambassadorCity">{t.ambassadorCity} <span className="text-destructive">*</span></Label>
                            <Select
                              value={editingAmbassador?.city || ''}
                              onValueChange={(value) => {
                                setEditingAmbassador(prev => ({ 
                                  ...prev, 
                                  city: value,
                                  ville: (value === 'Sousse' || value === 'Tunis') ? prev?.ville : ''
                                }));
                                if (ambassadorErrors.city) {
                                  setAmbassadorErrors(prev => ({ ...prev, city: undefined }));
                                }
                              }}
                            >
                              <SelectTrigger className={ambassadorErrors.city ? 'border-destructive' : ''}>
                                <SelectValue placeholder={language === 'en' ? 'Select a city' : 'Sélectionner une ville'} />
                              </SelectTrigger>
                              <SelectContent>
                                {CITIES.map((city) => (
                                  <SelectItem key={city} value={city}>{city}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                              {ambassadorErrors.city && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.city}</p>
                              )}
                          </div>
                        </div>
                        {(editingAmbassador?.city === 'Sousse' || editingAmbassador?.city === 'Tunis') && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="ambassadorVille">{language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'} <span className="text-destructive">*</span></Label>
                              <Select
                                value={editingAmbassador?.ville || ''}
                                onValueChange={(value) => {
                                  setEditingAmbassador(prev => ({ ...prev, ville: value }));
                                  if (ambassadorErrors.ville) {
                                    setAmbassadorErrors(prev => ({ ...prev, ville: undefined }));
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={language === 'en' ? 'Select a neighborhood' : 'Sélectionner un quartier'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {editingAmbassador?.city === 'Sousse' && SOUSSE_VILLES.map((ville) => (
                                    <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                                  ))}
                                  {editingAmbassador?.city === 'Tunis' && TUNIS_VILLES.map((ville) => (
                                    <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {ambassadorErrors.ville && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.ville}</p>
                              )}
                            </div>
                          </div>
                        )}
                        <div>
                          <Label htmlFor="ambassadorSocialLink">{language === 'en' ? 'Instagram Link' : 'Lien Instagram'}</Label>
                          <Input
                            id="ambassadorSocialLink"
                            type="url"
                            value={editingAmbassador?.social_link || ''}
                            onChange={(e) => {
                              setEditingAmbassador(prev => ({ ...prev, social_link: e.target.value }));
                              if (ambassadorErrors.social_link) {
                                setAmbassadorErrors(prev => ({ ...prev, social_link: undefined }));
                              }
                            }}
                            placeholder="https://www.instagram.com/username"
                            className="transition-all duration-300 focus:scale-105"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {language === 'en' 
                              ? 'Must start with https://www.instagram.com/ or https://instagram.com/' 
                              : 'Doit commencer par https://www.instagram.com/ ou https://instagram.com/'}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="ambassadorCommission">{t.ambassadorCommission}</Label>
                            <Input
                              id="ambassadorCommission"
                              type="number"
                              step="0.01"
                                min="0"
                                max="100"
                              value={editingAmbassador?.commission_rate || ''}
                              onChange={(e) => setEditingAmbassador(prev => ({ ...prev, commission_rate: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                            <div>
                            <Label htmlFor="ambassadorPassword">{t.ambassadorPassword}</Label>
                            <div className="relative">
                              <Input
                                id="ambassadorPassword"
                                type={showPassword ? "text" : "password"}
                                value={editingAmbassador?.password || ''}
                                  onChange={(e) => {
                                    setEditingAmbassador(prev => ({ ...prev, password: e.target.value }));
                                    if (ambassadorErrors.password) {
                                      setAmbassadorErrors(prev => ({ ...prev, password: undefined }));
                                    }
                                  }}
                                  className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.password ? 'border-destructive' : ''}`}
                                  placeholder={language === 'en' ? 'Leave empty to keep current password' : 'Laisser vide pour garder le mot de passe actuel'}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 transition-all duration-300 hover:scale-110"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4 animate-pulse" /> : <Eye className="w-4 h-4 animate-pulse" />}
                              </button>
                            </div>
                              {ambassadorErrors.password && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.password}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {language === 'en' ? 'Leave empty to keep current password' : 'Laisser vide pour garder le mot de passe actuel'}
                              </p>
                          </div>
                        </div>
                      </div>
                      ) : (
                        // New ambassador form (matches application form)
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
                              <Label htmlFor="newAmbassadorName">{language === 'en' ? 'Full Name' : 'Nom Complet'} <span className="text-destructive">*</span></Label>
                              <Input
                                id="newAmbassadorName"
                                value={newAmbassadorForm.full_name}
                                onChange={(e) => {
                                  setNewAmbassadorForm(prev => ({ ...prev, full_name: e.target.value }));
                                  if (ambassadorErrors.full_name) {
                                    setAmbassadorErrors(prev => ({ ...prev, full_name: undefined }));
                                  }
                                }}
                                className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.full_name ? 'border-destructive' : ''}`}
                                required
                              />
                              {ambassadorErrors.full_name && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.full_name}</p>
                              )}
                            </div>
                            <div className="animate-in slide-in-from-right-4 duration-500 delay-500">
                              <Label htmlFor="newAmbassadorAge">{language === 'en' ? 'Age' : 'Âge'} <span className="text-destructive">*</span></Label>
                              <Input
                                id="newAmbassadorAge"
                                type="number"
                                min="16"
                                max="99"
                                value={newAmbassadorForm.age}
                                onChange={(e) => {
                                  setNewAmbassadorForm(prev => ({ ...prev, age: e.target.value }));
                                  if (ambassadorErrors.full_name) {
                                    setAmbassadorErrors(prev => ({ ...prev, full_name: undefined }));
                                  }
                                }}
                                className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.full_name ? 'border-destructive' : ''}`}
                                required
                              />
                              {ambassadorErrors.full_name && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.full_name}</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="newAmbassadorPhone">{language === 'en' ? 'Phone Number' : 'Numéro de Téléphone'} <span className="text-destructive">*</span></Label>
                              <Input
                                id="newAmbassadorPhone"
                                type="tel"
                                value={newAmbassadorForm.phone_number}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const digitsOnly = value.replace(/\D/g, '');
                                  const limited = digitsOnly.slice(0, 8);
                                  setNewAmbassadorForm(prev => ({ ...prev, phone_number: limited }));
                                  if (ambassadorErrors.phone) {
                                    setAmbassadorErrors(prev => ({ ...prev, phone: undefined }));
                                  }
                                }}
                                placeholder="24951234"
                                className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.phone ? 'border-destructive' : ''}`}
                                required
                              />
                              {ambassadorErrors.phone && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.phone}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {language === 'en' ? '8 digits starting with 2, 4, 9, or 5' : '8 chiffres commençant par 2, 4, 9 ou 5'}
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="newAmbassadorEmail">{language === 'en' ? 'Email' : 'Email'} <span className="text-destructive">*</span></Label>
                              <Input
                                id="newAmbassadorEmail"
                                type="email"
                                value={newAmbassadorForm.email}
                                onChange={(e) => {
                                  setNewAmbassadorForm(prev => ({ ...prev, email: e.target.value }));
                                  if (ambassadorErrors.email) {
                                    setAmbassadorErrors(prev => ({ ...prev, email: undefined }));
                                  }
                                }}
                                className={ambassadorErrors.email ? 'border-destructive' : ''}
                                required
                              />
                              {ambassadorErrors.email && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.email}</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="newAmbassadorCity">{language === 'en' ? 'City' : 'Ville'} <span className="text-destructive">*</span></Label>
                              <Select
                                value={newAmbassadorForm.city}
                                onValueChange={(value) => {
                                  setNewAmbassadorForm(prev => ({ 
                                    ...prev, 
                                    city: value,
                                    ville: (value === 'Sousse' || value === 'Tunis') ? prev.ville : ''
                                  }));
                                  if (ambassadorErrors.city) {
                                    setAmbassadorErrors(prev => ({ ...prev, city: undefined }));
                                  }
                                }}
                              >
                                <SelectTrigger className={ambassadorErrors.city ? 'border-destructive' : ''}>
                                  <SelectValue placeholder={language === 'en' ? 'Select a city' : 'Sélectionner une ville'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {CITIES.map((city) => (
                                    <SelectItem key={city} value={city}>{city}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {ambassadorErrors.city && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.city}</p>
                              )}
                            </div>
                            <div>
                              <Label htmlFor="newAmbassadorSocial">{language === 'en' ? 'Instagram Link' : 'Lien Instagram'}</Label>
                              <Input
                                id="newAmbassadorSocial"
                                type="url"
                                value={newAmbassadorForm.social_link}
                                onChange={(e) => {
                                  setNewAmbassadorForm(prev => ({ ...prev, social_link: e.target.value }));
                                  if (ambassadorErrors.social_link) {
                                    setAmbassadorErrors(prev => ({ ...prev, social_link: undefined }));
                                  }
                                }}
                                placeholder="https://www.instagram.com/username"
                                className={`transition-all duration-300 focus:scale-105 ${ambassadorErrors.social_link ? 'border-destructive' : ''}`}
                              />
                              {ambassadorErrors.social_link && (
                                <p className="text-sm text-destructive mt-1">{ambassadorErrors.social_link}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {language === 'en' 
                                  ? 'Must start with https://www.instagram.com/ or https://instagram.com/' 
                                  : 'Doit commencer par https://www.instagram.com/ ou https://instagram.com/'}
                              </p>
                            </div>
                          </div>
                          {(newAmbassadorForm.city === 'Sousse' || newAmbassadorForm.city === 'Tunis') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="newAmbassadorVille">{language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'} <span className="text-destructive">*</span></Label>
                                <Select
                                  value={newAmbassadorForm.ville}
                                  onValueChange={(value) => {
                                    setNewAmbassadorForm(prev => ({ ...prev, ville: value }));
                                    if (ambassadorErrors.ville) {
                                      setAmbassadorErrors(prev => ({ ...prev, ville: undefined }));
                                    }
                                  }}
                                >
                                  <SelectTrigger className={ambassadorErrors.ville ? 'border-destructive' : ''}>
                                    <SelectValue placeholder={language === 'en' ? 'Select a neighborhood' : 'Sélectionner un quartier'} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {newAmbassadorForm.city === 'Sousse' && SOUSSE_VILLES.map((ville) => (
                                      <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                                    ))}
                                    {newAmbassadorForm.city === 'Tunis' && TUNIS_VILLES.map((ville) => (
                                      <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {ambassadorErrors.ville && (
                                  <p className="text-sm text-destructive mt-1">{ambassadorErrors.ville}</p>
                                )}
                              </div>
                            </div>
                          )}
                          <div>
                            <Label htmlFor="newAmbassadorMotivation">{language === 'en' ? 'Motivation' : 'Motivation'}</Label>
                            <Textarea
                              id="newAmbassadorMotivation"
                              value={newAmbassadorForm.motivation}
                              onChange={(e) => setNewAmbassadorForm(prev => ({ ...prev, motivation: e.target.value }))}
                              placeholder={language === 'en' 
                                ? 'Why do you want to become an ambassador? (optional)'
                                : 'Pourquoi voulez-vous devenir ambassadeur ? (optionnel)'}
                              rows={4}
                              className="transition-all duration-300 focus:scale-105"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {language === 'en' ? 'Optional field' : 'Champ optionnel'}
                            </p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-900 dark:text-blue-100">
                              {language === 'en' 
                                ? '📧 An approval email with login credentials will be automatically sent to the ambassador after creation.'
                                : '📧 Un email d\'approbation avec les identifiants de connexion sera automatiquement envoyé à l\'ambassadeur après la création.'}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end gap-2 mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-800">
                        <DialogClose asChild>
                          <Button 
                            variant="outline"
                            className="transform hover:scale-105 transition-all duration-300"
                            onClick={() => {
                              setNewAmbassadorForm({
                                full_name: '',
                                age: '',
                                phone_number: '',
                                email: '',
                                city: '',
                                ville: '',
                                social_link: '',
                                motivation: ''
                              });
                              setAmbassadorErrors({});
                            }}
                          >
                            {t.cancel}
                          </Button>
                        </DialogClose>
                        <Button 
                          onClick={async () => {
                            if (editingAmbassador?.id) {
                            await handleSaveAmbassador(editingAmbassador);
                            } else {
                              await handleSaveAmbassador({} as Ambassador);
                            }
                            if (!editingAmbassador?.id) {
                            setIsAmbassadorDialogOpen(false);
                            }
                          }}
                          disabled={processingId === 'new-ambassador'}
                          className="transform hover:scale-105 transition-all duration-300"
                        >
                          {processingId === 'new-ambassador' ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              {language === 'en' ? 'Creating...' : 'Création...'}
                            </>
                          ) : (
                            <>
                          <Save className="w-4 h-4 mr-2 animate-pulse" />
                          {t.save}
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ambassadors.filter(amb => amb.status === 'approved' || amb.status === 'suspended').map((ambassador, index) => (
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
                          <div className="flex items-center gap-2">
                            {ambassador.status === 'suspended' && (
                              <Badge 
                                variant="destructive"
                                className="text-xs"
                              >
                                <Pause className="w-3 h-3 mr-1" />
                                {language === 'en' ? 'Paused' : 'En Pause'}
                              </Badge>
                            )}
                            {ambassador.commission_rate >= 15 && (
                              <Badge 
                                className="animate-pulse"
                                style={{
                                  background: 'rgba(226, 24, 54, 0.15)',
                                  color: '#E21836'
                                }}
                              >
                                Top Performer
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/30">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {language === 'en' ? 'Status:' : 'Statut:'}
                            </span>
                            <span className={`text-xs font-medium ${ambassador.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
                              {ambassador.status === 'approved' 
                                ? (language === 'en' ? 'Active' : 'Actif')
                                : (language === 'en' ? 'Paused' : 'En Pause')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {language === 'en' ? 'Active' : 'Actif'}
                            </span>
                            <Switch
                              checked={ambassador.status === 'approved'}
                              onCheckedChange={() => handleToggleAmbassadorStatus(ambassador)}
                              disabled={processingId === ambassador.id}
                              className="data-[state=checked]:bg-[#E21836]"
                            />
                          </div>
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
                            onClick={async () => {
                              // Fetch age and social_link from corresponding application
                              let ambassadorAge: number | undefined;
                              let ambassadorSocialLink: string | undefined;
                              const { data: appData } = await supabase
                                .from('ambassador_applications')
                                .select('age, social_link')
                                .eq('phone_number', ambassador.phone)
                                .eq('status', 'approved')
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();
                              
                              if (appData) {
                                ambassadorAge = appData.age;
                                ambassadorSocialLink = appData.social_link || undefined;
                              }
                              
                              setEditingAmbassador({ ...ambassador, age: ambassadorAge, social_link: ambassadorSocialLink || ambassador.social_link });
                              setAmbassadorErrors({});
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
                  <div className="flex items-center gap-3 animate-in slide-in-from-right-4 duration-1000 delay-300">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportAmbassadorsToExcel}
                      className="transform hover:scale-105 transition-all duration-300"
                      style={{
                        background: '#1F1F1F',
                        borderColor: '#2A2A2A',
                        color: '#FFFFFF'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#E21836';
                        e.currentTarget.style.borderColor = '#E21836';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#1F1F1F';
                        e.currentTarget.style.borderColor = '#2A2A2A';
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {language === 'en' ? 'Export to Excel' : 'Exporter vers Excel'}
                    </Button>
                    <Badge 
                      className="animate-pulse"
                      style={{
                        background: 'rgba(0, 207, 255, 0.15)',
                        color: '#00CFFF'
                      }}
                    >
                      {filteredApplications.length} Applications
                    </Badge>
                    {/* "Create Missing Application" button removed - applications are now created automatically when ambassadors are added */}
                    {applications.filter(app => app.status === 'approved' && !ambassadors.some(amb => 
                      amb.phone === app.phone_number || (app.email && amb.email && amb.email === app.email)
                    )).length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCleanupOrphanedApplications}
                        className="text-xs"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {language === 'en' 
                          ? `Cleanup ${applications.filter(app => app.status === 'approved' && !ambassadors.some(amb => 
                              amb.phone === app.phone_number || (app.email && amb.email && amb.email === app.email)
                            )).length} Orphaned`
                          : `Nettoyer ${applications.filter(app => app.status === 'approved' && !ambassadors.some(amb => 
                              amb.phone === app.phone_number || (app.email && amb.email && amb.email === app.email)
                            )).length} Orphelines`}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Search Bar and Date Filters */}
                <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500">
                  <div className="relative">
                    <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search by name, email, or phone..."
                      value={applicationSearchTerm}
                      onChange={(e) => setApplicationSearchTerm(e.target.value)}
                      className="pl-10 transition-all duration-300 focus:scale-105"
                    />
                  </div>
                  
                  {/* Status, City and Ville Filters */}
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-muted-foreground">{language === 'en' ? 'Status:' : 'Statut:'}</Label>
                      <Select
                        value={applicationStatusFilter}
                        onValueChange={setApplicationStatusFilter}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder={language === 'en' ? 'All Statuses' : 'Tous les Statuts'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'en' ? 'All Statuses' : 'Tous les Statuts'}</SelectItem>
                          <SelectItem value="pending">{language === 'en' ? 'Pending' : 'En Attente'}</SelectItem>
                          <SelectItem value="approved">{language === 'en' ? 'Approved' : 'Approuvé'}</SelectItem>
                          <SelectItem value="rejected">{language === 'en' ? 'Rejected' : 'Rejeté'}</SelectItem>
                          <SelectItem value="suspended">{language === 'en' ? 'Suspended' : 'Suspendu'}</SelectItem>
                          <SelectItem value="removed">{language === 'en' ? 'Removed' : 'Retiré'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-muted-foreground">{language === 'en' ? 'City:' : 'Ville:'}</Label>
                      <Select
                        value={applicationCityFilter}
                        onValueChange={(value) => {
                          setApplicationCityFilter(value);
                          // Reset ville filter when city changes
                          if (value !== 'all') {
                            setApplicationVilleFilter('all');
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder={language === 'en' ? 'All Cities' : 'Toutes les Villes'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'en' ? 'All Cities' : 'Toutes les Villes'}</SelectItem>
                          {CITIES.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {(applicationCityFilter === 'Sousse' || applicationCityFilter === 'Tunis' || applicationCityFilter === 'all') && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium text-muted-foreground">{language === 'en' ? 'Ville (Neighborhood):' : 'Quartier:'}</Label>
                        <div className="relative">
                          <Select
                            value={applicationVilleFilter}
                            onValueChange={setApplicationVilleFilter}
                            disabled={applicationCityFilter !== 'Sousse' && applicationCityFilter !== 'Tunis' && applicationCityFilter !== 'all'}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder={language === 'en' ? 'All Villes' : 'Tous les Quartiers'} />
                            </SelectTrigger>
                            <SelectContent 
                            position="popper"
                            side="bottom"
                            sideOffset={4}
                            avoidCollisions={false}
                            className="[&[data-side=top]]:!hidden"
                          >
                            <SelectItem value="all">{language === 'en' ? 'All Villes' : 'Tous les Quartiers'}</SelectItem>
                            {applicationCityFilter === 'Sousse' && SOUSSE_VILLES.map((ville) => (
                              <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                            ))}
                            {applicationCityFilter === 'Tunis' && TUNIS_VILLES.map((ville) => (
                              <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                            ))}
                            {applicationCityFilter === 'all' && (
                              <>
                                {SOUSSE_VILLES.map((ville) => (
                                  <SelectItem key={`sousse-${ville}`} value={ville}>{ville} (Sousse)</SelectItem>
                                ))}
                                {TUNIS_VILLES.map((ville) => (
                                  <SelectItem key={`tunis-${ville}`} value={ville}>{ville} (Tunis)</SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        </div>
                      </div>
                    )}
                    
                    {(applicationStatusFilter !== 'pending' || applicationCityFilter !== 'all' || applicationVilleFilter !== 'all') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setApplicationStatusFilter('pending');
                          setApplicationCityFilter('all');
                          setApplicationVilleFilter('all');
                        }}
                        className="text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        {language === 'en' ? 'Clear Filters' : 'Effacer les Filtres'}
                      </Button>
                    )}
                  </div>
                  
                  {/* Date Range Filters */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-foreground/70 whitespace-nowrap">{language === 'en' ? 'From Date:' : 'Date de début:'}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[200px] justify-start text-left font-normal border-border/50 bg-background hover:bg-muted/30 hover:border-primary/30 transition-all duration-300 shadow-sm",
                              !applicationDateFrom && "text-muted-foreground",
                              applicationDateFrom && "border-primary/50 bg-primary/5"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {applicationDateFrom ? (
                                format(applicationDateFrom, "PPP")
                              ) : (
                                <span className="text-muted-foreground">{language === 'en' ? 'Pick a date' : 'Choisir une date'}</span>
                              )}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={applicationDateFrom}
                            onSelect={(date) => setApplicationDateFrom(date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-foreground/70 whitespace-nowrap">{language === 'en' ? 'To Date:' : 'Date de fin:'}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[200px] justify-start text-left font-normal border-border/50 bg-background hover:bg-muted/30 hover:border-primary/30 transition-all duration-300 shadow-sm",
                              !applicationDateTo && "text-muted-foreground",
                              applicationDateTo && "border-primary/50 bg-primary/5",
                              !applicationDateFrom && "opacity-50 cursor-not-allowed"
                            )}
                            disabled={!applicationDateFrom}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {applicationDateTo ? (
                                format(applicationDateTo, "PPP")
                              ) : (
                                <span className="text-muted-foreground">{language === 'en' ? 'Pick a date' : 'Choisir une date'}</span>
                              )}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={applicationDateTo}
                            onSelect={(date) => setApplicationDateTo(date)}
                            disabled={(date) => applicationDateFrom ? date < applicationDateFrom : false}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    {(applicationDateFrom || applicationDateTo) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setApplicationDateFrom(undefined);
                          setApplicationDateTo(undefined);
                        }}
                        className="text-xs border-border/50 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-300 shadow-sm"
                      >
                        <X className="w-3 h-3 mr-1.5" />
                        {language === 'en' ? 'Clear Dates' : 'Effacer les Dates'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-border overflow-hidden">
                  <div className="overflow-x-hidden">
                    <Table className="[&>div]:overflow-x-hidden">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">Name</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">Age</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">Phone</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">Email</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">City</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">{language === 'en' ? 'Ville' : 'Quartier'}</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">Status</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">Applied</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto">Details</TableHead>
                          <TableHead className="font-semibold text-xs px-2 py-2 h-auto text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {filteredApplications.map((application, index) => (
                        <TableRow 
                          key={application.id}
                          className={`transform transition-all duration-300 hover:bg-muted/30 ${
                            animatedApplications.has(application.id) 
                              ? 'animate-in fade-in duration-300' 
                              : ''
                          }`}
                        >
                          <TableCell className="font-medium text-xs px-2 py-2">{application.full_name}</TableCell>
                          <TableCell className="text-xs px-2 py-2">{application.age}</TableCell>
                          <TableCell className="text-xs px-2 py-2">
                            <div className="flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span>{application.phone_number}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs px-2 py-2">
                            {application.email ? (
                              <div className="flex items-center space-x-1 group cursor-pointer" 
                                   onClick={() => {
                                     navigator.clipboard.writeText(application.email);
                                     toast({
                                       title: "Email Copied!",
                                       description: `${application.email} copied to clipboard`,
                                     });
                                   }}
                                   title="Click to copy email">
                                <Mail className="w-3 h-3 text-primary group-hover:text-primary/80 transition-colors" />
                                <span className="text-xs break-all max-w-[100px] truncate text-primary group-hover:text-primary/80 transition-colors">
                                  {application.email}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs px-2 py-2">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span>{application.city}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs px-2 py-2">
                            {(() => {
                              // Show ville if available
                              if (application.ville) {
                                return <span className="text-xs">{application.ville}</span>;
                              }
                              // If no ville but city is Sousse or Tunis, try to get it from corresponding ambassador
                              if (application.city === 'Sousse' || application.city === 'Tunis') {
                                // Try to find matching ambassador
                                const matchingAmbassador = ambassadors.find(amb => 
                                  amb.phone === application.phone_number || 
                                  (application.email && amb.email === application.email)
                                );
                                if (matchingAmbassador?.ville) {
                                  return <span className="text-xs text-muted-foreground italic">{matchingAmbassador.ville}*</span>;
                                }
                              }
                              return <span className="text-muted-foreground text-xs">-</span>;
                            })()}
                          </TableCell>
                          <TableCell className="text-xs px-2 py-2">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(application.status)}
                              {application.status === 'approved' && (
                                <div className="flex items-center" title={
                                  emailStatus[application.id] === 'sent' 
                                    ? (language === 'en' ? 'Email sent successfully' : 'Email envoyé avec succès')
                                    : emailStatus[application.id] === 'failed'
                                    ? (language === 'en' ? 'Email failed to send' : 'Échec de l\'envoi de l\'email')
                                    : emailStatus[application.id] === 'pending'
                                    ? (language === 'en' ? 'Email sending...' : 'Envoi de l\'email...')
                                    : (language === 'en' ? 'Email status unknown' : 'Statut de l\'email inconnu')
                                }>
                                  {emailStatus[application.id] === 'sent' ? (
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                  ) : emailStatus[application.id] === 'failed' ? (
                                    <XCircle className="w-3 h-3 text-red-500" />
                                  ) : emailStatus[application.id] === 'pending' ? (
                                    <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                  ) : emailFailedApplications.has(application.id) ? (
                                    <XCircle className="w-3 h-3 text-red-500" />
                                  ) : (
                                    <Mail className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs px-2 py-2">
                            <div className="flex items-center space-x-1">
                              <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{new Date(application.created_at).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs px-2 py-2">
                            <div className="flex items-center gap-2">
                              {application.motivation && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMotivation({ application, motivation: application.motivation });
                                    setIsMotivationDialogOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent hover:opacity-80 transition-opacity cursor-pointer"
                                  title={language === 'en' ? 'Click to view motivation' : 'Cliquer pour voir la motivation'}
                                >
                                  <FileText className="w-3 h-3 text-primary" />
                                </button>
                              )}
                              {application.social_link && (
                                <div className="flex items-center">
                                  <SocialLink url={application.social_link} iconOnly={true} />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs px-2 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {application.status === 'pending' && (
                                <>
                                  <Button 
                                    onClick={() => handleApprove(application)}
                                    disabled={processingId === application.id}
                                    size="sm"
                                    style={{
                                      background: '#22C55E',
                                      color: '#FFFFFF',
                                      fontSize: '0.7rem',
                                      padding: '0.25rem 0.5rem',
                                      height: 'auto'
                                    }}
                                    className="transform hover:scale-105 transition-all duration-300"
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#16A34A'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#22C55E'}
                                  >
                                    {processingId === application.id ? (
                                      <>
                                        <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                                        <span className="text-xs">{t.processing}</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-2.5 h-2.5 mr-1" />
                                        <span className="text-xs">{t.approve}</span>
                                      </>
                                    )}
                                  </Button>
                                  <Button 
                                    onClick={() => handleReject(application)}
                                    disabled={processingId === application.id}
                                    variant="destructive"
                                    size="sm"
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '0.25rem 0.5rem',
                                      height: 'auto'
                                    }}
                                    className="transform hover:scale-105 transition-all duration-300"
                                  >
                                    {processingId === application.id ? (
                                      <>
                                        <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                                        <span className="text-xs">{t.processing}</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-2.5 h-2.5 mr-1" />
                                        <span className="text-xs">{t.reject}</span>
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                              {application.status === 'approved' && (
                                <div className="flex gap-1">
                                  <Button 
                                    onClick={() => resendEmail(application)}
                                    disabled={processingId === application.id}
                                    size="sm"
                                    style={{
                                      background: '#3B82F6',
                                      color: '#FFFFFF',
                                      fontSize: '0.7rem',
                                      padding: '0.25rem 0.5rem',
                                      height: 'auto'
                                    }}
                                    className="transform hover:scale-105 transition-all duration-300"
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#2563EB'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#3B82F6'}
                                    title={
                                      emailStatus[application.id] === 'failed'
                                        ? (language === 'en' ? 'Email failed - Click to resend' : 'Échec de l\'email - Cliquez pour renvoyer')
                                        : emailStatus[application.id] === 'sent'
                                        ? (language === 'en' ? 'Email sent - Click to resend' : 'Email envoyé - Cliquez pour renvoyer')
                                        : (language === 'en' ? 'Resend approval email' : 'Renvoyer l\'email d\'approbation')
                                    }
                                  >
                                    {processingId === application.id ? (
                                      <>
                                        <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                                        <span className="text-xs">{language === 'en' ? 'Sending...' : 'Envoi...'}</span>
                                      </>
                                    ) : emailStatus[application.id] === 'failed' ? (
                                      <>
                                        <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                        <span className="text-xs">{language === 'en' ? 'Resend' : 'Renvoyer'}</span>
                                      </>
                                    ) : emailStatus[application.id] === 'sent' ? (
                                      <>
                                        <Mail className="w-2.5 h-2.5 mr-1" />
                                        <span className="text-xs">{language === 'en' ? 'Resend' : 'Renvoyer'}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Mail className="w-2.5 h-2.5 mr-1" />
                                        <span className="text-xs">{language === 'en' ? 'Resend' : 'Renvoyer'}</span>
                                      </>
                                    )}
                                  </Button>
                                  <Button 
                                    onClick={() => copyCredentials(application)}
                                    size="sm"
                                    variant="outline"
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '0.25rem 0.4rem',
                                      height: 'auto',
                                      minWidth: 'auto'
                                    }}
                                    className="transform hover:scale-105 transition-all duration-300 p-1"
                                    title={language === 'en' ? 'Copy credentials to clipboard' : 'Copier les identifiants dans le presse-papiers'}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredApplications.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
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
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Motivation Dialog */}
                <Dialog open={isMotivationDialogOpen} onOpenChange={setIsMotivationDialogOpen}>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {language === 'en' ? 'Application Motivation' : 'Motivation de la Candidature'}
                      </DialogTitle>
                    </DialogHeader>
                    {selectedMotivation && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            {language === 'en' ? 'Applicant:' : 'Candidat:'}
                          </p>
                          <p className="text-lg font-semibold">{selectedMotivation.application.full_name}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            {language === 'en' ? 'Motivation:' : 'Motivation:'}
                          </p>
                          <div className="p-4 bg-muted/50 rounded-lg border border-border max-h-[60vh] overflow-y-auto">
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                              {selectedMotivation.motivation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                      <DialogClose asChild>
                        <Button variant="outline">
                          {language === 'en' ? 'Close' : 'Fermer'}
                        </Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
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
                          price: (event.passes && event.passes.length > 0 && event.passes[0]?.price) ? event.passes[0].price : 50 + (index * 10),
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
                        {selectedEvent.passes && selectedEvent.passes.length > 0 && (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-muted-foreground">Passes</Label>
                            <div className="space-y-2">
                              {selectedEvent.passes.map((pass, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <span className="text-sm font-medium">{pass.name}</span>
                                  <span className="text-lg font-semibold text-primary">{pass.price} TND</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
                          <CalendarIcon className="w-6 h-6 text-primary" />
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
                            <div key={i} className="flex-1 bg-primary rounded-t" style={{ height: `${h}%` }} />
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
                      <CalendarIcon className="w-5 h-5 text-primary" />
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
                              if (ticketFilterStatus === 'past') return event.event_type === 'gallery';
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
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          // Ensure passes are loaded for this event
                                          let eventWithPasses = event;
                                          if (!event.passes || event.passes.length === 0) {
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
                                            
                                            const mappedPasses = (passesData || []).map((p: any) => ({
                                              id: p.id,
                                              name: p.name || '',
                                              price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
                                              description: p.description || '',
                                              is_primary: p.is_primary || false
                                            }));
                                            
                                            eventWithPasses = { ...event, passes: mappedPasses };
                                          }
                                          setPassValidationErrors({});
                                          setEditingEvent(eventWithPasses);
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
                                <p className="text-2xl font-heading font-bold text-primary">68%</p>
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
                                  { source: 'Direct', percentage: 12, color: 'bg-primary' },
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

              {/* Online Orders Tab */}
              <TabsContent value="online-orders" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{language === 'en' ? 'Online Orders' : 'Commandes en Ligne'}</CardTitle>
                      <Button onClick={fetchOnlineOrders} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'Refresh' : 'Actualiser'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                      <Select
                        value={onlineOrderFilters.status}
                        onValueChange={(value) => {
                          const newFilters = { ...onlineOrderFilters, status: value };
                          setOnlineOrderFilters(newFilters);
                          fetchOnlineOrdersWithFilters(newFilters);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'en' ? 'Payment Status' : 'Statut de Paiement'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'en' ? 'All Statuses' : 'Tous les Statuts'}</SelectItem>
                          <SelectItem value="PENDING_PAYMENT">{language === 'en' ? 'Pending Payment' : 'Paiement en Attente'}</SelectItem>
                          <SelectItem value="PAID">{language === 'en' ? 'Paid' : 'Payé'}</SelectItem>
                          <SelectItem value="FAILED">{language === 'en' ? 'Failed' : 'Échoué'}</SelectItem>
                          <SelectItem value="REFUNDED">{language === 'en' ? 'Refunded' : 'Remboursé'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={onlineOrderFilters.city}
                        onValueChange={(value) => {
                          const newFilters = { ...onlineOrderFilters, city: value };
                          setOnlineOrderFilters(newFilters);
                          // Fetch immediately with new filter
                          fetchOnlineOrdersWithFilters(newFilters);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'en' ? 'City' : 'Ville'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'en' ? 'All Cities' : 'Toutes les Villes'}</SelectItem>
                          {CITIES.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={onlineOrderFilters.passType}
                        onValueChange={(value) => {
                          const newFilters = { ...onlineOrderFilters, passType: value };
                          setOnlineOrderFilters(newFilters);
                          fetchOnlineOrdersWithFilters(newFilters);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'en' ? 'Pass Type' : 'Type de Pass'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'en' ? 'All Types' : 'Tous les Types'}</SelectItem>
                          <SelectItem value="standard">{language === 'en' ? 'Standard' : 'Standard'}</SelectItem>
                          <SelectItem value="vip">{language === 'en' ? 'VIP' : 'VIP'}</SelectItem>
                          <SelectItem value="mixed">{language === 'en' ? 'Mixed' : 'Mixte'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={language === 'en' ? 'Order ID (e.g., 98C1E3AC)' : 'ID Commande (ex: 98C1E3AC)'}
                        value={onlineOrderFilters.orderId}
                        onChange={(e) => {
                          const newFilters = { ...onlineOrderFilters, orderId: e.target.value };
                          setOnlineOrderFilters(newFilters);
                        }}
                        onKeyDown={(e) => {
                          // Search immediately on Enter key
                          if (e.key === 'Enter') {
                            fetchOnlineOrdersWithFilters(onlineOrderFilters);
                          }
                        }}
                        onBlur={() => {
                          // Search when user leaves the input field
                          fetchOnlineOrdersWithFilters(onlineOrderFilters);
                        }}
                        className="font-mono"
                      />
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full">
                              <CalendarIcon className="w-4 h-4 mr-2" />
                              {language === 'en' ? 'Date Range' : 'Plage de Dates'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <div className="p-4 space-y-4">
                              <div>
                                <Label>{language === 'en' ? 'From' : 'De'}</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                      {onlineOrderFilters.dateFrom ? format(onlineOrderFilters.dateFrom, "PPP") : <span>{language === 'en' ? 'Pick a date' : 'Choisir une date'}</span>}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar
                                      mode="single"
                                      selected={onlineOrderFilters.dateFrom || undefined}
                                      onSelect={(date) => {
                                        const newFilters = { ...onlineOrderFilters, dateFrom: date || null };
                                        setOnlineOrderFilters(newFilters);
                                        fetchOnlineOrdersWithFilters(newFilters);
                                      }}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div>
                                <Label>{language === 'en' ? 'To' : 'À'}</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                      {onlineOrderFilters.dateTo ? format(onlineOrderFilters.dateTo, "PPP") : <span>{language === 'en' ? 'Pick a date' : 'Choisir une date'}</span>}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar
                                      mode="single"
                                      selected={onlineOrderFilters.dateTo || undefined}
                                      onSelect={(date) => {
                                        const newFilters = { ...onlineOrderFilters, dateTo: date || null };
                                        setOnlineOrderFilters(newFilters);
                                        fetchOnlineOrdersWithFilters(newFilters);
                                      }}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newFilters = { ...onlineOrderFilters, dateFrom: null, dateTo: null };
                                  setOnlineOrderFilters(newFilters);
                                  fetchOnlineOrdersWithFilters(newFilters);
                                }}
                                className="w-full"
                              >
                                {language === 'en' ? 'Clear Dates' : 'Effacer les Dates'}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Orders Table */}
                    {loadingOnlineOrders ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-muted-foreground">{language === 'en' ? 'Loading orders...' : 'Chargement des commandes...'}</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === 'en' ? 'Customer Name' : 'Nom du Client'}</TableHead>
                            <TableHead>{language === 'en' ? 'Phone' : 'Téléphone'}</TableHead>
                            <TableHead>{language === 'en' ? 'Email' : 'Email'}</TableHead>
                            <TableHead>{language === 'en' ? 'Passes' : 'Passes'}</TableHead>
                            <TableHead>{language === 'en' ? 'Total Price' : 'Prix Total'}</TableHead>
                            <TableHead>{language === 'en' ? 'City' : 'Ville'}</TableHead>
                            <TableHead>{language === 'en' ? 'Ville' : 'Quartier'}</TableHead>
                            <TableHead>{language === 'en' ? 'Payment Status' : 'Statut Paiement'}</TableHead>
                            <TableHead>{language === 'en' ? 'Created' : 'Créé'}</TableHead>
                            <TableHead>{language === 'en' ? 'Actions' : 'Actions'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {onlineOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                {language === 'en' ? 'No online orders found' : 'Aucune commande en ligne trouvée'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            onlineOrders.map((order) => {
                              // Parse passes from notes if available
                              let passesDisplay = `${order.quantity}x ${order.pass_type?.toUpperCase() || 'STANDARD'}`;
                              if (order.pass_type === 'mixed' && order.notes) {
                                try {
                                  const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
                                  if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                                    passesDisplay = notesData.all_passes
                                      .map((p: any) => `${p.quantity}x ${p.passType?.toUpperCase() || 'STANDARD'}`)
                                      .join(', ');
                                  }
                                } catch (e) {
                                  // Fall through to default
                                }
                              }

                              // Truncate email for display (aggressive truncation to save space)
                              const email = order.user_email || order.email || 'N/A';
                              const truncateEmail = (email: string) => {
                                if (email === 'N/A' || !email.includes('@')) return email;
                                const [local, domain] = email.split('@');
                                if (!domain) return email.length > 12 ? email.substring(0, 9) + '...' : email;
                                // Very aggressive: first 6 chars of local + ...@ + first 8 chars of domain
                                const truncatedLocal = local.length > 6 ? local.substring(0, 6) + '..' : local;
                                const truncatedDomain = domain.length > 8 ? domain.substring(0, 8) + '..' : domain;
                                return `${truncatedLocal}@${truncatedDomain}`;
                              };

                              const handleCopyEmail = async (email: string) => {
                                if (email === 'N/A') return;
                                try {
                                  await navigator.clipboard.writeText(email);
                                  toast({
                                    title: language === 'en' ? 'Copied!' : 'Copié!',
                                    description: language === 'en' ? 'Email copied to clipboard' : 'Email copié dans le presse-papiers',
                                    variant: "default",
                                  });
                                } catch (err) {
                                  console.error('Failed to copy email:', err);
                                }
                              };

                              return (
                                <TableRow key={order.id}>
                                  <TableCell>{order.user_name || order.customer_name || 'N/A'}</TableCell>
                                  <TableCell>{order.user_phone || order.phone || 'N/A'}</TableCell>
                                  <TableCell>
                                    <div 
                                      className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors group"
                                      onClick={() => handleCopyEmail(email)}
                                      title={email !== 'N/A' ? (language === 'en' ? 'Click to copy email' : 'Cliquer pour copier l\'email') : ''}
                                    >
                                      <span className="text-sm">{truncateEmail(email)}</span>
                                      {email !== 'N/A' && (
                                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">{passesDisplay}</TableCell>
                                  <TableCell>{order.total_price?.toFixed(2) || '0.00'} TND</TableCell>
                                  <TableCell>{order.city || 'N/A'}</TableCell>
                                  <TableCell>{order.ville || '-'}</TableCell>
                                  <TableCell>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            className={cn(
                                              "w-3 h-3 rounded-full cursor-help transition-opacity hover:opacity-80",
                                              order.payment_status === 'PAID' ? 'bg-green-500' :
                                              order.payment_status === 'FAILED' || order.payment_status === 'REFUNDED' ? 'bg-red-500' :
                                              'bg-yellow-500'
                                            )}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>
                                            {(() => {
                                              const status = order.payment_status || 'PENDING_PAYMENT';
                                              const statusMap: Record<string, string> = {
                                                'PENDING_PAYMENT': language === 'en' ? 'Pending Payment' : 'Paiement en Attente',
                                                'PAID': language === 'en' ? 'Paid' : 'Payé',
                                                'FAILED': language === 'en' ? 'Failed' : 'Échoué',
                                                'REFUNDED': language === 'en' ? 'Refunded' : 'Remboursé'
                                              };
                                              return statusMap[status] || status;
                                            })()}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </TableCell>
                                  <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedOnlineOrder(order);
                                        setIsOnlineOrderDetailsOpen(true);
                                      }}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      {language === 'en' ? 'View' : 'Voir'}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Ambassador Sales System Tab */}
              <TabsContent value="ambassador-sales" className="space-y-6">
                <Tabs value={salesSystemTab} onValueChange={setSalesSystemTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="cod-ambassador-orders">{language === 'en' ? 'COD Ambassador Orders' : 'Commandes COD Ambassadeur'}</TabsTrigger>
                    <TabsTrigger value="order-logs">{language === 'en' ? 'Order Logs' : 'Journaux'}</TabsTrigger>
                    <TabsTrigger value="performance">{language === 'en' ? 'Performance' : 'Performance'}</TabsTrigger>
                  </TabsList>


                  {/* COD Ambassador Orders */}
                  <TabsContent value="cod-ambassador-orders" className="mt-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>{language === 'en' ? 'COD Ambassador Orders' : 'Commandes COD Ambassadeur'}</CardTitle>
                          <div className="flex gap-2">
                            <Button onClick={exportOrdersToExcel} variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-2" />
                              {language === 'en' ? 'Export Excel' : 'Exporter Excel'}
                            </Button>
                            <Button onClick={fetchAmbassadorSalesData} variant="outline" size="sm">
                              <RefreshCw className="w-4 h-4 mr-2" />
                              {language === 'en' ? 'Refresh' : 'Actualiser'}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Filters */}
                        <div className="flex items-end gap-4 mb-4 pb-4 border-b">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                          <div>
                            <Label className="text-xs mb-2">{language === 'en' ? 'Status' : 'Statut'}</Label>
                            <Select
                              value={orderFilters.status || undefined}
                              onValueChange={(value) => {
                                setOrderFilters({ ...orderFilters, status: value });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={language === 'en' ? 'All Statuses' : 'Tous les Statuts'} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING_CASH">{language === 'en' ? 'Pending Cash' : 'En Attente Espèces'}</SelectItem>
                                <SelectItem value="PENDING_ADMIN_APPROVAL">{language === 'en' ? 'Pending Approval' : 'En Attente d\'Approbation'}</SelectItem>
                                <SelectItem value="PAID">{language === 'en' ? 'Paid' : 'Payé'}</SelectItem>
                                <SelectItem value="REJECTED">{language === 'en' ? 'Rejected' : 'Rejeté'}</SelectItem>
                                <SelectItem value="CANCELLED">{language === 'en' ? 'Cancelled' : 'Annulé'}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs mb-2">{language === 'en' ? 'Phone' : 'Téléphone'}</Label>
                            <Input
                              placeholder={language === 'en' ? 'Search by phone...' : 'Rechercher par téléphone...'}
                              value={orderFilters.phone}
                              onChange={(e) => setOrderFilters({ ...orderFilters, phone: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-2">{language === 'en' ? 'Ambassador' : 'Ambassadeur'}</Label>
                            <Select
                              value={orderFilters.ambassador || undefined}
                              onValueChange={(value) => {
                                setOrderFilters({ ...orderFilters, ambassador: value });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={language === 'en' ? 'All Ambassadors' : 'Tous les Ambassadeurs'} />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]" side="bottom" avoidCollisions={false}>
                                {filterOptions.ambassadors.map((ambassador) => (
                                  <SelectItem key={ambassador} value={ambassador}>
                                    {ambassador}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOrderFilters({
                                status: '',
                                phone: '',
                                ambassador: '',
                                city: '',
                                ville: '',
                              });
                            }}
                            className="h-8 text-xs"
                          >
                            <X className="w-4 h-4 mr-2" />
                            {language === 'en' ? 'Clear All' : 'Tout Effacer'}
                          </Button>
                        </div>
                        {loadingOrders ? (
                          <div className="text-center py-8">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-muted-foreground">{language === 'en' ? 'Loading orders...' : 'Chargement des commandes...'}</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table className="text-xs">
                              <TableHeader>
                              <TableRow>
                                <TableHead className="py-2 whitespace-nowrap text-center">{language === 'en' ? 'Pass Types' : 'Types de Pass'}</TableHead>
                                <TableHead className="py-2 whitespace-nowrap text-center">{language === 'en' ? 'Client Name' : 'Nom Client'}</TableHead>
                                <TableHead className="py-2 whitespace-nowrap text-center">{language === 'en' ? 'Phone' : 'Téléphone'}</TableHead>
                                <TableHead className="py-2 whitespace-nowrap text-center">{language === 'en' ? 'Email' : 'Email'}</TableHead>
                                <TableHead className="py-2 whitespace-nowrap text-center">{language === 'en' ? 'Total Price' : 'Prix Total'}</TableHead>
                                <TableHead className="py-2 whitespace-nowrap text-center">{language === 'en' ? 'Ambassador' : 'Ambassadeur'}</TableHead>
                                <TableHead className="py-2 whitespace-nowrap text-center w-16">{language === 'en' ? 'Status' : 'Statut'}</TableHead>
                                <TableHead className="py-2 whitespace-nowrap text-center">{language === 'en' ? 'Created' : 'Créé'}</TableHead>
                                <TableHead className="py-2 whitespace-nowrap text-center">{language === 'en' ? 'Actions' : 'Actions'}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredCodOrders.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                    {language === 'en' ? 'No COD ambassador orders found' : 'Aucune commande COD ambassadeur trouvée'}
                                  </TableCell>
                                </TableRow>
                              ) : (
                                filteredCodOrders
                                  .filter(order => 
                                    // New unified status system
                                    order.status === 'PENDING_CASH' || 
                                    order.status === 'PAID' || 
                                    order.status === 'CANCELLED' ||
                                    // Legacy status values (for backward compatibility)
                                    order.status === 'PENDING_ADMIN_APPROVAL' || 
                                    order.status === 'APPROVED' || 
                                    order.status === 'REJECTED'
                                  )
                                  .map((order) => {
                                    // Get passes array (already enriched in fetchAmbassadorSalesData)
                                    const passes = order.passes || [];
                                    
                                    // Status color indicator - Normalized colors
                                    const getStatusColor = () => {
                                      if (order.status === 'PAID' || order.status === 'APPROVED') return 'bg-green-500';
                                      if (order.status === 'CANCELLED' || order.status === 'REJECTED') return 'bg-red-500';
                                      if (order.status === 'PENDING_ADMIN_APPROVAL') return 'bg-yellow-500';
                                      if (order.status === 'PENDING_CASH') return 'bg-gray-500'; // Grey for pending cash
                                      return 'bg-gray-500';
                                    };

                                    // Mask email function
                                    const maskEmail = (email: string) => {
                                      if (!email || !email.includes('@')) return email;
                                      const [localPart, domain] = email.split('@');
                                      if (localPart.length <= 3) {
                                        return `${localPart}***@${domain}`;
                                      }
                                      const visibleStart = localPart.substring(0, 3);
                                      const visibleEnd = domain.substring(domain.length - 4);
                                      return `${visibleStart}***@${visibleEnd}`;
                                    };

                                    // Copy email to clipboard
                                    const handleCopyEmail = async (email: string) => {
                                      try {
                                        await navigator.clipboard.writeText(email);
                                        toast({
                                          title: language === 'en' ? 'Copied!' : 'Copié!',
                                          description: language === 'en' ? 'Email copied to clipboard' : 'Email copié dans le presse-papiers',
                                          duration: 2000,
                                        });
                                      } catch (err) {
                                        console.error('Failed to copy email:', err);
                                        toast({
                                          title: language === 'en' ? 'Error' : 'Erreur',
                                          description: language === 'en' ? 'Failed to copy email' : 'Échec de la copie de l\'email',
                                          variant: 'destructive',
                                        });
                                      }
                                    };
                                    
                                    return (
                                      <TableRow key={order.id} className="text-xs">
                                        <TableCell className="py-2 text-center">
                                          {passes.length > 0 ? (
                                            <div className="flex flex-col items-center gap-1">
                                              {passes.map((p: any, idx: number) => (
                                                <div key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/30 text-xs">
                                                  <span className="font-medium">{p.pass_type || p.passName}</span>
                                                  <span className="text-muted-foreground">×{p.quantity}</span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-xs">{order.pass_type || 'N/A'}</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="py-2 text-center">{order.user_name || 'N/A'}</TableCell>
                                        <TableCell className="py-2 text-center">{order.user_phone || 'N/A'}</TableCell>
                                        <TableCell className="py-2 text-center text-xs">
                                          {order.user_email ? (
                                            <button
                                              onClick={() => handleCopyEmail(order.user_email)}
                                              className="hover:text-primary hover:underline cursor-pointer"
                                              title={language === 'en' ? 'Click to copy email' : 'Cliquer pour copier l\'email'}
                                            >
                                              {maskEmail(order.user_email)}
                                            </button>
                                          ) : (
                                            'N/A'
                                          )}
                                        </TableCell>
                                        <TableCell className="py-2 text-center text-xs font-semibold">
                                          {order.total_price ? `${parseFloat(order.total_price).toFixed(2)} TND` : 'N/A'}
                                        </TableCell>
                                        <TableCell className="py-2 text-center whitespace-nowrap">
                                          {order.ambassador_id ? (
                                            <button
                                              onClick={async () => {
                                                const { data: ambassadorData } = await (supabase as any)
                                                  .from('ambassadors')
                                                  .select('*')
                                                  .eq('id', order.ambassador_id)
                                                  .single();
                                                setSelectedOrderAmbassador(ambassadorData);
                                                setIsAmbassadorInfoDialogOpen(true);
                                              }}
                                              className="text-primary hover:underline cursor-pointer text-xs"
                                            >
                                              {order.ambassador_name || 'Unknown'}
                                            </button>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">N/A</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="py-2 text-center">
                                          <div className="flex justify-center">
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <div className={`w-3 h-3 rounded-full cursor-help ${getStatusColor()}`} />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p className="text-xs">
                                                    {order.status === 'PENDING_CASH'
                                                      ? (language === 'en' ? 'Pending Cash' : 'En Attente Espèces')
                                                      : order.status === 'PAID'
                                                      ? (language === 'en' ? 'Paid' : 'Payé')
                                                      : order.status === 'CANCELLED'
                                                      ? (language === 'en' ? 'Cancelled' : 'Annulé')
                                                      : order.status === 'PENDING_ADMIN_APPROVAL' 
                                                      ? (language === 'en' ? 'Pending Approval' : 'En Attente')
                                                      : order.status === 'APPROVED'
                                                      ? (language === 'en' ? 'Approved' : 'Approuvé')
                                                      : order.status === 'REJECTED'
                                                      ? (language === 'en' ? 'Rejected' : 'Rejeté')
                                                      : order.status
                                                    }
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-2 text-center whitespace-nowrap text-xs">
                                          {new Date(order.created_at).toLocaleDateString(language)}
                                        </TableCell>
                                        <TableCell className="py-2 text-center">
                                          {/* View Details Button - All actions available in the details dialog */}
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="bg-black hover:bg-gray-800 text-white border-none text-xs px-2 py-1 h-auto"
                                            onClick={() => {
                                              setSelectedOrder(order);
                                              setIsOrderDetailsOpen(true);
                                            }}
                                            title={language === 'en' ? 'View order details and manage actions' : 'Voir les détails de la commande et gérer les actions'}
                                          >
                                            <Eye className="w-3 h-3 mr-1 text-white" />
                                            {language === 'en' ? 'View' : 'Voir'}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                              )}
                            </TableBody>
                          </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Order Logs */}
                  <TabsContent value="order-logs" className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>{language === 'en' ? 'Order Logs' : 'Journaux de Commandes'}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === 'en' ? 'Order ID' : 'ID Commande'}</TableHead>
                              <TableHead>{language === 'en' ? 'Action' : 'Action'}</TableHead>
                              <TableHead>{language === 'en' ? 'Performed By' : 'Effectué Par'}</TableHead>
                              <TableHead>{language === 'en' ? 'Type' : 'Type'}</TableHead>
                              <TableHead>{language === 'en' ? 'Details' : 'Détails'}</TableHead>
                              <TableHead>{language === 'en' ? 'Timestamp' : 'Horodatage'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {orderLogs.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                  {language === 'en' ? 'No order logs found' : 'Aucun journal de commande trouvé'}
                                </TableCell>
                              </TableRow>
                            ) : (
                              orderLogs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="font-mono text-xs">{log.order_id?.substring(0, 8)}...</TableCell>
                                  <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                                  <TableCell>{log.performed_by || 'System'}</TableCell>
                                  <TableCell>{log.performed_by_type || 'system'}</TableCell>
                                  <TableCell className="max-w-xs truncate">{JSON.stringify(log.details || {})}</TableCell>
                                  <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Performance Reports */}
                  <TabsContent value="performance" className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>{language === 'en' ? 'Performance Reports' : 'Rapports de Performance'}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {performanceReports ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">{language === 'en' ? 'Total Orders' : 'Total Commandes'}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-2xl font-bold">{performanceReports.totalOrders || 0}</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">{language === 'en' ? 'Success Rate' : 'Taux de Réussite'}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-2xl font-bold">{performanceReports.successRate || 0}%</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">{language === 'en' ? 'Avg Response Time' : 'Temps de Réponse Moyen'}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-2xl font-bold">{performanceReports.avgResponseTime || 0} min</p>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            {language === 'en' ? 'Performance data will be displayed here' : 'Les données de performance seront affichées ici'}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
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

                  {/* Test SMS Card with Tabs */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <PhoneCall className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Test SMS' : 'SMS Test'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? 'Test SMS functionality for different modes'
                            : 'Tester la fonctionnalité SMS pour différents modes'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Test Mode Tabs */}
                        <Tabs value={testMode} onValueChange={(value) => setTestMode(value as 'specific' | 'broadcast' | 'targeted')}>
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="specific" className="text-xs">
                              {language === 'en' ? 'Specific' : 'Spécifique'}
                            </TabsTrigger>
                            <TabsTrigger value="broadcast" className="text-xs">
                              {language === 'en' ? 'Broadcast' : 'Diffusion'}
                            </TabsTrigger>
                            <TabsTrigger value="targeted" className="text-xs">
                              {language === 'en' ? 'Targeted' : 'Ciblé'}
                            </TabsTrigger>
                          </TabsList>

                          {/* Specific Number Test */}
                          <TabsContent value="specific" className="space-y-4 mt-4">
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
                                placeholder=""
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
                          </TabsContent>

                          {/* Broadcast Mode Test */}
                          <TabsContent value="broadcast" className="space-y-4 mt-4">
                            <div className="p-3 bg-muted/30 rounded-lg border border-border">
                              <div className="text-sm font-semibold text-foreground mb-1">
                                {language === 'en' ? 'Test Number' : 'Numéro Test'}
                              </div>
                              <div className="text-lg font-bold text-primary">
                                27169458
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {language === 'en' 
                                  ? 'This test will send SMS to the test number in phone_subscribers table'
                                  : 'Ce test enverra un SMS au numéro test dans la table phone_subscribers'}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="testMessageBroadcast">{language === 'en' ? 'Test Message' : 'Message Test'} *</Label>
                              <Textarea
                                id="testMessageBroadcast"
                                value={testSmsMessage}
                                onChange={(e) => setTestSmsMessage(e.target.value)}
                                placeholder=""
                                className="min-h-[100px] text-sm bg-background text-foreground font-heading"
                              />
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{language === 'en' ? 'Characters' : 'Caractères'}: {testSmsMessage.length}</span>
                                <span>{language === 'en' ? 'Approx. messages' : 'Messages approx.'}: {Math.ceil(testSmsMessage.length / 160)}</span>
                              </div>
                            </div>
                            <Button
                              onClick={handleSendTestSms}
                              disabled={sendingTestSms || !testSmsMessage.trim()}
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
                                  {language === 'en' ? 'Test Broadcast Mode' : 'Tester Mode Diffusion'}
                                </>
                              )}
                            </Button>
                          </TabsContent>

                          {/* Targeted Mode Test */}
                          <TabsContent value="targeted" className="space-y-4 mt-4">
                            <div className="space-y-2">
                              <Label>{language === 'en' ? 'Select City' : 'Sélectionner une Ville'} *</Label>
                              <Select
                                value={testTargetedCity || undefined}
                                onValueChange={setTestTargetedCity}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder={language === 'en' ? 'Select a city...' : 'Sélectionner une ville...'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {CITIES.map((city) => (
                                    <SelectItem key={city} value={city}>
                                      {city}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {language === 'en' 
                                  ? 'Test will send to first number found in ambassador applications for this city'
                                  : 'Le test enverra au premier numéro trouvé dans les candidatures d\'ambassadeurs pour cette ville'}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="testMessageTargeted">{language === 'en' ? 'Test Message' : 'Message Test'} *</Label>
                              <Textarea
                                id="testMessageTargeted"
                                value={testSmsMessage}
                                onChange={(e) => setTestSmsMessage(e.target.value)}
                                placeholder=""
                                className="min-h-[100px] text-sm bg-background text-foreground font-heading"
                              />
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{language === 'en' ? 'Characters' : 'Caractères'}: {testSmsMessage.length}</span>
                                <span>{language === 'en' ? 'Approx. messages' : 'Messages approx.'}: {Math.ceil(testSmsMessage.length / 160)}</span>
                              </div>
                            </div>
                            <Button
                              onClick={handleSendTestSms}
                              disabled={sendingTestSms || !testSmsMessage.trim() || !testTargetedCity}
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
                                  {language === 'en' ? 'Test Targeted Mode' : 'Tester Mode Ciblé'}
                                </>
                              )}
                            </Button>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Broadcast Mode Card - Popup Subscribers Only */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Send className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Broadcast Mode' : 'Mode Diffusion'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? `Send message to all popup subscribers`
                            : `Envoyer un message à tous les abonnés popup`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Subscriber Count */}
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                          <div className="text-sm font-semibold text-foreground mb-1">
                            {language === 'en' ? 'Subscribers Count' : 'Nombre d\'Abonnés'}
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {phoneSubscribers.length}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {language === 'en' 
                              ? 'This message will be sent to all popup subscribers'
                              : 'Ce message sera envoyé à tous les abonnés popup'}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>{language === 'en' ? 'Message' : 'Message'} *</Label>
                          <Textarea
                            value={broadcastMessage}
                            onChange={(e) => setBroadcastMessage(e.target.value)}
                            placeholder=""
                            className="min-h-[200px] text-sm bg-background text-foreground"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{language === 'en' ? 'Characters' : 'Caractères'}: {broadcastMessage.length}</span>
                            <span>{language === 'en' ? 'Approx. messages' : 'Messages approx.'}: {Math.ceil(broadcastMessage.length / 160)}</span>
                          </div>
                        </div>
                        <Button
                          onClick={handleSendBroadcast}
                          disabled={sendingBroadcast || !broadcastMessage.trim() || phoneSubscribers.length === 0}
                          className="w-full btn-gradient"
                          size="lg"
                        >
                          {sendingBroadcast ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                              {language === 'en' ? 'Sending SMS...' : 'Envoi SMS...'}
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5 mr-2" />
                              {language === 'en' 
                                ? `Send to ${phoneSubscribers.length} Subscribers`
                                : `Envoyer à ${phoneSubscribers.length} Abonnés`}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Targeted Mode Card - Ambassador Applications by City */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-600">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Target className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Targeted Mode' : 'Mode Ciblé'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? `Send message to ambassador applications by city`
                            : `Envoyer un message aux candidatures d'ambassadeurs par ville`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* City Selector */}
                        <div className="space-y-2">
                          <Label>{language === 'en' ? 'Select City' : 'Sélectionner une Ville'} *</Label>
                          <Select
                            value={targetedCity || undefined}
                            onValueChange={handleTargetedCityChange}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder={language === 'en' ? 'Select a city...' : 'Sélectionner une ville...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {CITIES.map((city) => (
                                <SelectItem key={city} value={city}>
                                  {city}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Count Display */}
                        {targetedCity && (
                          <div className="p-3 bg-muted/30 rounded-lg border border-border">
                            {loadingTargetedCount ? (
                              <div className="flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">
                                  {language === 'en' ? 'Loading count...' : 'Chargement du nombre...'}
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className="text-sm font-semibold text-foreground mb-1">
                                  {language === 'en' ? 'Phone Numbers Count' : 'Nombre de Numéros'}
                                </div>
                                <div className="text-2xl font-bold text-primary">
                                  {targetedCount}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {language === 'en' 
                                    ? `This message will be sent to ${targetedCount} numbers in ${targetedCity}`
                                    : `Ce message sera envoyé à ${targetedCount} numéros à ${targetedCity}`}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <Label>{language === 'en' ? 'Message' : 'Message'} *</Label>
                          <Textarea
                            value={targetedMessage}
                            onChange={(e) => setTargetedMessage(e.target.value)}
                            placeholder=""
                            className="min-h-[200px] text-sm bg-background text-foreground"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{language === 'en' ? 'Characters' : 'Caractères'}: {targetedMessage.length}</span>
                            <span>{language === 'en' ? 'Approx. messages' : 'Messages approx.'}: {Math.ceil(targetedMessage.length / 160)}</span>
                          </div>
                        </div>
                        <Button
                          onClick={handleSendTargeted}
                          disabled={sendingTargeted || !targetedMessage.trim() || !targetedCity || targetedCount === 0 || loadingTargetedCount}
                          className="w-full btn-gradient"
                          size="lg"
                        >
                          {sendingTargeted ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                              {language === 'en' ? 'Sending SMS...' : 'Envoi SMS...'}
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5 mr-2" />
                              {language === 'en' 
                                ? targetedCity && targetedCount > 0
                                  ? `Send to ${targetedCount} Numbers in ${targetedCity}`
                                  : 'Select City to Send'
                                : targetedCity && targetedCount > 0
                                  ? `Envoyer à ${targetedCount} Numéros à ${targetedCity}`
                                  : 'Sélectionner une Ville'}
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
                              <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                                {smsLogs.map((log) => {
                                  const logWithApiResponse = log as typeof log & { api_response?: any };
                                  
                                  // Parse API response to check actual status
                                  let apiResponseParsed: any = null;
                                  let actualStatus = log.status;
                                  let apiMessage = '';
                                  
                                  if (logWithApiResponse.api_response) {
                                    try {
                                      apiResponseParsed = typeof logWithApiResponse.api_response === 'string' 
                                        ? JSON.parse(logWithApiResponse.api_response)
                                        : logWithApiResponse.api_response;
                                      
                                      // Check if API says success but log says failed (fix incorrect status)
                                      if (apiResponseParsed.code === 'ok' || 
                                          apiResponseParsed.code === '200' ||
                                          (apiResponseParsed.message && apiResponseParsed.message.toLowerCase().includes('successfully'))) {
                                        actualStatus = 'sent';
                                        apiMessage = apiResponseParsed.message || 'Successfully sent';
                                      }
                                    } catch (e) {
                                      // Keep original status if parsing fails
                                    }
                                  }
                                  
                                  const isSuccess = actualStatus === 'sent';
                                  
                                  return (
                                  <div
                                    key={log.id}
                                    className={`p-4 rounded-lg border transition-all duration-300 hover:shadow-md ${
                                      isSuccess
                                        ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                                        : log.status === 'failed'
                                        ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
                                        : 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* Status Icon */}
                                      <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                        isSuccess 
                                          ? 'bg-green-500/20' 
                                          : log.status === 'failed'
                                          ? 'bg-red-500/20'
                                          : 'bg-yellow-500/20'
                                      }`}>
                                        {isSuccess ? (
                                          <CheckCircle className="w-5 h-5 text-green-500" />
                                        ) : log.status === 'failed' ? (
                                          <XCircle className="w-5 h-5 text-red-500" />
                                        ) : (
                                          <Clock className="w-5 h-5 text-yellow-500" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        {/* Header with Status and Phone */}
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <Badge
                                            variant={isSuccess ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}
                                            className={
                                              isSuccess
                                                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                                : log.status === 'failed'
                                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                                : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                            }
                                          >
                                            {isSuccess
                                              ? (language === 'en' ? 'Sent' : 'Envoyé')
                                              : log.status === 'failed'
                                              ? (language === 'en' ? 'Failed' : 'Échoué')
                                              : (language === 'en' ? 'Pending' : 'En Attente')}
                                          </Badge>
                                          <div className="flex items-center gap-1.5 text-sm font-medium">
                                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="font-mono">+216 {log.phone_number}</span>
                                          </div>
                                        </div>
                                        
                                        {/* Message */}
                                        <div className="mb-3">
                                          <p className="text-sm text-foreground/90 leading-relaxed">
                                            {log.message}
                                          </p>
                                        </div>
                                        
                                        {/* Success Message (if API says success) */}
                                        {isSuccess && apiMessage && (
                                          <div className="mb-2 p-2 bg-green-500/20 rounded-md border border-green-500/30">
                                            <div className="flex items-center gap-1.5 text-xs text-green-300">
                                              <CheckCircle className="w-3.5 h-3.5" />
                                              <span className="font-medium">{apiMessage}</span>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Error Message */}
                                        {log.error_message && !isSuccess && (
                                          <div className="mb-2 p-2 bg-red-500/20 rounded-md border border-red-500/30">
                                            <div className="flex items-start gap-1.5">
                                              <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                                              <div className="text-xs text-red-300">
                                                <span className="font-medium">{language === 'en' ? 'Error' : 'Erreur'}: </span>
                                                <span>{log.error_message}</span>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* API Response Details */}
                                        {logWithApiResponse.api_response && (
                                          <details className="mt-2 group">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5 list-none">
                                              <FileText className="w-3.5 h-3.5" />
                                              <span>{language === 'en' ? 'View API Response' : 'Voir Réponse API'}</span>
                                              <span className="ml-auto text-muted-foreground/50 group-open:hidden">▼</span>
                                              <span className="ml-auto text-muted-foreground/50 hidden group-open:inline">▲</span>
                                            </summary>
                                            <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border">
                                              <pre className="text-xs font-mono text-foreground/80 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                                                {typeof logWithApiResponse.api_response === 'string' 
                                                  ? logWithApiResponse.api_response 
                                                  : JSON.stringify(logWithApiResponse.api_response, null, 2)}
                                              </pre>
                                            </div>
                                          </details>
                                        )}
                                        
                                        {/* Timestamp */}
                                        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                                          <Clock className="w-3.5 h-3.5" />
                                          <span>
                                            {log.sent_at
                                              ? new Date(log.sent_at).toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  second: '2-digit'
                                                })
                                              : new Date(log.created_at).toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  second: '2-digit'
                                                })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Logs Tab - Only visible to super_admin */}
              {currentAdminRole === 'super_admin' && (
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
              )}

              {/* Settings Tab - Only visible to super_admin */}
              {currentAdminRole === 'super_admin' && (
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
                          onClick={() => updateSalesSettingsData(!salesEnabled)}
                          disabled={loadingSalesSettings}
                          variant={salesEnabled ? "default" : "destructive"}
                          size="sm"
                          className="ml-2 flex-shrink-0 transition-all duration-300"
                        >
                          {loadingSalesSettings ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : salesEnabled ? (
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
                            <XCircle className="w-4 h-4" />
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
                            updateMaintenanceSettings(maintenanceEnabled, maintenanceMessage, allowAmbassadorApplication);
                          }}
                          className="min-h-[80px] text-sm bg-background text-foreground"
                        />
                      </div>

                      {/* Allow Ambassador Application Checkbox */}
                      {maintenanceEnabled && (
                        <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id="allow-ambassador-application"
                              checked={allowAmbassadorApplication}
                              onCheckedChange={(checked) => {
                                const newValue = checked === true;
                                setAllowAmbassadorApplication(newValue);
                                updateMaintenanceSettings(maintenanceEnabled, maintenanceMessage, newValue);
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <Label 
                                htmlFor="allow-ambassador-application" 
                                className="text-sm font-medium text-foreground cursor-pointer"
                              >
                                {t.allowAmbassadorApplication}
                              </Label>
                              <p className="text-xs text-foreground/60">
                                {t.allowAmbassadorApplicationDescription}
                              </p>
                            </div>
                          </div>
                        </div>
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
                          variant={ambassadorApplicationEnabled ? "default" : "destructive"}
                          size="sm"
                          className="ml-2 flex-shrink-0 transition-all duration-300"
                        >
                          {loadingAmbassadorApplicationSettings ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : ambassadorApplicationEnabled ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
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
                          <Video className="w-5 h-5 text-primary" />
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
                            {/* Upload Hero Image/Video */}
                            <div className="space-y-2">
                              <Label>{t.uploadHeroImage}</Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadHeroImage(file);
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/*,video/mp4,video/quicktime,.mp4,.mov"
                                maxSize={50}
                                label={uploadingHeroImage ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : (language === 'en' ? 'Upload Image or Video' : 'Télécharger une Image ou une Vidéo')}
                              />
                              {uploadingHeroImage && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  {language === 'en' ? 'Uploading media...' : 'Téléchargement du média...'}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {language === 'en' 
                                  ? 'Supports images (JPG, PNG) and videos (MP4, MOV). Recommended: MP4 (H.264), 5-10 seconds, under 2MB for fast loading. Videos will auto-play muted and loop.' 
                                  : 'Prend en charge les images (JPG, PNG) et les vidéos (MP4, MOV). Recommandé: MP4 (H.264), 5-10 secondes, moins de 2MB pour un chargement rapide. Les vidéos se liront automatiquement en muet et en boucle.'}
                              </p>
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
                                  {heroImages.map((item, index) => (
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
                                            {item.type === 'video' 
                                              ? (language === 'en' ? 'Video' : 'Vidéo') 
                                              : (language === 'en' ? 'Image' : 'Image')} {index + 1}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <Badge variant={item.type === 'video' ? 'default' : 'outline'} className="text-xs">
                                              {item.type === 'video' ? <Video className="w-3 h-3 mr-1" /> : <Image className="w-3 h-3 mr-1" />}
                                              {item.type === 'video' ? (language === 'en' ? 'Video' : 'Vidéo') : (language === 'en' ? 'Image' : 'Image')}
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
                                onUrlChange={() => {}}
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

                  {/* Favicon Management Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'Favicon Management' : 'Gestion des Favicons'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? 'Upload favicons that appear in browser tabs and bookmarks. Different sizes are used for different contexts.' 
                            : 'Téléchargez des favicons qui apparaissent dans les onglets du navigateur et les signets. Différentes tailles sont utilisées pour différents contextes.'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {loadingFaviconSettings ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Favicon ICO (16x16) */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <Image className="w-4 h-4" />
                                {language === 'en' ? 'Favicon ICO (16x16)' : 'Favicon ICO (16x16)'}
                                <span className="text-xs text-muted-foreground font-normal">
                                  {language === 'en' ? '(Browser tab icon)' : '(Icône d\'onglet du navigateur)'}
                                </span>
                              </Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadFavicon(file, 'favicon_ico');
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/x-icon,image/vnd.microsoft.icon,.ico"
                                label={uploadingFavicon.type === 'favicon_ico' && uploadingFavicon.loading ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : (language === 'en' ? 'Upload ICO Favicon' : 'Télécharger le Favicon ICO')}
                                maxSize={1 * 1024 * 1024}
                                currentUrl={faviconSettings.favicon_ico}
                              />
                              {faviconSettings.favicon_ico && (
                                <div className="mt-2 flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                                  <img 
                                    src={faviconSettings.favicon_ico} 
                                    alt="Favicon ICO" 
                                    className="w-8 h-8 object-contain flex-shrink-0 border border-border/50 rounded" 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground break-all">{faviconSettings.favicon_ico}</p>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteFavicon('favicon_ico')}
                                    className="flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3 mr-2" />
                                    {language === 'en' ? 'Delete' : 'Supprimer'}
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Favicon 32x32 */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <Image className="w-4 h-4" />
                                {language === 'en' ? 'Favicon PNG (32x32)' : 'Favicon PNG (32x32)'}
                                <span className="text-xs text-muted-foreground font-normal">
                                  {language === 'en' ? '(High DPI displays)' : '(Écrans haute résolution)'}
                                </span>
                              </Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadFavicon(file, 'favicon_32x32');
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/png"
                                label={uploadingFavicon.type === 'favicon_32x32' && uploadingFavicon.loading ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : (language === 'en' ? 'Upload 32x32 Favicon' : 'Télécharger le Favicon 32x32')}
                                maxSize={1 * 1024 * 1024}
                                currentUrl={faviconSettings.favicon_32x32}
                              />
                              {faviconSettings.favicon_32x32 && (
                                <div className="mt-2 flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                                  <img 
                                    src={faviconSettings.favicon_32x32} 
                                    alt="Favicon 32x32" 
                                    className="w-8 h-8 object-contain flex-shrink-0 border border-border/50 rounded" 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground break-all">{faviconSettings.favicon_32x32}</p>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteFavicon('favicon_32x32')}
                                    className="flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3 mr-2" />
                                    {language === 'en' ? 'Delete' : 'Supprimer'}
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Favicon 16x16 */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <Image className="w-4 h-4" />
                                {language === 'en' ? 'Favicon PNG (16x16)' : 'Favicon PNG (16x16)'}
                                <span className="text-xs text-muted-foreground font-normal">
                                  {language === 'en' ? '(Standard displays)' : '(Écrans standard)'}
                                </span>
                              </Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadFavicon(file, 'favicon_16x16');
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/png"
                                label={uploadingFavicon.type === 'favicon_16x16' && uploadingFavicon.loading ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : (language === 'en' ? 'Upload 16x16 Favicon' : 'Télécharger le Favicon 16x16')}
                                maxSize={1 * 1024 * 1024}
                                currentUrl={faviconSettings.favicon_16x16}
                              />
                              {faviconSettings.favicon_16x16 && (
                                <div className="mt-2 flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                                  <img 
                                    src={faviconSettings.favicon_16x16} 
                                    alt="Favicon 16x16" 
                                    className="w-8 h-8 object-contain flex-shrink-0 border border-border/50 rounded" 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground break-all">{faviconSettings.favicon_16x16}</p>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteFavicon('favicon_16x16')}
                                    className="flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3 mr-2" />
                                    {language === 'en' ? 'Delete' : 'Supprimer'}
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Apple Touch Icon */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <Image className="w-4 h-4" />
                                {language === 'en' ? 'Apple Touch Icon (180x180)' : 'Icône Apple Touch (180x180)'}
                                <span className="text-xs text-muted-foreground font-normal">
                                  {language === 'en' ? '(iOS home screen)' : '(Écran d\'accueil iOS)'}
                                </span>
                              </Label>
                              <FileUpload
                                onFileSelect={(file) => {
                                  if (file) {
                                    handleUploadFavicon(file, 'apple_touch_icon');
                                  }
                                }}
                                onUrlChange={() => {}}
                                accept="image/png"
                                label={uploadingFavicon.type === 'apple_touch_icon' && uploadingFavicon.loading ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : (language === 'en' ? 'Upload Apple Touch Icon' : 'Télécharger l\'Icône Apple Touch')}
                                maxSize={2 * 1024 * 1024}
                                currentUrl={faviconSettings.apple_touch_icon}
                              />
                              {faviconSettings.apple_touch_icon && (
                                <div className="mt-2 flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                                  <img 
                                    src={faviconSettings.apple_touch_icon} 
                                    alt="Apple Touch Icon" 
                                    className="w-12 h-12 object-contain flex-shrink-0 border border-border/50 rounded" 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground break-all">{faviconSettings.apple_touch_icon}</p>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteFavicon('apple_touch_icon')}
                                    className="flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3 mr-2" />
                                    {language === 'en' ? 'Delete' : 'Supprimer'}
                                  </Button>
                                </div>
                              )}
                            </div>

                            <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-200">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                {language === 'en' 
                                  ? 'After uploading new favicons, you may need to hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R) to see the changes. Browsers cache favicons aggressively.' 
                                  : 'Après avoir téléchargé de nouveaux favicons, vous devrez peut-être actualiser votre navigateur (Ctrl+Shift+R ou Cmd+Shift+R) pour voir les changements. Les navigateurs mettent en cache les favicons de manière agressive.'}
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* OG Image Management Card */}
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 md:col-span-2 lg:col-span-3">
                    <Card className="shadow-lg h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Image className="w-5 h-5 text-primary" />
                          {language === 'en' ? 'OG Image Management' : 'Gestion de l\'Image OG'}
                        </CardTitle>
                        <p className="text-sm text-foreground/70 mt-2">
                          {language === 'en' 
                            ? 'Upload the Open Graph image that appears when your site is shared on Facebook, WhatsApp, Twitter, LinkedIn, and other social platforms. Image must be at least 1200x630 pixels (recommended: 1200x630px).' 
                            : 'Téléchargez l\'image Open Graph qui apparaît lorsque votre site est partagé sur Facebook, WhatsApp, Twitter, LinkedIn et d\'autres plateformes sociales. L\'image doit faire au moins 1200x630 pixels (recommandé: 1200x630px).'}
                        </p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        <div className="space-y-4">
                          {/* Current OG Image Preview */}
                          {currentOGImageUrl && (
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">
                                {language === 'en' ? 'Current OG Image' : 'Image OG Actuelle'}
                              </Label>
                              <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                                <div className="flex items-start gap-4">
                                  <img 
                                    src={currentOGImageUrl} 
                                    alt="Current OG Image" 
                                    className="w-32 h-20 object-cover flex-shrink-0 border border-border/50 rounded" 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground break-all mb-2">
                                      <strong>{language === 'en' ? 'URL:' : 'URL:'}</strong> {window.location.origin}{currentOGImageUrl}
                                    </p>
                                    <p className="text-xs text-muted-foreground mb-3">
                                      {language === 'en' 
                                        ? 'This image is used for social media sharing. Upload a new image to replace it or delete it.' 
                                        : 'Cette image est utilisée pour le partage sur les réseaux sociaux. Téléchargez une nouvelle image pour la remplacer ou supprimez-la.'}
                                    </p>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={handleDeleteOGImage}
                                      className="flex-shrink-0"
                                    >
                                      <Trash2 className="w-3 h-3 mr-2" />
                                      {language === 'en' ? 'Delete OG Image' : 'Supprimer l\'Image OG'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Upload OG Image */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                              <Upload className="w-4 h-4" />
                              {language === 'en' ? 'Upload OG Image' : 'Télécharger l\'Image OG'}
                              <span className="text-xs text-muted-foreground font-normal">
                                {language === 'en' ? '(PNG or JPG, min 1200x630px)' : '(PNG ou JPG, min 1200x630px)'}
                              </span>
                            </Label>
                            <FileUpload
                              onFileSelect={(file) => {
                                if (file) {
                                  handleUploadOGImage(file);
                                }
                              }}
                              onUrlChange={() => {}}
                              accept="image/png,image/jpeg,image/jpg"
                              label={uploadingOGImage ? (language === 'en' ? 'Uploading...' : 'Téléchargement...') : (language === 'en' ? 'Upload OG Image' : 'Télécharger l\'Image OG')}
                              maxSize={5 * 1024 * 1024}
                              currentUrl={currentOGImageUrl || undefined}
                            />
                          </div>

                          <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {language === 'en' 
                                ? 'After uploading a new OG image, use Facebook Sharing Debugger (developers.facebook.com/tools/debug/) to clear the cache and see the new image. Social media platforms cache OG images aggressively.' 
                                : 'Après avoir téléchargé une nouvelle image OG, utilisez le Facebook Sharing Debugger (developers.facebook.com/tools/debug/) pour vider le cache et voir la nouvelle image. Les plateformes de médias sociaux mettent en cache les images OG de manière agressive.'}
                            </AlertDescription>
                          </Alert>

                          <div className="text-xs text-muted-foreground space-y-1">
                            <p><strong>{language === 'en' ? 'Requirements:' : 'Exigences:'}</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              <li>{language === 'en' ? 'Minimum size: 200x200 pixels' : 'Taille minimale: 200x200 pixels'}</li>
                              <li>{language === 'en' ? 'Recommended size: 1200x630 pixels (1.91:1 ratio)' : 'Taille recommandée: 1200x630 pixels (ratio 1.91:1)'}</li>
                              <li>{language === 'en' ? 'Format: PNG or JPG' : 'Format: PNG ou JPG'}</li>
                              <li>{language === 'en' ? 'Maximum file size: 5MB' : 'Taille maximale du fichier: 5MB'}</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              )}
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

      {/* Order Details Dialog */}
      <Dialog open={isOrderDetailsOpen} onOpenChange={(open) => {
        setIsOrderDetailsOpen(open);
        if (!open) {
          setSelectedOrder(null);
          setSelectedOrderAmbassador(null);
          setEmailDeliveryLogs([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === 'en' ? 'Order Details' : 'Détails de la Commande'}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Summary Card */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Order Summary' : 'Résumé de la Commande'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {language === 'en' ? 'Order ID' : 'ID Commande'}
                      </Label>
                      <p className="font-mono text-sm break-all">{selectedOrder.id}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {language === 'en' ? 'Status' : 'Statut'}
                      </Label>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "w-3 h-3 rounded-full cursor-help",
                                  selectedOrder.status === 'PAID' || selectedOrder.status === 'APPROVED' || selectedOrder.status === 'COMPLETED' ? 'bg-green-500' :
                                  selectedOrder.status === 'REJECTED' || selectedOrder.status?.includes('CANCELLED') ? 'bg-red-500' :
                                  selectedOrder.status === 'PENDING_ADMIN_APPROVAL' ? 'bg-yellow-500' :
                                  selectedOrder.status === 'PENDING_CASH' ? 'bg-gray-500' :
                                  'bg-gray-500'
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{selectedOrder.status}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge 
                          variant={
                            selectedOrder.status === 'PAID' || selectedOrder.status === 'APPROVED' || selectedOrder.status === 'COMPLETED' ? 'default' :
                            selectedOrder.status === 'REJECTED' || selectedOrder.status?.includes('CANCELLED') ? 'destructive' :
                            selectedOrder.status === 'PENDING_ADMIN_APPROVAL' ? 'secondary' :
                            selectedOrder.status === 'PENDING_CASH' ? 'secondary' :
                            'secondary'
                          }
                          className={
                            selectedOrder.status === 'PAID' || selectedOrder.status === 'APPROVED' || selectedOrder.status === 'COMPLETED' ? 'bg-green-500 text-white border-green-600' :
                            selectedOrder.status === 'REJECTED' || selectedOrder.status?.includes('CANCELLED') ? 'bg-red-500 text-white border-red-600' :
                            selectedOrder.status === 'PENDING_ADMIN_APPROVAL' ? 'bg-yellow-500 text-white border-yellow-600' :
                            selectedOrder.status === 'PENDING_CASH' ? 'bg-gray-500 text-white border-gray-600' :
                            ''
                          }
                        >
                          {selectedOrder.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {language === 'en' ? 'Order Type' : 'Type de Commande'}
                      </Label>
                      <Badge variant="outline" className="font-normal">
                        {selectedOrder.source === 'platform_online' ? (language === 'en' ? 'Platform Online' : 'Plateforme En Ligne') :
                         selectedOrder.source === 'ambassador_manual' ? (language === 'en' ? 'Ambassador Manual (COD)' : 'Manuel Ambassadeur (COD)') :
                         selectedOrder.source}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {language === 'en' ? 'Created At' : 'Créé Le'}
                      </Label>
                      <p className="text-sm">{new Date(selectedOrder.created_at).toLocaleString(language === 'en' ? 'en-US' : 'fr-FR')}</p>
                    </div>
                    {selectedOrder.total_price && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {language === 'en' ? 'Total Amount' : 'Montant Total'}
                        </Label>
                        <p className="text-lg font-bold text-primary">{selectedOrder.total_price.toFixed(2)} TND</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Customer Information' : 'Informations Client'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {language === 'en' ? 'Name' : 'Nom'}
                      </Label>
                      <p className="font-semibold text-base">{selectedOrder.user_name || selectedOrder.customer_name || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {language === 'en' ? 'Phone' : 'Téléphone'}
                      </Label>
                      <p className="text-base">{selectedOrder.user_phone || selectedOrder.phone || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {language === 'en' ? 'Email' : 'Email'}
                      </Label>
                      <p className="text-base break-all">{selectedOrder.user_email || selectedOrder.email || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {language === 'en' ? 'City/Ville' : 'Ville/Quartier'}
                      </Label>
                      <p className="text-base">{selectedOrder.city || 'N/A'}{selectedOrder.ville ? ` - ${selectedOrder.ville}` : ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Order Items' : 'Articles de Commande'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                {(() => {
                  // Try to parse notes to get detailed pass breakdown
                  let allPasses: any[] = [];
                  try {
                    if (selectedOrder.notes) {
                      const notesData = typeof selectedOrder.notes === 'string' 
                        ? JSON.parse(selectedOrder.notes) 
                        : selectedOrder.notes;
                      if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                        allPasses = notesData.all_passes;
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing notes:', e);
                  }

                  // If we have detailed pass breakdown, show it
                  if (allPasses.length > 0) {
                    // Calculate total from passes array to ensure accuracy
                    const calculatedTotal = allPasses.reduce((sum: number, pass: any) => {
                      return sum + ((pass.price || 0) * (pass.quantity || 0));
                    }, 0);
                    
                    return (
                      <div className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === 'en' ? 'Pass Type' : 'Type Pass'}</TableHead>
                              <TableHead>{language === 'en' ? 'Quantity' : 'Quantité'}</TableHead>
                              <TableHead>{language === 'en' ? 'Unit Price' : 'Prix Unitaire'}</TableHead>
                              <TableHead>{language === 'en' ? 'Subtotal' : 'Sous-total'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allPasses.map((pass: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <Badge variant={pass.passType === 'vip' ? 'default' : 'secondary'}>
                                    {pass.passType?.toUpperCase() || 'STANDARD'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-semibold">{pass.quantity || 0}</TableCell>
                                <TableCell>{pass.price?.toFixed(2) || '0.00'} TND</TableCell>
                                <TableCell className="font-semibold">
                                  {((pass.price || 0) * (pass.quantity || 0)).toFixed(2)} TND
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                              <TableCell colSpan={3} className="text-right">
                                {language === 'en' ? 'Total' : 'Total'}
                              </TableCell>
                              <TableCell className="text-lg">
                                {calculatedTotal.toFixed(2)} TND
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    );
                  }

                  // Fallback to simple display for old orders
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-muted-foreground">{language === 'en' ? 'Pass Type' : 'Type Pass'}</Label>
                        <p className="font-semibold uppercase">{selectedOrder.pass_type}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">{language === 'en' ? 'Quantity' : 'Quantité'}</Label>
                        <p className="font-semibold">{selectedOrder.quantity}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">{language === 'en' ? 'Total Price' : 'Prix Total'}</Label>
                        <p className="font-semibold text-lg">{selectedOrder.total_price?.toFixed(2) || '0.00'} TND</p>
                      </div>
                    </div>
                  );
                })()}
                </CardContent>
              </Card>

              {/* Ambassador Information */}
              {selectedOrder.ambassador_id && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      {language === 'en' ? 'Assigned Ambassador' : 'Ambassadeur Assigné'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedOrderAmbassador ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {language === 'en' ? 'Name' : 'Nom'}
                          </Label>
                          <p className="font-semibold text-base">{selectedOrderAmbassador.full_name}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {language === 'en' ? 'Phone' : 'Téléphone'}
                          </Label>
                          <p className="text-base">{selectedOrderAmbassador.phone}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {language === 'en' ? 'Email' : 'Email'}
                          </Label>
                          <p className="text-base break-all">{selectedOrderAmbassador.email || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {language === 'en' ? 'City/Ville' : 'Ville/Quartier'}
                          </Label>
                          <p className="text-base">{selectedOrderAmbassador.city || 'N/A'}{selectedOrderAmbassador.ville ? ` - ${selectedOrderAmbassador.ville}` : ''}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {language === 'en' ? 'Status' : 'Statut'}
                          </Label>
                          <Badge variant={selectedOrderAmbassador.status === 'approved' ? 'default' : 'secondary'}>
                            {selectedOrderAmbassador.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            {language === 'en' ? 'Commission Rate' : 'Taux de Commission'}
                          </Label>
                          <p className="text-base font-semibold">{selectedOrderAmbassador.commission_rate || 0}%</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground font-mono">{selectedOrder.ambassador_id}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">{language === 'en' ? 'Timestamps' : 'Horodatages'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {selectedOrder.assigned_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Assigned At' : 'Assigné Le'}</Label>
                      <p>{new Date(selectedOrder.assigned_at).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedOrder.accepted_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Accepted At' : 'Accepté Le'}</Label>
                      <p>{new Date(selectedOrder.accepted_at).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedOrder.approved_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Approved At' : 'Approuvé Le'}</Label>
                      <p>{new Date(selectedOrder.approved_at).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedOrder.rejected_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Rejected At' : 'Rejeté Le'}</Label>
                      <p>{new Date(selectedOrder.rejected_at).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedOrder.rejection_reason && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">{language === 'en' ? 'Rejection Reason' : 'Raison du Rejet'}</Label>
                      <p className="text-sm text-destructive">{selectedOrder.rejection_reason}</p>
                    </div>
                  )}
                  {selectedOrder.completed_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Completed At' : 'Terminé Le'}</Label>
                      <p>{new Date(selectedOrder.completed_at).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedOrder.cancelled_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Cancelled At' : 'Annulé Le'}</Label>
                      <p>{new Date(selectedOrder.cancelled_at).toLocaleString()}</p>
                      {selectedOrder.cancellation_reason && (
                        <p className="mt-1 text-muted-foreground italic">{language === 'en' ? 'Reason' : 'Raison'}: {selectedOrder.cancellation_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Logs */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Order Activity Log' : 'Journal d\'Activité de la Commande'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    {orderLogs.filter((log: any) => log.order_id === selectedOrder.id).length > 0 ? (
                      <div className="space-y-3">
                        {orderLogs
                          .filter((log: any) => log.order_id === selectedOrder.id)
                          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((log: any, index: number) => {
                            const getActionIcon = () => {
                              switch (log.action) {
                                case 'approved':
                                  return <CheckCircle className="w-4 h-4 text-green-500" />;
                                case 'rejected':
                                  return <XCircle className="w-4 h-4 text-red-500" />;
                                case 'cancelled':
                                  return <XCircle className="w-4 h-4 text-orange-500" />;
                                case 'status_changed':
                                  return <RefreshCw className="w-4 h-4 text-blue-500" />;
                                case 'created':
                                  return <Plus className="w-4 h-4 text-purple-500" />;
                                default:
                                  return <Clock className="w-4 h-4 text-muted-foreground" />;
                              }
                            };

                            const getActionBadge = () => {
                              const actionMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                                'approved': { label: language === 'en' ? 'Approved' : 'Approuvé', variant: 'default' },
                                'rejected': { label: language === 'en' ? 'Rejected' : 'Rejeté', variant: 'destructive' },
                                'cancelled': { label: language === 'en' ? 'Cancelled' : 'Annulé', variant: 'destructive' },
                                'status_changed': { label: language === 'en' ? 'Status Changed' : 'Statut Modifié', variant: 'secondary' },
                                'created': { label: language === 'en' ? 'Created' : 'Créé', variant: 'outline' },
                              };
                              const actionInfo = actionMap[log.action] || { label: log.action, variant: 'outline' as const };
                              return (
                                <Badge 
                                  variant={actionInfo.variant}
                                  className={actionInfo.variant === 'default' ? 'bg-green-500/20 text-green-300 border-green-500/30' : ''}
                                >
                                  {actionInfo.label}
                                </Badge>
                              );
                            };

                            const getPerformedByBadge = () => {
                              const typeMap: Record<string, { label: string; color: string }> = {
                                'admin': { label: language === 'en' ? 'Admin' : 'Admin', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                                'ambassador': { label: language === 'en' ? 'Ambassador' : 'Ambassadeur', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                                'system': { label: language === 'en' ? 'System' : 'Système', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
                              };
                              const typeInfo = typeMap[log.performed_by_type] || { label: log.performed_by_type || 'N/A', color: 'bg-muted text-muted-foreground border-border' };
                              return (
                                <Badge variant="outline" className={typeInfo.color}>
                                  {typeInfo.label}
                                </Badge>
                              );
                            };

                            const formatTimestamp = (timestamp: string) => {
                              const date = new Date(timestamp);
                              const now = new Date();
                              const diffMs = now.getTime() - date.getTime();
                              const diffMins = Math.floor(diffMs / 60000);
                              const diffHours = Math.floor(diffMs / 3600000);
                              const diffDays = Math.floor(diffMs / 86400000);

                              if (diffMins < 1) return language === 'en' ? 'Just now' : 'À l\'instant';
                              if (diffMins < 60) return `${diffMins} ${language === 'en' ? 'min ago' : 'min'}`;
                              if (diffHours < 24) return `${diffHours} ${language === 'en' ? 'hours ago' : 'heures'}`;
                              if (diffDays < 7) return `${diffDays} ${language === 'en' ? 'days ago' : 'jours'}`;
                              return date.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                            };

                            return (
                              <div 
                                key={log.id} 
                                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background/50 hover:bg-muted/50 transition-colors"
                              >
                                <div className="mt-0.5">
                                  {getActionIcon()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    {getActionBadge()}
                                    {getPerformedByBadge()}
                                  </div>
                                  {log.details && typeof log.details === 'object' && (
                                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                      {log.details.old_status && log.details.new_status && (
                                        <p>
                                          {language === 'en' ? 'Status' : 'Statut'}: 
                                          <span className="ml-1 font-medium">{log.details.old_status}</span>
                                          <span className="mx-1">→</span>
                                          <span className="font-medium">{log.details.new_status}</span>
                                        </p>
                                      )}
                                      {log.details.reason && (
                                        <p className="italic">
                                          {language === 'en' ? 'Reason' : 'Raison'}: {log.details.reason}
                                        </p>
                                      )}
                                      {log.details.email_sent !== undefined && (
                                        <p>
                                          {language === 'en' ? 'Email' : 'Email'}: 
                                          <span className={`ml-1 ${log.details.email_sent ? 'text-green-500' : 'text-red-500'}`}>
                                            {log.details.email_sent ? (language === 'en' ? 'Sent' : 'Envoyé') : (language === 'en' ? 'Failed' : 'Échoué')}
                                          </span>
                                        </p>
                                      )}
                                      {log.details.sms_sent !== undefined && (
                                        <p>
                                          {language === 'en' ? 'SMS' : 'SMS'}: 
                                          <span className={`ml-1 ${log.details.sms_sent ? 'text-green-500' : 'text-red-500'}`}>
                                            {log.details.sms_sent ? (language === 'en' ? 'Sent' : 'Envoyé') : (language === 'en' ? 'Failed' : 'Échoué')}
                                          </span>
                                        </p>
                                      )}
                                      {log.details.tickets_generated !== undefined && (
                                        <p>
                                          {language === 'en' ? 'Tickets' : 'Billets'}: 
                                          <span className={`ml-1 ${log.details.tickets_generated ? 'text-green-500' : 'text-red-500'}`}>
                                            {log.details.tickets_generated ? (language === 'en' ? 'Generated' : 'Générés') : (language === 'en' ? 'Failed' : 'Échoué')}
                                          </span>
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatTimestamp(log.created_at)}</span>
                                    <span className="text-muted-foreground/50">•</span>
                                    <span>{new Date(log.created_at).toLocaleTimeString(language === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">{language === 'en' ? 'No activity logs found for this order' : 'Aucun journal d\'activité trouvé pour cette commande'}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Email Delivery Status */}
              {(selectedOrder.status === 'COMPLETED' || selectedOrder.status === 'MANUAL_COMPLETED') && selectedOrder.payment_method === 'ambassador_cash' && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary" />
                        {language === 'en' ? 'Email Delivery Status' : 'Statut de Livraison Email'}
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setLoadingEmailLogs(true);
                          try {
                            const response = await apiFetch(API_ROUTES.EMAIL_DELIVERY_LOGS(selectedOrder.id));
                            if (response.ok) {
                              const data = await response.json();
                              setEmailDeliveryLogs(data.logs || []);
                            }
                          } catch (error) {
                            console.error('Error fetching email logs:', error);
                          } finally {
                            setLoadingEmailLogs(false);
                          }
                        }}
                        disabled={loadingEmailLogs}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loadingEmailLogs ? 'animate-spin' : ''}`} />
                        {language === 'en' ? 'Refresh' : 'Actualiser'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {emailDeliveryLogs.length > 0 ? (
                      <div className="space-y-3">
                        {emailDeliveryLogs.map((log: any) => (
                          <div key={log.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={
                                    log.status === 'sent' ? 'default' :
                                    log.status === 'failed' ? 'destructive' :
                                    log.status === 'pending_retry' ? 'secondary' :
                                    'outline'
                                  }
                                >
                                  {log.status === 'sent' ? (language === 'en' ? 'Sent' : 'Envoyé') :
                                   log.status === 'failed' ? (language === 'en' ? 'Failed' : 'Échoué') :
                                   log.status === 'pending_retry' ? (language === 'en' ? 'Pending Retry' : 'Nouvelle Tentative') :
                                   language === 'en' ? 'Pending' : 'En Attente'}
                                </Badge>
                                {log.retry_count > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {language === 'en' ? `Retry ${log.retry_count}` : `Tentative ${log.retry_count}`}
                                  </span>
                                )}
                              </div>
                              {log.sent_at && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(log.sent_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground">
                                <strong>{language === 'en' ? 'To:' : 'À:'}</strong> {log.recipient_email}
                              </p>
                              {log.error_message && (
                                <p className="text-destructive text-xs mt-1">
                                  <strong>{language === 'en' ? 'Error:' : 'Erreur:'}</strong> {log.error_message}
                                </p>
                              )}
                            </div>
                            {(log.status === 'failed' || log.status === 'pending_retry') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  setResendingEmail(true);
                                  try {
                                    const response = await apiFetch(API_ROUTES.RESEND_ORDER_COMPLETION_EMAIL, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({ orderId: selectedOrder.id }),
                                    });
                                    if (response.ok) {
                                      toast({
                                        title: language === 'en' ? 'Email Resent' : 'Email Renvoyé',
                                        description: language === 'en' ? 'The completion email has been resent successfully.' : 'L\'email de confirmation a été renvoyé avec succès.',
                                        variant: 'default',
                                      });
                                      // Refresh email logs
                                      const logsResponse = await apiFetch(API_ROUTES.EMAIL_DELIVERY_LOGS(selectedOrder.id));
                                      if (logsResponse.ok) {
                                        const data = await logsResponse.json();
                                        setEmailDeliveryLogs(data.logs || []);
                                      }
                                    } else {
                                      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                      toast({
                                        title: language === 'en' ? 'Error' : 'Erreur',
                                        description: errorData.details || errorData.error || (language === 'en' ? 'Failed to resend email.' : 'Échec du renvoi de l\'email.'),
                                        variant: 'destructive',
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Error resending email:', error);
                                    toast({
                                      title: language === 'en' ? 'Error' : 'Erreur',
                                      description: language === 'en' ? 'Failed to resend email.' : 'Échec du renvoi de l\'email.',
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setResendingEmail(false);
                                  }
                                }}
                                disabled={resendingEmail}
                                className="w-full"
                              >
                                <Send className={`w-4 h-4 mr-2 ${resendingEmail ? 'animate-spin' : ''}`} />
                                {language === 'en' ? 'Resend Email' : 'Renvoyer l\'Email'}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {language === 'en' ? 'No email delivery logs found. The completion email may not have been sent yet.' : 'Aucun journal de livraison email trouvé. L\'email de confirmation n\'a peut-être pas encore été envoyé.'}
                        </p>
                        {selectedOrder.user_email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              setResendingEmail(true);
                              try {
                                const response = await apiFetch(API_ROUTES.RESEND_ORDER_COMPLETION_EMAIL, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ orderId: selectedOrder.id }),
                                });
                                if (response.ok) {
                                  toast({
                                    title: language === 'en' ? 'Email Sent' : 'Email Envoyé',
                                    description: language === 'en' ? 'The completion email has been sent successfully.' : 'L\'email de confirmation a été envoyé avec succès.',
                                    variant: 'default',
                                  });
                                  // Refresh email logs
                                  const logsResponse = await apiFetch(`/api/email-delivery-logs/${selectedOrder.id}`);
                                  if (logsResponse.ok) {
                                    const data = await logsResponse.json();
                                    setEmailDeliveryLogs(data.logs || []);
                                  }
                                } else {
                                  const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                  toast({
                                    title: language === 'en' ? 'Error' : 'Erreur',
                                    description: errorData.details || errorData.error || (language === 'en' ? 'Failed to send email.' : 'Échec de l\'envoi de l\'email.'),
                                    variant: 'destructive',
                                  });
                                }
                              } catch (error: any) {
                                console.error('Error sending email:', error);
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: error?.message || (language === 'en' ? 'Failed to send email. Please check server logs for details.' : 'Échec de l\'envoi de l\'email. Veuillez vérifier les journaux du serveur.'),
                                  variant: 'destructive',
                                });
                              } finally {
                                setResendingEmail(false);
                              }
                            }}
                            disabled={resendingEmail}
                          >
                            <Send className={`w-4 h-4 mr-2 ${resendingEmail ? 'animate-spin' : ''}`} />
                            {language === 'en' ? 'Send Completion Email' : 'Envoyer l\'Email de Confirmation'}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Admin Actions */}
              {(selectedOrder.status === 'PENDING_CASH' || 
                (selectedOrder.status === 'PENDING_ADMIN_APPROVAL' && selectedOrder.payment_method === 'ambassador_cash')) && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-primary" />
                      {language === 'en' ? 'Admin Actions' : 'Actions Admin'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {/* Admin Approve/Reject - For PENDING_ADMIN_APPROVAL (after ambassador confirms cash) */}
                      {selectedOrder.payment_method === 'ambassador_cash' && selectedOrder.status === 'PENDING_ADMIN_APPROVAL' && (
                        <>
                          <Button
                            onClick={() => handleApproveOrderAsAdmin(selectedOrder.id)}
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {language === 'en' ? 'Approve Order' : 'Approuver la Commande'}
                          </Button>
                          <Button
                            onClick={() => {
                              // Open reject dialog (reason required for ambassador cash orders)
                              setRejectingOrderId(selectedOrder.id);
                              setIsRejectDialogOpen(true);
                            }}
                            variant="destructive"
                            size="sm"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {language === 'en' ? 'Reject Order' : 'Rejeter la Commande'}
                          </Button>
                        </>
                      )}
                      
                      {/* Admin Skip Ambassador Confirmation - Only for PENDING_CASH (before ambassador confirms) */}
                      {selectedOrder.status === 'PENDING_CASH' && (
                        <Button
                          onClick={() => {
                            setSkippingOrderId(selectedOrder.id);
                            setIsSkipConfirmationDialogOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Approve Without Ambassador' : 'Approuver sans Ambassadeur'}
                        </Button>
                      )}
                      
                      {/* Approved COD orders can be completed */}
                      {selectedOrder.payment_method === 'ambassador_cash' && selectedOrder.status === 'APPROVED' && (
                        <Button
                          onClick={() => handleCompleteOrderAsAdmin(selectedOrder.id)}
                          variant="default"
                          size="sm"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Complete Order' : 'Terminer la Commande'}
                        </Button>
                      )}
                      
                      {/* Legacy status support (for backward compatibility) */}
                      {selectedOrder.status === 'PENDING' && selectedOrder.payment_method !== 'ambassador_cash' && (
                        <Button
                          onClick={() => handleApproveOrderAsAdmin(selectedOrder.id)}
                          variant="default"
                          size="sm"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Accept Order' : 'Accepter la Commande'}
                        </Button>
                      )}
                      {selectedOrder.status === 'ACCEPTED' && selectedOrder.payment_method !== 'ambassador_cash' && (
                        <Button
                          onClick={() => handleCompleteOrderAsAdmin(selectedOrder.id)}
                          variant="default"
                          size="sm"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Complete Order' : 'Terminer la Commande'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Admin Resend Ticket Email - NEW FEATURE */}
              {selectedOrder.status === 'PAID' && (
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MailCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      {language === 'en' ? 'Ticket Email Actions' : 'Actions Email de Billets'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleResendTicketEmail(selectedOrder.id)}
                        variant="outline"
                        size="sm"
                        disabled={resendingTicketEmail}
                        className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/40"
                      >
                        <Send className={`w-4 h-4 mr-2 ${resendingTicketEmail ? 'animate-spin' : ''}`} />
                        {resendingTicketEmail 
                          ? (language === 'en' ? 'Resending...' : 'Renvoi en cours...')
                          : (language === 'en' ? 'Resend Ticket Email' : 'Renvoyer l\'Email des Billets')
                        }
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        {language === 'en' 
                          ? 'Resend ticket email using existing tickets (max 5 per hour per order)'
                          : 'Renvoyer l\'email des billets en utilisant les billets existants (max 5 par heure par commande)'
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Order Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={(open) => {
        setIsRejectDialogOpen(open);
        if (!open) {
          setRejectingOrderId(null);
          setRejectionReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'en' ? 'Reject Order' : 'Rejeter la Commande'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'en' ? 'Rejection Reason' : 'Raison du Rejet'} *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={language === 'en' ? 'Enter rejection reason...' : 'Entrez la raison du rejet...'}
                rows={4}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectDialogOpen(false);
                  setRejectingOrderId(null);
                  setRejectionReason('');
                }}
              >
                {language === 'en' ? 'Cancel' : 'Annuler'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (rejectingOrderId && rejectionReason.trim()) {
                    handleRejectCodAmbassadorOrder(rejectingOrderId, rejectionReason.trim());
                  } else {
                    toast({
                      title: language === 'en' ? 'Error' : 'Erreur',
                      description: language === 'en' ? 'Rejection reason is required' : 'La raison du rejet est requise',
                      variant: 'destructive'
                    });
                  }
                }}
                disabled={!rejectionReason.trim()}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {language === 'en' ? 'Reject Order' : 'Rejeter la Commande'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Skip Ambassador Confirmation Dialog - NEW FEATURE */}
      <Dialog open={isSkipConfirmationDialogOpen} onOpenChange={(open) => {
        setIsSkipConfirmationDialogOpen(open);
        if (!open) {
          setSkippingOrderId(null);
          setSkipReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-600" />
              {language === 'en' ? 'Skip Ambassador Confirmation' : 'Ignorer la Confirmation de l\'Ambassadeur'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="default" className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-orange-900 dark:text-orange-200">
                {language === 'en' 
                  ? 'This action will approve the order and generate tickets WITHOUT waiting for ambassador cash confirmation. Use only when ambassador has confirmed payment separately.'
                  : 'Cette action approuvera la commande et générera les billets SANS attendre la confirmation de l\'ambassadeur. Utilisez uniquement lorsque l\'ambassadeur a confirmé le paiement séparément.'
                }
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="skip-reason">
                {language === 'en' ? 'Reason (Optional)' : 'Raison (Optionnel)'}
              </Label>
              <Textarea
                id="skip-reason"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder={language === 'en' 
                  ? 'Enter reason for skipping ambassador confirmation (optional)...' 
                  : 'Entrez la raison de l\'ignorance de la confirmation de l\'ambassadeur (optionnel)...'
                }
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSkipConfirmationDialogOpen(false);
                  setSkippingOrderId(null);
                  setSkipReason('');
                }}
                disabled={skippingOrder}
              >
                {language === 'en' ? 'Cancel' : 'Annuler'}
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  if (skippingOrderId) {
                    handleSkipAmbassadorConfirmation(skippingOrderId, skipReason.trim() || undefined);
                  }
                }}
                disabled={skippingOrder || !skippingOrderId}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {skippingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {language === 'en' ? 'Processing...' : 'Traitement...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Skip & Approve' : 'Ignorer et Approuver'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Online Order Details Dialog */}
      <Dialog open={isOnlineOrderDetailsOpen} onOpenChange={(open) => {
        setIsOnlineOrderDetailsOpen(open);
        if (!open) {
          setSelectedOnlineOrder(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === 'en' ? 'Online Order Details' : 'Détails de la Commande en Ligne'}</DialogTitle>
          </DialogHeader>
          {selectedOnlineOrder && (
            <div className="space-y-6">
              {/* Order Summary Card */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Order Summary' : 'Résumé de la Commande'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {language === 'en' ? 'Order ID' : 'ID Commande'}
                      </Label>
                      <p className="font-mono text-sm break-all">{selectedOnlineOrder.id}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {language === 'en' ? 'Payment Status' : 'Statut de Paiement'}
                      </Label>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "w-3 h-3 rounded-full cursor-help",
                                  selectedOnlineOrder.payment_status === 'PAID' ? 'bg-green-500' :
                                  selectedOnlineOrder.payment_status === 'FAILED' || selectedOnlineOrder.payment_status === 'REFUNDED' ? 'bg-red-500' :
                                  'bg-yellow-500'
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{selectedOnlineOrder.payment_status || 'PENDING_PAYMENT'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge
                          variant={
                            selectedOnlineOrder.payment_status === 'PAID' ? 'default' :
                            selectedOnlineOrder.payment_status === 'FAILED' || selectedOnlineOrder.payment_status === 'REFUNDED' ? 'destructive' :
                            'outline'
                          }
                          className={
                            selectedOnlineOrder.payment_status === 'PAID' ? 'bg-green-500 text-white border-green-600' :
                            selectedOnlineOrder.payment_status === 'FAILED' || selectedOnlineOrder.payment_status === 'REFUNDED' ? 'bg-red-500 text-white border-red-600' :
                            ''
                          }
                        >
                          {selectedOnlineOrder.payment_status || 'PENDING_PAYMENT'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {language === 'en' ? 'Order Type' : 'Type de Commande'}
                      </Label>
                      <Badge variant="outline" className="font-normal">
                        {selectedOnlineOrder.source === 'platform_online' ? (language === 'en' ? 'Platform Online' : 'Plateforme En Ligne') : selectedOnlineOrder.source}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {language === 'en' ? 'Created At' : 'Créé Le'}
                      </Label>
                      <p className="text-sm">{new Date(selectedOnlineOrder.created_at).toLocaleString(language === 'en' ? 'en-US' : 'fr-FR')}</p>
                    </div>
                    {selectedOnlineOrder.updated_at && selectedOnlineOrder.updated_at !== selectedOnlineOrder.created_at && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {language === 'en' ? 'Updated At' : 'Mis à Jour Le'}
                        </Label>
                        <p className="text-sm">{new Date(selectedOnlineOrder.updated_at).toLocaleString(language === 'en' ? 'en-US' : 'fr-FR')}</p>
                      </div>
                    )}
                    {selectedOnlineOrder.total_price && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {language === 'en' ? 'Total Amount' : 'Montant Total'}
                        </Label>
                        <p className="text-lg font-bold text-primary">{selectedOnlineOrder.total_price.toFixed(2)} TND</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Customer Information' : 'Informations Client'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {language === 'en' ? 'Name' : 'Nom'}
                      </Label>
                      <p className="font-semibold text-base">{selectedOnlineOrder.user_name || selectedOnlineOrder.customer_name || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {language === 'en' ? 'Phone' : 'Téléphone'}
                      </Label>
                      <p className="text-base">{selectedOnlineOrder.user_phone || selectedOnlineOrder.phone || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {language === 'en' ? 'Email' : 'Email'}
                      </Label>
                      <p className="text-base break-all">{selectedOnlineOrder.user_email || selectedOnlineOrder.email || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {language === 'en' ? 'City/Ville' : 'Ville/Quartier'}
                      </Label>
                      <p className="text-base">{selectedOnlineOrder.city || 'N/A'}{selectedOnlineOrder.ville ? ` - ${selectedOnlineOrder.ville}` : ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Passes List */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Passes Purchased' : 'Passes Achetés'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                {(() => {
                  let allPasses: any[] = [];
                  try {
                    if (selectedOnlineOrder.notes) {
                      const notesData = typeof selectedOnlineOrder.notes === 'string' 
                        ? JSON.parse(selectedOnlineOrder.notes) 
                        : selectedOnlineOrder.notes;
                      if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                        allPasses = notesData.all_passes;
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing notes:', e);
                  }

                  if (allPasses.length > 0) {
                    // Calculate total from passes array to ensure accuracy
                    const calculatedTotal = allPasses.reduce((sum: number, pass: any) => {
                      return sum + ((pass.price || 0) * (pass.quantity || 0));
                    }, 0);
                    
                    return (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === 'en' ? 'Pass Type' : 'Type Pass'}</TableHead>
                            <TableHead>{language === 'en' ? 'Quantity' : 'Quantité'}</TableHead>
                            <TableHead>{language === 'en' ? 'Unit Price' : 'Prix Unitaire'}</TableHead>
                            <TableHead>{language === 'en' ? 'Subtotal' : 'Sous-total'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allPasses.map((pass: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Badge variant={pass.passType === 'vip' ? 'default' : 'secondary'}>
                                  {pass.passType?.toUpperCase() || 'STANDARD'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold">{pass.quantity || 0}</TableCell>
                              <TableCell>{pass.price?.toFixed(2) || '0.00'} TND</TableCell>
                              <TableCell className="font-semibold">
                                {((pass.quantity || 0) * (pass.price || 0)).toFixed(2)} TND
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-bold border-t-2">
                            <TableCell colSpan={3} className="text-right">
                              {language === 'en' ? 'Total' : 'Total'}
                            </TableCell>
                            <TableCell className="text-lg">
                              {calculatedTotal.toFixed(2)} TND
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    );
                  } else {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-muted-foreground">{language === 'en' ? 'Pass Type' : 'Type Pass'}</Label>
                          <p className="font-semibold uppercase">{selectedOnlineOrder.pass_type}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">{language === 'en' ? 'Quantity' : 'Quantité'}</Label>
                          <p className="font-semibold">{selectedOnlineOrder.quantity}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">{language === 'en' ? 'Total Price' : 'Prix Total'}</Label>
                          <p className="font-semibold text-lg">{selectedOnlineOrder.total_price?.toFixed(2) || '0.00'} TND</p>
                        </div>
                      </div>
                    );
                  }
                })()}
                </CardContent>
              </Card>

              {/* Payment Gateway Information */}
              {(selectedOnlineOrder.transaction_id || selectedOnlineOrder.payment_gateway_reference || selectedOnlineOrder.payment_response_data) && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      {language === 'en' ? 'Payment Gateway Information' : 'Informations Passerelle de Paiement'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedOnlineOrder.transaction_id && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {language === 'en' ? 'Transaction ID' : 'ID Transaction'}
                          </Label>
                          <p className="font-mono text-sm break-all">{selectedOnlineOrder.transaction_id}</p>
                        </div>
                      )}
                      {selectedOnlineOrder.payment_gateway_reference && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            {language === 'en' ? 'Payment Gateway Reference' : 'Référence Passerelle'}
                          </Label>
                          <p className="font-mono text-sm break-all">{selectedOnlineOrder.payment_gateway_reference}</p>
                        </div>
                      )}
                      {selectedOnlineOrder.payment_response_data && (
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {language === 'en' ? 'Payment Response Data' : 'Données de Réponse'}
                          </Label>
                          <pre className="mt-2 p-3 bg-background border rounded-lg text-xs overflow-auto max-h-40">
                            {JSON.stringify(selectedOnlineOrder.payment_response_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Logs Section (Future-ready, empty for now) */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Payment Logs' : 'Journaux de Paiement'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-background border rounded-lg text-center text-muted-foreground">
                    <p className="text-sm">
                      {language === 'en' 
                        ? 'Payment logs will appear here once the payment gateway integration is complete.'
                        : 'Les journaux de paiement apparaîtront ici une fois l\'intégration de la passerelle de paiement terminée.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Actions */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Admin Actions' : 'Actions Administrateur'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    onClick={() => updateOnlineOrderStatus(selectedOnlineOrder.id, 'PAID')}
                    disabled={selectedOnlineOrder.payment_status === 'PAID'}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Mark as Paid' : 'Marquer comme Payé'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateOnlineOrderStatus(selectedOnlineOrder.id, 'FAILED')}
                    disabled={selectedOnlineOrder.payment_status === 'FAILED'}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Mark as Failed' : 'Marquer comme Échoué'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => updateOnlineOrderStatus(selectedOnlineOrder.id, 'REFUNDED')}
                    disabled={selectedOnlineOrder.payment_status === 'REFUNDED'}
                  >
                    <ArrowDown className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Mark as Refunded' : 'Marquer comme Remboursé'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast({
                        title: language === 'en' ? 'Coming Soon' : 'Bientôt Disponible',
                        description: language === 'en' ? 'Email/SMS templates will be available soon' : 'Les modèles d\'email/SMS seront bientôt disponibles',
                        variant: "default",
                      });
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Resend Email/SMS' : 'Renvoyer Email/SMS'}
                  </Button>
                </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ambassador Information Dialog */}
      <Dialog open={isAmbassadorInfoDialogOpen} onOpenChange={(open) => {
        setIsAmbassadorInfoDialogOpen(open);
        if (!open) {
          setSelectedOrderAmbassador(null);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <User className="w-6 h-6 text-primary" />
              {language === 'en' ? 'Ambassador Information' : 'Informations Ambassadeur'}
            </DialogTitle>
          </DialogHeader>
          {selectedOrderAmbassador && (
            <div className="space-y-6">
              {/* Contact Information */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Contact Information' : 'Informations de Contact'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {language === 'en' ? 'Full Name' : 'Nom Complet'}
                      </Label>
                      <p className="text-sm font-semibold">{selectedOrderAmbassador.full_name}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {language === 'en' ? 'Phone' : 'Téléphone'}
                      </Label>
                      <p className="text-sm font-mono">{selectedOrderAmbassador.phone}</p>
                    </div>
                    {selectedOrderAmbassador.email && (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {language === 'en' ? 'Email' : 'Email'}
                        </Label>
                        <p className="text-sm break-all">{selectedOrderAmbassador.email}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Location Information */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Location' : 'Localisation'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {language === 'en' ? 'City' : 'Ville'}
                      </Label>
                      <p className="text-sm font-semibold">{selectedOrderAmbassador.city}</p>
                    </div>
                    {selectedOrderAmbassador.ville && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {language === 'en' ? 'Neighborhood' : 'Quartier'}
                        </Label>
                        <p className="text-sm font-semibold">{selectedOrderAmbassador.ville}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Commission Information */}
              {selectedOrderAmbassador.commission_rate !== undefined && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary" />
                      {language === 'en' ? 'Commission Details' : 'Détails de Commission'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">
                          {language === 'en' ? 'Commission Rate' : 'Taux de Commission'}
                        </Label>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-primary">
                            {selectedOrderAmbassador.commission_rate || 0}%
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {language === 'en' ? 'per order' : 'par commande'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard; 
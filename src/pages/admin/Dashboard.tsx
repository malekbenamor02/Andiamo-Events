import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import FileUpload from "@/components/ui/file-upload";
import { uploadImage, uploadHeroImage, deleteHeroImage } from "@/lib/upload";
import { captureVideoPosterFromFile } from "@/lib/video-poster-capture";
// hero-media-preprocess pulls in @ffmpeg/ffmpeg + @ffmpeg/core (multi-MB WASM).
// Load it on-demand via dynamic import so the admin bundle stays small and the
// production build is faster.
const loadHeroMediaPreprocess = () => import("@/lib/hero-media-preprocess");
import { useToast } from "@/hooks/use-toast";
import LoadingScreen from '@/components/ui/LoadingScreen';
import { supabase } from "@/integrations/supabase/client";
import { createApprovalEmail, createRejectionEmail, generatePassword, sendEmail, sendEmailWithDetails, createAdminCredentialsEmail } from "@/lib/email";
import { fetchSalesSettings, updateSalesSettings } from "@/lib/salesSettings";
import { upsertSiteContentViaApi } from "@/lib/adminSiteContent";
import { adminApi } from "@/lib/adminApi";
import { adminOrdersApi } from "@/lib/adminOrdersApi";
import {
  canAccessTabKey,
  getMobileBottomTabItems,
  getTabsForAllowed,
  labelForTab,
  resolveDefaultTab,
  LogOut as LogOutIcon,
  type AdminTabKey,
} from "@/pages/admin/adminTabRegistry";
import {
  COUNTDOWN_BANNER_SETTINGS_KEY,
  COUNTDOWN_LABEL_DEFAULT_EN,
  COUNTDOWN_LABEL_DEFAULT_FR,
  fetchCountdownBannerSettings,
  upsertCountdownBannerSettings,
} from "@/lib/countdownBannerSettings";
import {
  AMBASSADOR_SELECTION_SETTINGS_KEY,
  fetchAmbassadorSelectionSettings,
  normalizeAmbassadorSelectionSettings,
  upsertAmbassadorSelectionSettings,
  type AmbassadorNeighborhoodCity,
  type AmbassadorSelectionSettings,
} from "@/lib/ambassadorSelectionSettings";
import {
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  DollarSign,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Calendar as CalendarIcon,
  MapPin,
  Phone,
  Mail,
  User,
  Settings,
  Eye,
  EyeOff,
  Save,
  X,
  Image,
  Video,
  Upload,
  Info,
  Instagram,
  BarChart3,
  FileText,
  Building2,
  Users2,
  Briefcase,
  MessageCircle,
  PieChart,
  Download,
  RefreshCw,
  Copy,
  Wrench,
  ArrowUp,
  ArrowDown,
  Send,
  Megaphone,
  PhoneCall,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Activity,
  Database,
  Search,
  Filter,
  MoreVertical,
  ExternalLink,
  Ticket,
  TrendingDown,
  Percent,
  Target,
  Package,
  Pause,
  Zap,
  MailCheck,
  ArrowRight,
  ArrowLeft,
  Shield,
  QrCode,
  Store,
  History,
  Menu,
  Lightbulb,
  GraduationCap,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger } from "@/components/ui/drawer";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  formatDateDMY,
  fromDatetimeLocalToIso,
  getDefaultAdminDashboardEventId,
  sortEventsForAdminDashboardSelector,
} from "@/lib/date-utils";
import { isLocalhostClient } from "@/lib/localhost";
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from "@/lib/constants";
import { apiFetch, handleApiResponse } from "@/lib/api-client";
import { errorToUserMessage } from "@/lib/network-error-message";
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from "@/lib/api-routes";
import { useQueryClient } from "@tanstack/react-query";
import { useInvalidateEvents } from "@/hooks/useEvents";
import { useInvalidateSiteContent } from "@/hooks/useSiteContent";
import { logger } from "@/lib/logger";
import { logAdminAction } from "@/lib/adminLogs";
import { OfficialInvitationForm } from "@/components/admin/OfficialInvitationForm";
import { OfficialInvitationsList } from "@/components/admin/OfficialInvitationsList";
import { BulkSmsSelector } from "@/components/admin/BulkSmsSelector";
import { getSourceDisplayName } from "@/lib/phone-numbers";
import { getOrderLineRevenue, getOrderReportRevenue, getOrderTicketsAndRevenue } from "@/lib/orders/orderRevenue";
import { computeOnlinePaymentFeesDisplay } from "@/lib/onlinePaymentFee";
import type {
  AdminDashboardProps,
  AmbassadorApplication,
  Ambassador,
  Event,
  EventPass,
  PassPurchase,
  ConfirmDeleteTarget,
  HeroImage,
  AboutImage,
} from "./types";
import { OverviewTab } from "./components/OverviewTab";
import type { SuggestionReadFilter, SuggestionTypeFilter } from "./components/SuggestionsTab";
import type { MarketingTabProps } from "./components/MarketingTab";
import { peekAndConsumeAdminVerifyCache } from "@/lib/admin-verify-cache";
import { filterAmbassadorApplications } from "./lib/filterApplications";
import { exportAmbassadorApplicationsListExcel, formatInstagramLink } from "./lib/exportAmbassadorApplicationsExcel";
import {
  getAllowedVillesForCity,
  normalizeExtraVilles,
} from "@/lib/ambassadors/extraVilles";

const LazyReportsAnalytics = React.lazy(() =>
  import("@/components/admin/analytics/ReportsAnalytics").then((m) => ({ default: m.ReportsAnalytics })),
);
const LazyScannersTab = React.lazy(() =>
  import("@/components/admin/ScannersTab").then((m) => ({ default: m.ScannersTab })),
);
const LazyPosTab = React.lazy(() => import("@/components/admin/PosTab").then((m) => ({ default: m.PosTab })));
const LazyAdminsTab = React.lazy(() => import("./components/AdminsTab").then((m) => ({ default: m.AdminsTab })));
const LazyAmbassadorsTab = React.lazy(() =>
  import("./components/AmbassadorsTab").then((m) => ({ default: m.AmbassadorsTab })),
);
const LazyApplicationsTab = React.lazy(() =>
  import("./components/ApplicationsTab").then((m) => ({ default: m.ApplicationsTab })),
);
const LazyCareerTab = React.lazy(() => import("./components/CareerTab").then((m) => ({ default: m.CareerTab })));
const LazyAcademyTab = React.lazy(() => import("./components/AcademyTab").then((m) => ({ default: m.AcademyTab })));
const LazySponsorsTab = React.lazy(() =>
  import("./components/SponsorsTab").then((m) => ({ default: m.SponsorsTab })),
);
const LazyTeamTab = React.lazy(() => import("./components/TeamTab").then((m) => ({ default: m.TeamTab })));
const LazyContactTab = React.lazy(() =>
  import("./components/ContactTab").then((m) => ({ default: m.ContactTab })),
);
const LazyConsultationInquiriesTab = React.lazy(() =>
  import("./components/ConsultationInquiriesTab").then((m) => ({ default: m.ConsultationInquiriesTab })),
);
const LazySuggestionsTab = React.lazy(() =>
  import("./components/SuggestionsTab").then((m) => ({ default: m.SuggestionsTab })),
);
const LazyOfficialInvitationsTab = React.lazy(() =>
  import("./components/OfficialInvitationsTab").then((m) => ({ default: m.OfficialInvitationsTab })),
);
const LazyOnlineOrdersTab = React.lazy(() =>
  import("./components/OnlineOrdersTab").then((m) => ({ default: m.OnlineOrdersTab })),
);
const LazyLogsTab = React.lazy(() => import("./components/LogsTab").then((m) => ({ default: m.LogsTab })));
const LazyMarketingTab = React.lazy(() =>
  import("./components/MarketingTab").then((m) => ({ default: m.MarketingTab })),
) as React.LazyExoticComponent<React.ComponentType<MarketingTabProps>>;
const LazyAmbassadorSalesTab = React.lazy(() =>
  import("./components/AmbassadorSalesTab").then((m) => ({ default: m.AmbassadorSalesTab })),
);
const LazySettingsTab = React.lazy(() =>
  import("./components/SettingsTab").then((m) => ({ default: m.SettingsTab })),
);
const LazyEventsTab = React.lazy(() => import("./components/EventsTab").then((m) => ({ default: m.EventsTab })));

const adminTabSuspenseFallback = (
  <div className="space-y-4 py-6" aria-busy="true">
    <Skeleton className="h-9 w-full max-w-md" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

async function createExcelWorkbook() {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
}

async function hashPasswordBcrypt(plain: string, rounds = 10) {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(plain, rounds);
}

/** Cap payload size; overview KPIs may omit very old orders if an event exceeds this many online rows. */
const ONLINE_ORDERS_PAGE_LIMIT = 4000;
const ONLINE_ORDERS_SELECT =
  "id, created_at, updated_at, event_id, source, user_name, user_phone, user_email, city, ville, ambassador_id, quantity, total_price, total_with_fees, status, payment_status, payment_method, payment_gateway_reference, payment_confirm_response, order_number, notes, admin_notes, cancelled_at, cancellation_reason, accepted_at, completed_at, assigned_at, presale_code_id, event_promo_code_id, event_promo_codes(badge_color), payment_status_set_by, payment_status_set_at, payment_status_set_by_name, order_passes(id, order_id, pass_type, quantity, price, created_at, updated_at)";

const EVENTS_ADMIN_LIST_COLUMNS =
  "id, name, date, venue, city, description, poster_url, seating_chart_url, is_test, event_type, event_status, gallery_images, gallery_videos, presale_enabled, presale_active_from, presale_active_until, presale_hide_from_public_list, presale_pass_video_url, presale_pass_mux_playback_id, created_at, updated_at";

const APPLICATIONS_LIST_COLUMNS =
  "id, full_name, age, phone_number, email, city, ville, social_link, motivation, status, created_at, reapply_delay_date, manually_added, reviewed_by_admin_id, reviewed_at, reviewed_by_name";

/** DB columns only — `age` / `social_link` live on applications, not on `ambassadors`. */
const AMBASSADORS_LIST_COLUMNS =
  "id, full_name, phone, email, city, ville, extra_villes, status, password, created_at, updated_at";
import { AmbassadorInfoDialog } from "./components/AmbassadorInfoDialog";
import { OnlineOrderDetailsDialog } from "./components/OnlineOrderDetailsDialog";
import { OrderDetailsDialog } from "./components/OrderDetailsDialog";
import { AdminSessionCountdown } from "./components/AdminSessionCountdown";
import type { AdminSessionCountdownState } from "./components/AdminSessionCountdown";
import { AdminDashboardHeader } from "./components/AdminDashboardHeader";
import { AdminDesktopSidebarRail } from "./components/AdminDesktopSidebarRail";
import { AdminSidebarNavItem } from "./components/AdminSidebarNavItem";
import {
  AdminNotificationPanel,
  type AdminNotification,
  type AdminNotificationKind,
} from "./components/AdminNotificationPanel";

const AdminDashboard = ({ language }: AdminDashboardProps) => {
  // All hooks must be called before any conditional returns (Rules of Hooks)
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [currentAdminName, setCurrentAdminName] = useState<string | null>(null);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(null);
  const [admins, setAdmins] = useState<Array<{id: string; name: string; email: string; phone?: string; role: string; is_active: boolean; created_at: string}>>([]);
  const [isAddAdminDialogOpen, setIsAddAdminDialogOpen] = useState(false);
  const [isEditAdminDialogOpen, setIsEditAdminDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<{id: string; name: string; email: string; phone?: string; role: string; is_active: boolean} | null>(null);
  const [newAdminData, setNewAdminData] = useState({ name: '', email: '', phone: '' });
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [loadingAdminLogs, setLoadingAdminLogs] = useState(false);
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
  const [isPassManagementDialogOpen, setIsPassManagementDialogOpen] = useState(false);
  const [eventForPassManagement, setEventForPassManagement] = useState<Event | null>(null);
  const [passesForManagement, setPassesForManagement] = useState<EventPass[]>([]);
  const [selectedPassForSettings, setSelectedPassForSettings] = useState<EventPass | null>(null);
  const [isPassManagementLoading, setIsPassManagementLoading] = useState(false);
  /** Avoid repeated /api/admin/passes/:eventId calls when API errors or effects re-run. */
  const adminPassesFetchAttemptRef = React.useRef<string | null>(null);
  const passManagementFetchAttemptRef = React.useRef<string | null>(null);
  const [newPassForm, setNewPassForm] = useState<{ name: string; price: number; description: string; is_primary: boolean; max_quantity: number; allowed_payment_methods: string[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteTarget | null>(null);
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
    social_link?: string;
  }>({});

  const [sponsors, setSponsors] = useState([]);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [isSponsorDialogOpen, setIsSponsorDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sponsorToDelete, setSponsorToDelete] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  
  // Selected event for filtering dashboard data
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  // Sales settings state
  const [salesEnabled, setSalesEnabled] = useState(true);
  const [loadingSalesSettings, setLoadingSalesSettings] = useState(false);

  const [countdownBannerEnabled, setCountdownBannerEnabled] = useState(false);
  const [countdownBannerLabelEn, setCountdownBannerLabelEn] = useState(COUNTDOWN_LABEL_DEFAULT_EN);
  const [countdownBannerLabelFr, setCountdownBannerLabelFr] = useState(COUNTDOWN_LABEL_DEFAULT_FR);
  const [loadingCountdownBannerSettings, setLoadingCountdownBannerSettings] = useState(false);
  
  // Order expiration settings state
  const [expirationSettings, setExpirationSettings] = useState<Array<{
    order_status: string;
    default_expiration_hours: number;
    is_active: boolean;
  }>>([]);
  const [loadingExpirationSettings, setLoadingExpirationSettings] = useState(false);

  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [allowAmbassadorApplication, setAllowAmbassadorApplication] = useState(false);
  const [loadingMaintenanceSettings, setLoadingMaintenanceSettings] = useState(false);

  // Ambassador application settings state
  const [ambassadorApplicationEnabled, setAmbassadorApplicationEnabled] = useState(true);
  const [ambassadorApplicationMessage, setAmbassadorApplicationMessage] = useState("");
  const [loadingAmbassadorApplicationSettings, setLoadingAmbassadorApplicationSettings] = useState(false);

  const [ambassadorSelectionSettings, setAmbassadorSelectionSettings] =
    useState<AmbassadorSelectionSettings>(normalizeAmbassadorSelectionSettings({}));
  const [loadingAmbassadorSelectionSettings, setLoadingAmbassadorSelectionSettings] = useState(false);

  // Default hero typewriter texts (mirror frontend defaults so super admin can edit them)
  const defaultHeroTypewriterTexts = {
    en: [
      "EL DAHEEH LIVE SHOW FOR THE FIRST TIME IN TUNIS !!",
      "01 February 2026",
      "PALAIS DES CONGRES , TUNIS, AVENUE MOHAMED 5",
      "Ø§Ù„Ø¯Ø­ÙŠØ­ ÙÙŠ ØªÙˆÙ†Ø³",
    ],
    fr: [
      "EL DAHEEH LIVE SHOW FOR THE FIRST TIME IN TUNIS !!",
      "01 February 2026",
      "PALAIS DES CONGRES , TUNIS, AVENUE MOHAMED 5",
      "Ø§Ù„Ø¯Ø­ÙŠØ­ ÙÙŠ ØªÙˆÙ†Ø³",
    ],
  };

  // Hero section state (images + typewriter texts)
  const [heroImages, setHeroImages] = useState<HeroImage[]>([]);
  const [loadingHeroImages, setLoadingHeroImages] = useState(false);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [heroTypewriterTexts, setHeroTypewriterTexts] = useState<{ en: string[]; fr: string[] }>({
    en: defaultHeroTypewriterTexts.en,
    fr: defaultHeroTypewriterTexts.fr,
  });

  // About images state
  const [aboutImages, setAboutImages] = useState<AboutImage[]>([]);
  const [loadingAboutImages, setLoadingAboutImages] = useState(false);
  const [uploadingAboutImage, setUploadingAboutImage] = useState(false);

  // Marketing/SMS state
  const [phoneSubscribers, setPhoneSubscribers] = useState<Array<{id: string; phone_number: string; subscribed_at: string; city?: string; import_label?: string | null}>>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [importingFromApplications, setImportingFromApplications] = useState(false);
  
  // Broadcast mode (popup subscribers only)
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [importingPhones, setImportingPhones] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [phoneImportLabel, setPhoneImportLabel] = useState("");
  const [phoneImportFile, setPhoneImportFile] = useState<File | null>(null);
  
  // Targeted mode (ambassador applications)
  const [targetedMessage, setTargetedMessage] = useState("");
  const [targetedCity, setTargetedCity] = useState<string>('');
  const [targetedCount, setTargetedCount] = useState<number>(0);
  const [loadingTargetedCount, setLoadingTargetedCount] = useState(false);
  const [sendingTargeted, setSendingTargeted] = useState(false);
  // Test SMS state
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testSmsMessage, setTestSmsMessage] = useState("");
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkPhonesInput, setBulkPhonesInput] = useState("");
  const [addingBulkPhones, setAddingBulkPhones] = useState(false);
  const [smsBalance, setSmsBalance] = useState<any>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [smsLogs, setSmsLogs] = useState<Array<{id: string; phone_number: string; message: string; status: string; error_message?: string; sent_at?: string; created_at: string; api_response?: any; source?: string; campaign_name?: string}>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [siteLogs, setSiteLogs] = useState<Array<{id: string; log_type: string; category: string; message: string; details: any; user_type: string; created_at: string}>>([]);
  const [loadingSiteLogs, setLoadingSiteLogs] = useState(false);
  
  // Email Marketing state
  const [marketingSubTab, setMarketingSubTab] = useState<'sms' | 'email'>('sms');
  const [emailSubscribers, setEmailSubscribers] = useState<Array<{id: string; email: string; subscribed_at: string; language?: string; import_label?: string | null}>>([]);
  const [loadingEmailSubscribers, setLoadingEmailSubscribers] = useState(false);
  const [importingEmails, setImportingEmails] = useState(false);
  const [showEmailImportDialog, setShowEmailImportDialog] = useState(false);
  const [emailImportLabel, setEmailImportLabel] = useState("");
  const [emailImportFile, setEmailImportFile] = useState<File | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [sendingBulkEmails, setSendingBulkEmails] = useState(false);
  const [emailDelaySeconds, setEmailDelaySeconds] = useState<number>(2); // Delay between emails in seconds
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  // New comprehensive logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingComprehensiveLogs, setLoadingComprehensiveLogs] = useState(false);
  const [logsPagination, setLogsPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });
  const [logsFilters, setLogsFilters] = useState({
    type: [] as string[],
    category: '',
    userRole: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    search: '',
    sortBy: 'time' as 'time' | 'type',
    order: 'desc' as 'asc' | 'desc'
  });
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [cspReports, setCspReports] = useState<any[]>([]);
  const [loadingCspReports, setLoadingCspReports] = useState(false);
  
  // --- Team Members State ---
  const [teamMembers, setTeamMembers] = useState([]);
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isDeleteTeamDialogOpen, setIsDeleteTeamDialogOpen] = useState(false);
  const [teamMemberToDelete, setTeamMemberToDelete] = useState(null);

  const [applicationSearchTerm, setApplicationSearchTerm] = useState('');
  const [applicationDateFrom, setApplicationDateFrom] = useState<Date | undefined>(undefined);
  const [applicationDateTo, setApplicationDateTo] = useState<Date | undefined>(undefined);
  const [applicationCityFilter, setApplicationCityFilter] = useState<string>('all');
  const [applicationVilleFilter, setApplicationVilleFilter] = useState<string>('all');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<string>('pending');
  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [messageToDelete, setMessageToDelete] = useState<any>(null);
  const [isDeleteMessageDialogOpen, setIsDeleteMessageDialogOpen] = useState(false);
  const [contactMessageSearchTerm, setContactMessageSearchTerm] = useState('');
  const [consultationInquiries, setConsultationInquiries] = useState<any[]>([]);
  const [consultationInquirySearchTerm, setConsultationInquirySearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionSearchTerm, setSuggestionSearchTerm] = useState('');
  const [suggestionReadFilter, setSuggestionReadFilter] = useState<SuggestionReadFilter>('all');
  const [suggestionTypeFilter, setSuggestionTypeFilter] = useState<SuggestionTypeFilter>('all');
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [suggestionToDelete, setSuggestionToDelete] = useState<any>(null);
  const [isDeleteSuggestionDialogOpen, setIsDeleteSuggestionDialogOpen] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
            const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
            const [editingTicket, setEditingTicket] = useState<any>(null);
            const [isDeleteTicketDialogOpen, setIsDeleteTicketDialogOpen] = useState(false);
            const [ticketToDelete, setTicketToDelete] = useState<any>(null);
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
  const [pendingAmbassadorOrdersCount, setPendingAmbassadorOrdersCount] = useState<number>(0);
  const [previousPendingAmbassadorOrdersCount, setPreviousPendingAmbassadorOrdersCount] = useState<number | null>(null);
  const [filteredCodOrders, setFilteredCodOrders] = useState<any[]>([]);
  const [orderFilters, setOrderFilters] = useState({
    status: '',
    phone: '',
    ambassador: '',
    city: '',
    ville: '',
    orderId: '',
    passType: '',
  });
  const [allAmbassadorOrders, setAllAmbassadorOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOrderAmbassador, setSelectedOrderAmbassador] = useState<any>(null);
  const [emailDeliveryLogs, setEmailDeliveryLogs] = useState<any[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [isMotivationDialogOpen, setIsMotivationDialogOpen] = useState(false);
  const [selectedMotivation, setSelectedMotivation] = useState<{application: AmbassadorApplication; motivation: string} | null>(null);
  const [orderLogs, setOrderLogs] = useState<any[]>([]);
  const [salesSystemTab, setSalesSystemTab] = useState('cod-ambassador-orders');
  
  const [resendingTicketEmail, setResendingTicketEmail] = useState(false);
  const [bulkAmbassadorProcessing, setBulkAmbassadorProcessing] = useState(false);

  // Export COD Ambassador Orders to Excel
  const exportOrdersToExcel = async () => {
    try {
      const workbook = await createExcelWorkbook();
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
        }

        // Format dates
        const createdDate = order.created_at ? new Date(order.created_at) : null;
        const updatedDate = order.updated_at ? new Date(order.updated_at) : null;
        const cancelledDate = order.cancelled_at ? new Date(order.cancelled_at) : null;
        const acceptedDate = order.accepted_at ? new Date(order.accepted_at) : null;
        const completedDate = order.completed_at ? new Date(order.completed_at) : null;

        // Format status text
        const statusText = order.status === 'PENDING_CASH'
          ? (language === 'en' ? 'Pending Cash' : 'En attente espèces')
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
          : order.status === 'REMOVED_BY_ADMIN'
          ? (language === 'en' ? 'Removed by Admin' : "Retiré par l'administrateur")
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
        title: language === 'en' ? 'Export Successful' : 'Export réussi',
        description: language === 'en' 
          ? `${codAmbassadorOrders.length} orders exported to ${filename}`
          : `${codAmbassadorOrders.length} commandes exportées vers ${filename}`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error exporting orders:', error);
      toast({
        title: language === 'en' ? 'Export Failed' : "Échec de l'export",
        description: language === 'en' 
          ? 'Failed to export orders. Please try again.'
          : "Échec de l'exportation des commandes. Veuillez réessayer.",
        variant: 'destructive',
      });
    }
  };

  const handleViewAmbassador = async (ambassadorId: string) => {
    const { data: ambassadorData } = await (supabase as any)
      .from('ambassadors')
      .select('*')
      .eq('id', ambassadorId)
      .single();
    setSelectedOrderAmbassador(ambassadorData);
    setIsAmbassadorInfoDialogOpen(true);
  };

  // Get unique filter values from orders
  const filterOptions = useMemo(() => {
    const ambassadors = new Set<string>();
    const passTypes = new Set<string>();

    codAmbassadorOrders.forEach(order => {
      if (order.ambassador_name) {
        ambassadors.add(order.ambassador_name);
      }
      // Extract pass types from passes array
      if (order.passes && Array.isArray(order.passes)) {
        order.passes.forEach((pass: any) => {
          const passType = pass.pass_type || pass.passName;
          if (passType) {
            passTypes.add(passType);
          }
        });
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
      // Use localeCompare for consistent alphabetical ordering (case/accents-insensitive)
      ambassadors: Array.from(ambassadors).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
      // Keep pass types alphabetical as well
      passTypes: Array.from(passTypes).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
      cities: CITIES,
      getAllVilles,
    };
  }, [codAmbassadorOrders]);


  // Filter COD orders based on filter criteria
  useEffect(() => {
    // Enable text selection for Admin Dashboard (also covers portal-based dialogs)
    document.body.dataset.adminDashboard = "true";
    return () => {
      delete document.body.dataset.adminDashboard;
    };
  }, []);

  // Filter COD orders based on filter criteria
  useEffect(() => {
    let filtered = [...codAmbassadorOrders];

    // Status filter is already applied at API level, but we still need to filter here
    // in case other filters are applied after status filter
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

    if (orderFilters.orderId) {
      const orderIdSearch = orderFilters.orderId.trim().toUpperCase();
      filtered = filtered.filter(order => {
        // Filter by order_number from database (numeric values like 518954, 907756, etc.)
        if (order.order_number != null) {
          const orderNumberStr = order.order_number.toString().toUpperCase();
          return orderNumberStr.includes(orderIdSearch);
        }
        return false;
      });
    }

    if (orderFilters.passType) {
      filtered = filtered.filter(order => {
        // Check if order has passes array with the selected pass type
        if (order.passes && Array.isArray(order.passes)) {
          return order.passes.some((pass: any) => {
            const passType = pass.pass_type || pass.passName;
            return passType === orderFilters.passType;
          });
        }
        return false;
      });
    }

    setFilteredCodOrders(filtered);
  }, [codAmbassadorOrders, orderFilters]);

  // Calculate total count of selected pass type
  const selectedPassTypeTotal = useMemo(() => {
    if (!orderFilters.passType) return 0;
    
    return filteredCodOrders.reduce((total, order) => {
      if (order.passes && Array.isArray(order.passes)) {
        const matchingPass = order.passes.find((pass: any) => {
          const passType = pass.pass_type || pass.passName;
          return passType === orderFilters.passType;
        });
        if (matchingPass) {
          return total + (matchingPass.quantity || 0);
        }
      }
      return total;
    }, 0);
  }, [filteredCodOrders, orderFilters.passType]);

  const [onlineOrdersForChart, setOnlineOrdersForChart] = useState<any[]>([]);

  // Activity chart: last 7 days with Applications, Orders (ambassador + online), Revenue, Events created, Approved (per day)
  const activityChartData = useMemo(() => {
    const out: { name: string; applications: number; approved: number; orders: number; revenue: number; eventsCreated: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLabel = format(d, 'EEE');
      const appCount = applications.filter((a: { created_at?: string }) => format(new Date(a.created_at || 0), 'yyyy-MM-dd') === dateStr).length;
      const approvedCount = applications.filter((a: { created_at?: string; status?: string }) => a.status === 'approved' && format(new Date(a.created_at || 0), 'yyyy-MM-dd') === dateStr).length;
      const dayAmbassador = codAmbassadorOrders.filter((o: { created_at?: string }) => format(new Date(o.created_at || 0), 'yyyy-MM-dd') === dateStr);
      const dayOnline = onlineOrdersForChart.filter((o: { created_at?: string }) => format(new Date(o.created_at || 0), 'yyyy-MM-dd') === dateStr);
      const ambassadorRevenue = dayAmbassador
        .filter((o: any) => ['PAID', 'COMPLETED'].includes(o.status))
        .reduce((s: number, o: any) => s + getOrderLineRevenue(o), 0);
      const chartOnlinePaid = (o: any) =>
        o.payment_status === 'PAID' || o.status === 'PAID' || o.status === 'COMPLETED';
      const onlineRevenue = dayOnline
        .filter((o: any) => chartOnlinePaid(o))
        .reduce((s: number, o: any) => s + getOrderReportRevenue(o), 0);
      const eventsCount = events.filter((ev: { created_at?: string }) => format(new Date(ev.created_at || 0), 'yyyy-MM-dd') === dateStr).length;
      out.push({
        name: dayLabel,
        applications: appCount,
        approved: approvedCount,
        orders: dayAmbassador.length + dayOnline.length,
        revenue: Math.round(ambassadorRevenue + onlineRevenue),
        eventsCreated: eventsCount,
      });
    }
    return out;
  }, [applications, codAmbassadorOrders, onlineOrdersForChart, events]);

  /**
   * Header event selector: all events. Test events (`is_test`) only on localhost / local dev — same as public listings.
   */
  const selectableDashboardEvents = useMemo(() => {
    const showTest = isLocalhostClient();
    const filtered = events.filter((e) => {
      if (!showTest && e.is_test === true) return false;
      return true;
    });
    return sortEventsForAdminDashboardSelector(filtered);
  }, [events]);

  const [loadingOrders, setLoadingOrders] = useState(false);

  // Online Orders state
  const [onlineOrders, setOnlineOrders] = useState<any[]>([]);
  const [selectedOnlineOrder, setSelectedOnlineOrder] = useState<any>(null);
  const [isOnlineOrderDetailsOpen, setIsOnlineOrderDetailsOpen] = useState(false);
  const [loadingOnlineOrders, setLoadingOnlineOrders] = useState(false);
  const [onlineOrdersRealtimeKey, setOnlineOrdersRealtimeKey] = useState(0);
  const fetchOnlineOrdersLatestRef = useRef<(() => Promise<void>) | null>(null);
  const onlineOrdersRealtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onlineOrderFilters, setOnlineOrderFilters] = useState({
    orderId: '',
    status: 'all',
    phone: '',
    passType: 'all',
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    city: 'all',
  });

  /**
   * POS orders for overview KPIs (super_admin only). Loaded via Supabase like online/ambassador
   * so production totals match the dashboard event filter without a separate API round-trip.
   */
  const [posOrdersForOverview, setPosOrdersForOverview] = useState<any[]>([]);

  // Dashboard overview stats: paid revenue + sold tickets for online + ambassador; super_admin also includes POS (paid + pending revenue; paid tickets only)
  const dashboardOrderStats = useMemo(() => {
    const PAID_AMB = ['PAID', 'COMPLETED'];
    const PENDING_AMB = ['PENDING_CASH', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION', 'APPROVED'];
    const isOnlinePaid = (o: any) =>
      o.payment_status === 'PAID' || o.status === 'PAID' || o.status === 'COMPLETED';
    const isOnlinePendingRevenue = (o: any) => {
      if (o.status === 'REMOVED_BY_ADMIN') return false;
      if (isOnlinePaid(o)) return false;
      const terminal = new Set([
        'CANCELLED',
        'CANCELLED_BY_ADMIN',
        'CANCELLED_BY_AMBASSADOR',
        'REJECTED',
        'FAILED',
      ]);
      if (terminal.has(o.status)) return false;
      if (o.payment_status === 'FAILED' || o.payment_status === 'REFUNDED') return false;
      return (
        o.status === 'PENDING_ONLINE' ||
        o.status === 'REDIRECTED' ||
        o.payment_status === 'PENDING_PAYMENT' ||
        o.payment_status == null
      );
    };

    // Ambassador orders (already filtered by selected event when fetched) — paid = collected cash only
    const ambPaid = codAmbassadorOrders.filter((o: any) => PAID_AMB.includes(o.status));
    const ambPending = codAmbassadorOrders.filter((o: any) => PENDING_AMB.includes(o.status));
    const ambPaidRevenue = ambPaid.reduce((s, o) => s + getOrderLineRevenue(o), 0);
    const ambPendingRevenue = ambPending.reduce((s, o) => s + getOrderLineRevenue(o), 0);
    const ambSoldTickets = ambPaid.reduce((s, o) => s + getOrderTicketsAndRevenue(o).tickets, 0);

    // Online: align with Reports (line-item revenue + same “paid” rules as status / payment_status)
    const onlinePaid = onlineOrders.filter((o: any) => isOnlinePaid(o));
    const onlinePending = onlineOrders.filter((o: any) => isOnlinePendingRevenue(o));
    const onlinePaidRevenue = onlinePaid.reduce((s, o) => s + getOrderReportRevenue(o), 0);
    const onlinePendingRevenue = onlinePending.reduce((s, o) => s + getOrderLineRevenue(o), 0);
    const onlineSoldTickets = onlinePaid.reduce((s, o) => s + getOrderTicketsAndRevenue(o).tickets, 0);

    let paidRevenue = ambPaidRevenue + onlinePaidRevenue;
    let pendingRevenue = ambPendingRevenue + onlinePendingRevenue;
    let soldTickets = ambSoldTickets + onlineSoldTickets;

    if (currentAdminRole === "super_admin") {
      const posPaid = posOrdersForOverview.filter((o: any) =>
        o.status === "PAID" || o.status === "COMPLETED",
      );
      const posPending = posOrdersForOverview.filter(
        (o: any) => o.status === "PENDING_ADMIN_APPROVAL",
      );
      paidRevenue += posPaid.reduce((s, o) => s + getOrderLineRevenue(o), 0);
      pendingRevenue += posPending.reduce((s, o) => s + getOrderLineRevenue(o), 0);
      soldTickets += posPaid.reduce((s, o) => s + getOrderTicketsAndRevenue(o).tickets, 0);
    }

    return {
      totalRevenue: paidRevenue + pendingRevenue,
      paidRevenue,
      pendingRevenue,
      soldTickets,
    };
  }, [codAmbassadorOrders, onlineOrders, currentAdminRole, posOrdersForOverview]);

  const fetchPosOrdersForOverview = useCallback(
    async (opts?: { isStale?: () => boolean }) => {
      const stale = () => opts?.isStale?.() === true;
      if (currentAdminRole !== "super_admin" || !selectedEventId) {
        if (!stale()) setPosOrdersForOverview([]);
        return;
      }
      try {
        const result = await adminOrdersApi.posOverviewOrders(selectedEventId);
        if (!stale()) setPosOrdersForOverview(result.data || []);
      } catch (e) {
        console.warn("POS overview orders fetch failed:", e);
        if (!stale()) setPosOrdersForOverview([]);
      }
    },
    [currentAdminRole, selectedEventId],
  );

  useEffect(() => {
    let alive = true;
    void fetchPosOrdersForOverview({ isStale: () => !alive });
    return () => {
      alive = false;
    };
  }, [fetchPosOrdersForOverview]);

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

  // Session countdown lives in AdminSessionCountdown so 1s ticks do not re-render this page.
  const [sessionCountdown, setSessionCountdown] = useState<AdminSessionCountdownState>(null);

  // Realtime notification center state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem(
        "adminNotificationSoundEnabled",
      );
      if (stored === null) return true;
      return stored === "true";
    } catch {
      return true;
    }
  });

  const canAccessTab = useCallback(
    (tab: string) => canAccessTabKey(allowedTabs, tab),
    [allowedTabs]
  );

  const isSuperAdmin = useMemo(
    () => adminPermissions.includes('*') || currentAdminRole === 'super_admin',
    [adminPermissions, currentAdminRole]
  );

  const allowedTabItems = useMemo(() => getTabsForAllowed(allowedTabs), [allowedTabs]);

  const playNotificationSound = () => {
    if (typeof window === "undefined") return;
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0.6;
      audio.onerror = () => {
        playNotificationBeepFallback();
      };
      audio.play().catch(() => {
        playNotificationBeepFallback();
      });
    } catch {
      playNotificationBeepFallback();
    }
  };

  const playNotificationBeepFallback = () => {
    if (typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  };

  const showBrowserNotification = (title: string, body: string) => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    try {
      if (Notification.permission === "granted") {
        const n = new Notification(title, {
          body,
          icon: "/assets/faviconn.png",
          badge: "/assets/faviconn.png",
        });
        n.onerror = () => {};
      } else if (Notification.permission === "default") {
        Notification.requestPermission()
          .then((perm) => {
            if (perm === "granted") {
              const n = new Notification(title, {
                body,
                icon: "/assets/faviconn.png",
                badge: "/assets/faviconn.png",
              });
              n.onerror = () => {};
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore notification errors
    }
  };

  const getOrderBuyerName = (order: any, lang: "en" | "fr") => {
    return (
      order.user_name ||
      order.customer_name ||
      order.user_full_name ||
      (lang === "en" ? "Unknown buyer" : "Client inconnu")
    );
  };

  const buildOrderNotificationSummary = (order: any, lang: "en" | "fr") => {
    const buyerName = getOrderBuyerName(order, lang);
    let passesText = "";
    let total: number | null =
      typeof order.total_with_fees === "number"
        ? order.total_with_fees
        : typeof order.total_price === "number"
          ? order.total_price
          : null;

    let passes: any[] = [];

    let feesFromNotes: { subtotal?: number; total_with_fees?: number } | null = null;

    if (order.notes) {
      try {
        const notesData =
          typeof order.notes === "string"
            ? JSON.parse(order.notes)
            : order.notes;
        if (Array.isArray(notesData?.all_passes)) {
          passes = notesData.all_passes;
        }
        if (notesData?.payment_fees) {
          const f = notesData.payment_fees;
          feesFromNotes = {
            subtotal:
              typeof f.subtotal === "number" ? f.subtotal : undefined,
            total_with_fees:
              typeof f.total_with_fees === "number"
                ? f.total_with_fees
                : undefined,
          };
        }
      } catch {
        // ignore parse errors
      }
    }

    if (Array.isArray(order.order_passes) && order.order_passes.length > 0) {
      passes = order.order_passes;
    }

    if (passes.length > 0) {
      passesText = passes
        .map((p: any) => {
          const label =
            p.name ||
            p.passName ||
            p.pass_type ||
            (lang === "en" ? "Pass" : "Pass");
          const qty = p.quantity || 0;
          return `${String(label)} x${qty}`;
        })
        .join(", ");
      const subtotalFromPasses = passes.reduce(
        (sum: number, p: any) =>
          sum + (Number(p.price) || 0) * (p.quantity || 0),
        0,
      );
      if (feesFromNotes?.total_with_fees != null) {
        total = feesFromNotes.total_with_fees;
      } else if (order.payment_method === "online") {
        // Ensure notifications show fee-inclusive total (matches ONLINE_PAYMENT_FEE_RATE / VITE_).
        total = Number(
          computeOnlinePaymentFeesDisplay(subtotalFromPasses).totalWithFees.toFixed(2),
        );
      } else if (total == null) {
        total = subtotalFromPasses;
      }
    }

    const totalText =
      typeof total === "number" ? `${total.toFixed(2)} TND` : "";

    return totalText
      ? `${buyerName} — ${passesText} • Total ${totalText}`
      : `${buyerName} — ${passesText}`;
  };

  const pushNotification = (payload: {
    kind: AdminNotificationKind;
    title: string;
    message: string;
  }) => {
    const notification: AdminNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...payload,
    };
    setNotifications((prev) => [notification, ...prev].slice(0, 50));
    setUnreadNotifications((prev) => prev + 1);
    if (soundEnabled) {
      playNotificationSound();
    }
    showBrowserNotification(notification.title, notification.message);
  };


  const content = {
    en: {
      title: "Admin dashboard",
      subtitle: "Events, ambassadors, and applications",
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
      eventSeatingChart: "Seating plan (optional)",
      eventSeatingChartHint: "Shown on the pass purchase page. Leave empty to hide the seating section.",
      eventInstagramLink: "Instagram Link",
      eventFeatured: "Featured Event",
      eventStandardPrice: "Standard Price (TND)",
      eventVipPrice: "VIP Price (TND)",
      eventType: "Event Type",
      eventTypeUpcoming: "Upcoming Event",
      eventTypeGallery: "Gallery Event (Past Event)",
      eventStatus: "Event status",
      eventStatusActive: "Active",
      eventStatusCompleted: "Completed",
      eventStatusCancelled: "Cancelled",
      eventStatusCompletedHint: "",
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
      ambassadorOrdersPending: "Ambassador Orders Pending",
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
      salesSettingsDescription: "",
      maintenanceSettings: "Maintenance Mode",
      enableMaintenance: "Enable Maintenance Mode",
      disableMaintenance: "Disable Maintenance Mode",
      maintenanceEnabled: "Maintenance mode is currently active",
      maintenanceDisabled: "Maintenance mode is currently inactive",
      maintenanceSettingsDescription: "",
      maintenanceMessage: "Maintenance Message",
      maintenanceMessagePlaceholder: "Enter a custom maintenance message (optional)",
      allowAmbassadorApplication: "Allow Ambassador Application Page",
      allowAmbassadorApplicationDescription: "When enabled, the ambassador application page will remain accessible during maintenance mode.",
      ambassadorApplicationSettings: "Ambassador Application Settings",
      ambassadorApplicationSettingsDescription: "",
      ambassadorApplicationEnabled: "Applications are currently open",
      ambassadorApplicationDisabled: "Applications are currently closed",
      enableAmbassadorApplication: "Enable Applications",
      disableAmbassadorApplication: "Disable Applications",
      ambassadorApplicationMessage: "Application Closed Message",
      ambassadorApplicationMessagePlaceholder: "Enter a custom message for when applications are closed (optional)",
      ambassadorSelectionSettings: "Ambassador Selection",
      heroImagesSettings: "Hero Images & Videos",
      heroImagesSettingsDescription: "",
      uploadHeroImage: "Upload",
      deleteHeroImage: "Delete",
      noHeroImages: "No hero media yet. Upload an image or video to get started.",
      heroImageAlt: "Image Alt Text",
      reorderImages: "Reorder by dragging"
    },
    fr: {
      title: "Tableau de bord",
      subtitle: "Événements, ambassadeurs et candidatures",
      overview: "Aperçu",
      events: "Événements",
      ambassadors: "Ambassadeurs",
      applications: "Candidatures",
      pendingApplications: "Candidatures en Attente",
      approvedApplications: "Candidatures approuvées",
      totalEvents: "Total événements",
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
      emailSent: "E-mail de notification envoyé",
      error: "Une erreur s'est produite",
      logout: "Déconnexion",
      eventName: "Nom de l'événement",
      eventDate: "Date de l'événement",
      eventVenue: "Lieu",
      eventCity: "Ville",
      eventDescription: "Description",
      eventPoster: "URL de l'Affiche",
      eventSeatingChart: "Plan de salle (optionnel)",
      eventSeatingChartHint: "Affiché sur la page d'achat de passes. Laissez vide pour masquer la section.",
      eventInstagramLink: "Lien Instagram",
      eventFeatured: "Événement en vedette",
      eventStandardPrice: "Prix Standard (TND)",
      eventVipPrice: "Prix VIP (TND)",
      eventType: "Type d'événement",
      eventTypeUpcoming: "Événement à venir",
      eventTypeGallery: "Événement galerie (événement passé)",
      eventStatus: "Statut de l'événement",
      eventStatusActive: "Actif — vente de passes ouverte",
      eventStatusCompleted: "Terminé — ventes fermées, page galerie",
      eventStatusCancelled: "Annulé",
      eventStatusCompletedHint:
        "Ferme l'achat de passes et le bouton Réserver. L'événement devient une page galerie : ajoutez photos, vidéos et texte ci-dessous (enregistrez puis modifiez à nouveau pour téléverser si besoin).",
      galleryImages: "Images de Galerie",
      galleryVideos: "Vidéos de galerie",
      uploadGalleryFiles: "Téléverser des fichiers de galerie",
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
      ambassadorOrdersPending: "Commandes Ambassadeurs en Attente",
      passPurchases: "Achats de Passes",
      totalPurchases: "Total des Achats",
      purchaseDetails: "Détails de l'achat",
      customerInfo: "Informations Client",
      purchaseStatus: "Statut de l'Achat",
      noPurchases: "Aucun achat trouvé",
      settings: "Paramètres",
      salesSettings: "Paramètres de ventes",
      enableSales: "Activer les Ventes",
      disableSales: "Désactiver les ventes",
      salesEnabled: "Les ventes sont actuellement activées",
      salesDisabled: "Les ventes sont actuellement désactivées",
      salesSettingsDescription:
        "Contrôlez si les ambassadeurs peuvent ajouter des ventes. Lorsqu'elle est désactivée, les ambassadeurs verront un message indiquant que les ventes ne sont pas encore ouvertes.",
      maintenanceSettings: "Mode Maintenance",
      enableMaintenance: "Activer le Mode Maintenance",
      disableMaintenance: "Désactiver le mode maintenance",
      maintenanceEnabled: "Le mode maintenance est actuellement actif",
      maintenanceDisabled: "Le mode maintenance est actuellement inactif",
      maintenanceSettingsDescription:
        "Contrôlez le mode maintenance du site web. Lorsqu'il est activé, les utilisateurs verront un message de maintenance et ne pourront pas accéder au site. L'accès administrateur est toujours autorisé.",
      maintenanceMessage: "Message de Maintenance",
      maintenanceMessagePlaceholder: "Entrez un message de maintenance personnalisé (optionnel)",
      allowAmbassadorApplication: "Autoriser la Page de Candidature d'Ambassadeur",
      allowAmbassadorApplicationDescription:
        "Lorsqu'elle est activée, la page de candidature d'ambassadeur restera accessible pendant le mode maintenance.",
      ambassadorApplicationSettings: "Paramètres de candidature d'ambassadeur",
      ambassadorApplicationSettingsDescription:
        "Contrôlez si les utilisateurs peuvent soumettre des candidatures d'ambassadeur. Lorsqu'elle est désactivée, les utilisateurs verront un message indiquant que les candidatures sont fermées.",
      ambassadorApplicationEnabled: "Les candidatures sont actuellement ouvertes",
      ambassadorApplicationDisabled: "Les candidatures sont actuellement fermées",
      enableAmbassadorApplication: "Ouvrir les Candidatures",
      disableAmbassadorApplication: "Fermer les Candidatures",
      ambassadorApplicationMessage: "Message de candidature fermée",
      ambassadorApplicationMessagePlaceholder:
        "Entrez un message personnalisé lorsque les candidatures sont fermées (optionnel)",
      ambassadorSelectionSettings: "Sélection ambassadeur",
      heroImagesSettings: "Images et vidéos hero",
      heroImagesSettingsDescription:
        "Gérez les images et vidéos hero affichées sur la page d'accueil. Vous pouvez ajouter, supprimer et réorganiser les fichiers multimédias.",
      uploadHeroImage: "Téléverser une image ou vidéo hero",
      deleteHeroImage: "Supprimer",
      noHeroImages: "Aucun média hero pour le moment. Téléversez une image ou une vidéo pour commencer.",
      heroImageAlt: "Texte Alternatif de l'Image",
      reorderImages: "Réorganiser en faisant glisser"
    }
  };

  const t = content[language];

  useEffect(() => {
    fetchAllData();
  }, []);

  // Request browser notification permission as soon as dashboard loads so notifications
  // work when the tab is in background or minimized (realtime still runs, we show Notification + sound).
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Realtime: keep applications in sync without refresh
  useEffect(() => {
    const channel = supabase
      .channel('admin-ambassador-applications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ambassador_applications',
        },
        (payload) => {
          const eventType = payload.eventType;
          const newRecord = payload.new as Record<string, unknown> | null;
          const oldRecord = payload.old as Record<string, unknown> | null;

          if (eventType === 'INSERT' && newRecord?.id) {
            const asApp = newRecord as unknown as AmbassadorApplication;
            setApplications((prev) => {
              if (prev.some((a) => a.id === asApp.id)) return prev;
              return [asApp, ...prev].sort(
                (a, b) =>
                  new Date(b.created_at || 0).getTime() -
                  new Date(a.created_at || 0).getTime()
              );
            });
            // New ambassador application notification
            const cityVille = [asApp.city, asApp.ville].filter(Boolean).join(" / ");
            pushNotification({
              kind: "ambassador_application",
              title:
                language === "en"
                  ? "Ambassador application"
                  : "Candidature ambassadeur",
              message: cityVille
                ? `${asApp.full_name} — ${cityVille}`
                : asApp.full_name,
            });
          } else if (eventType === 'UPDATE' && newRecord?.id) {
            setApplications((prev) =>
              prev.map((app) =>
                app.id === newRecord.id
                  ? (newRecord as unknown as AmbassadorApplication)
                  : app
              )
            );
          } else if (eventType === 'DELETE' && oldRecord?.id) {
            setApplications((prev) =>
              prev.filter((app) => app.id !== oldRecord.id)
            );
          }
        }
      )
      .subscribe((_status) => {
        // CHANNEL_ERROR is common (tab background, network blip); Supabase reconnects. Don't log as error.
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [language]);

  // Orders realtime disabled (RLS Wave B): refresh after mutations and on event change.
  // Tradeoff: no live INSERT notifications; lower risk than anon realtime on privileged table.

  // Realtime: career applications — notify so admin gets alerts even when not on Career tab
  useEffect(() => {
    const channel = supabase
      .channel("admin-career-applications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "career_applications",
        },
        () => {
          pushNotification({
            kind: "career_application",
            title:
              language === "en"
                ? "New career application"
                : "Nouvelle candidature",
            message:
              language === "en"
                ? "A new career application has been submitted."
                : "Une nouvelle candidature a été envoyée.",
          });
        }
      )
      .subscribe((_status) => {
        // CHANNEL_ERROR is common (tab background, network blip); Supabase reconnects. Don't log as error.
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [language]);

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
  const filteredApplications = useMemo(
    () =>
      filterAmbassadorApplications(applications, {
        searchTerm: applicationSearchTerm,
        statusFilter: applicationStatusFilter,
        cityFilter: applicationCityFilter,
        villeFilter: applicationVilleFilter,
        dateFrom: applicationDateFrom,
        dateTo: applicationDateTo,
        ambassadorMap,
      }),
    [
      applications,
      applicationStatusFilter,
      applicationCityFilter,
      applicationVilleFilter,
      applicationSearchTerm,
      applicationDateFrom,
      applicationDateTo,
      ambassadorMap,
    ],
  );

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

  const filteredConsultationInquiries = consultationInquiries.filter((inquiry) => {
    const searchLower = consultationInquirySearchTerm.toLowerCase().trim();
    if (!searchLower) return true;
    return [
      inquiry.full_name,
      inquiry.company,
      inquiry.service,
      inquiry.vision,
      inquiry.contact_email,
      inquiry.contact_phone,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(searchLower));
  });

  // Filter suggestions by search, read status, and type
  const filteredSuggestions = suggestions.filter(s => {
    const searchLower = suggestionSearchTerm.toLowerCase();
    const matchesSearch = !suggestionSearchTerm || (
      (s.title || '').toLowerCase().includes(searchLower) ||
      (s.details || '').toLowerCase().includes(searchLower) ||
      (s.email || '').toLowerCase().includes(searchLower) ||
      (s.suggestion_type || '').toLowerCase().includes(searchLower)
    );
    const matchesRead = suggestionReadFilter === 'all' ||
      (suggestionReadFilter === 'read' && s.read_at) ||
      (suggestionReadFilter === 'unread' && !s.read_at);
    const matchesType = suggestionTypeFilter === 'all' || s.suggestion_type === suggestionTypeFilter;
    return matchesSearch && matchesRead && matchesType;
  });

  // Load marketing/SMS/email subscriber data when Marketing tab is opened
  useEffect(() => {
    if (activeTab === "marketing") {
      if (phoneSubscribers.length === 0) {
        fetchPhoneSubscribers();
      }
      if (smsLogs.length === 0) {
        fetchSmsLogs();
      }
      if (marketingSubTab === 'email' && emailSubscribers.length === 0) {
        fetchEmailSubscribers();
      }
    }
  }, [activeTab, marketingSubTab, phoneSubscribers.length, smsLogs.length, emailSubscribers.length]);

  useLayoutEffect(() => {
    if (selectableDashboardEvents.length === 0) {
      if (selectedEventId) setSelectedEventId("");
      return;
    }
    if (
      !selectedEventId ||
      !selectableDashboardEvents.some((e) => e.id === selectedEventId)
    ) {
      setSelectedEventId(
        getDefaultAdminDashboardEventId(selectableDashboardEvents)
      );
    }
  }, [selectableDashboardEvents, selectedEventId]);

  /** One source of truth: changing the header event reloads ambassador + online data and the overview activity chart for that event. */
  useEffect(() => {
    if (!selectedEventId) return;

    void fetchAmbassadorSalesData();
    void fetchOnlineOrders();

    (async () => {
      try {
        const result = await adminOrdersApi.chartOnlineOrders(selectedEventId);
        setOnlineOrdersForChart(result.data || []);
      } catch {
        setOnlineOrdersForChart([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

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

    try {
      const countdown = await fetchCountdownBannerSettings();
      setCountdownBannerEnabled(countdown.enabled);
      setCountdownBannerLabelEn(countdown.label_en);
      setCountdownBannerLabelFr(countdown.label_fr);
    } catch (error) {
      console.error("Error fetching countdown banner settings:", error);
    }
    
    // Fetch order expiration settings
    try {
      await fetchExpirationSettings();
    } catch (error) {
      console.error('Error fetching expiration settings:', error);
    }
  };
  
  const fetchExpirationSettings = async () => {
    setLoadingExpirationSettings(true);
    try {
      const apiBase = getApiBaseUrl();
      const url = buildFullApiUrl(API_ROUTES.ORDER_EXPIRATION_SETTINGS, apiBase) ?? `${apiBase || ''}${API_ROUTES.ORDER_EXPIRATION_SETTINGS}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const filtered = (result.data as any[]).filter((s: any) => s.order_status === 'PENDING_CASH');
          setExpirationSettings(filtered);
        }
      } else {
        let detail = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody?.details) detail = String(errBody.details);
          else if (errBody?.error) detail = String(errBody.error);
        } catch {
          /* ignore */
        }
        console.error('order-expiration-settings failed:', detail);
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description:
            language === 'en'
              ? `Could not load expiration settings: ${detail}`
              : `Impossible de charger les paramètres d'expiration : ${detail}`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error fetching expiration settings:', err);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' ? 'Failed to fetch expiration settings' : 'Échec de la récupération des paramètres d\'expiration',
        variant: 'destructive',
      });
    } finally {
      setLoadingExpirationSettings(false);
    }
  };
  
  // Manually trigger auto-reject expired orders
  const [rejectingExpired, setRejectingExpired] = useState(false);
  const triggerAutoRejectExpired = async () => {
    setRejectingExpired(true);
    try {
      const apiBase = getApiBaseUrl();
      const url = `${apiBase}/api/auto-reject-expired-orders`;
      
      console.log('Triggering auto-reject expired orders:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        throw new Error(errorData.error || errorData.details || `Failed with status ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Auto-reject response:', result);
      
      if (result.success) {
        const count = result.rejected_count || 0;
        toast({
          title: language === 'en' ? 'Expired Orders Processed' : 'Commandes Expirées Traitées',
          description: language === 'en' 
            ? `Successfully rejected ${count} expired order(s). Stock has been released.` 
            : `${count} commande(s) expirée(s) rejetée(s) avec succès. Le stock a été libéré.`,
        });
        
        // Refresh orders after a short delay
        setTimeout(() => {
          fetchAmbassadorSalesData();
        }, 1000);
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      console.error('Error triggering auto-reject:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to reject expired orders. Check console for details.' : 'Échec du rejet des commandes expirées. Vérifiez la console pour plus de détails.'),
        variant: 'destructive'
      });
    } finally {
      setRejectingExpired(false);
    }
  };

  // Update order expiration settings
  const updateExpirationSettings = async (settings: Array<{
    order_status: string;
    default_expiration_hours: number;
    is_active: boolean;
  }>) => {
    setLoadingExpirationSettings(true);
    try {
      const apiBase = getApiBaseUrl();
      const url = buildFullApiUrl(API_ROUTES.ORDER_EXPIRATION_SETTINGS, apiBase);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ settings })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update expiration settings');
      }
      
      if (result.success) {
        // Only keep PENDING_CASH settings
        const filteredData = (result.data || []).filter((setting: any) => setting.order_status === 'PENDING_CASH');
        setExpirationSettings(filteredData);
        toast({
          title: language === 'en' ? 'Settings Updated' : 'Paramètres Mis à Jour',
          description: language === 'en' ? 'Expiration settings updated successfully. Refreshing orders...' : 'Paramètres d\'expiration mis à jour avec succès. Actualisation des commandes...',
        });
        
        // Wait a moment for database updates to complete, then refresh order data
        setTimeout(async () => {
          try {
            await fetchAmbassadorSalesData();
            
            // If an order is currently selected, refresh its data too
            if (selectedOrder) {
              setTimeout(() => {
                const refreshedOrder = codAmbassadorOrders.find((o: any) => o.id === selectedOrder.id);
                if (refreshedOrder) {
                  setSelectedOrder(refreshedOrder);
                }
              }, 500);
            }
          } catch (error) {
            console.error('Error refreshing orders after expiration settings update:', error);
          }
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error updating expiration settings:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to update expiration settings' : 'Échec de la mise à jour des paramètres d\'expiration'),
        variant: 'destructive'
      });
    } finally {
      setLoadingExpirationSettings(false);
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

  const fetchAmbassadorSelectionSettingsState = async () => {
    try {
      const settings = await fetchAmbassadorSelectionSettings();
      setAmbassadorSelectionSettings(settings);
    } catch (error) {
      console.error('Error fetching ambassador selection settings:', error);
      setAmbassadorSelectionSettings(normalizeAmbassadorSelectionSettings({}));
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

        const typewriter = (content.typewriter_texts || {}) as { en?: string[]; fr?: string[] };
        setHeroTypewriterTexts({
          en: Array.isArray(typewriter.en) && typewriter.en.length > 0 ? typewriter.en : defaultHeroTypewriterTexts.en,
          fr: Array.isArray(typewriter.fr) && typewriter.fr.length > 0 ? typewriter.fr : defaultHeroTypewriterTexts.fr,
        });
      } else {
        setHeroImages([]);
        setHeroTypewriterTexts(defaultHeroTypewriterTexts);
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

      // Update images array and keep typewriter texts
      const updatedContent = {
        ...existingContent,
        images: images,
        typewriter_texts: {
          en: heroTypewriterTexts.en,
          fr: heroTypewriterTexts.fr,
        },
      };

      await upsertSiteContentViaApi('hero_section', updatedContent);

      setHeroImages(images);
      toast({
        title: language === 'en' ? 'Hero Images Updated' : 'Images Hero Mises à Jour',
        description: language === 'en' 
          ? 'Hero images have been updated successfully' 
          : 'Les images hero ont été mises à jour avec succès',
      });
    } catch (error) {
      console.error('Error saving hero images:', error);
      throw error;
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
      
      let uploadFile = file;
      let posterPublicUrl: string | undefined;
      let posterStoragePath: string | undefined;
      let midUploadUrl: string | undefined;
      let thumbUploadUrl: string | undefined;
      let midUploadPath: string | undefined;
      let thumbUploadPath: string | undefined;

      if (isVideo) {
        toast({
          title: language === 'en' ? 'Optimizing video...' : 'Optimisation de la vidéo...',
          description:
            language === 'en'
              ? 'Converting to MP4 (H.264) before upload.'
              : 'Conversion en MP4 (H.264) avant le téléchargement.',
          duration: 3500,
        });
        const { transcodeHeroVideoToMp4 } = await loadHeroMediaPreprocess();
        uploadFile = await transcodeHeroVideoToMp4(file);

        const posterBlob = await Promise.race([
          captureVideoPosterFromFile(uploadFile),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 12_000)),
        ]);
        if (posterBlob) {
          const posterFile = new File([posterBlob], `hero-poster-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          const posterUp = await uploadHeroImage(posterFile);
          if (!posterUp.error && posterUp.url && posterUp.path) {
            posterPublicUrl = posterUp.url;
            posterStoragePath = posterUp.path;
          }
        }
      } else {
        toast({
          title: language === 'en' ? 'Optimizing image...' : 'Optimisation de l’image...',
          description:
            language === 'en'
              ? 'Compressing and generating WebP variants.'
              : 'Compression et génération des variantes WebP.',
          duration: 3500,
        });

        const { preprocessHeroImageVariants } = await loadHeroMediaPreprocess();
        const variants = await preprocessHeroImageVariants(file);
        uploadFile = variants.full;

        const midUp = await uploadHeroImage(variants.mid);
        if (!midUp.error && midUp.url && midUp.path) {
          midUploadUrl = midUp.url;
          midUploadPath = midUp.path;
        }

        const thumbUp = await uploadHeroImage(variants.thumb);
        if (!thumbUp.error && thumbUp.url && thumbUp.path) {
          thumbUploadUrl = thumbUp.url;
          thumbUploadPath = thumbUp.path;
        }
      }

      const uploadResult = await uploadHeroImage(uploadFile);

      if (uploadResult.error) {
        if (midUploadPath) {
          await deleteHeroImage(midUploadPath);
        }
        if (thumbUploadPath) {
          await deleteHeroImage(thumbUploadPath);
        }
        if (posterStoragePath) {
          await deleteHeroImage(posterStoragePath);
        }
        throw new Error(uploadResult.error);
      }

      const baseAlt = file.name.replace(/\.[^/.]+$/, '');
      const newItem: HeroImage =
        fileType === 'video'
          ? {
              type: 'video',
              src: uploadResult.url,
              alt: baseAlt,
              path: uploadResult.path,
              ...(posterPublicUrl && posterStoragePath
                ? { poster: posterPublicUrl, posterPath: posterStoragePath }
                : {}),
            }
          : {
              type: 'image',
              src: uploadResult.url,
              alt: baseAlt,
              path: uploadResult.path,
              ...(thumbUploadUrl ? { thumbUrl: thumbUploadUrl } : {}),
              ...(thumbUploadPath ? { thumbPath: thumbUploadPath } : {}),
              ...(midUploadUrl ? { midUrl: midUploadUrl } : {}),
              ...(midUploadPath ? { midPath: midUploadPath } : {}),
              ...(uploadResult.avifUrl ? { avifUrl: uploadResult.avifUrl } : {}),
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
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error';
      const shortDetail = detail.length > 220 ? `${detail.slice(0, 217)}…` : detail;
      toast({
        title: t.error,
        description:
          language === 'en'
            ? `Failed to upload hero media: ${shortDetail}`
            : `Échec du téléchargement du média hero : ${shortDetail}`,
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

      if (imageToDelete.posterPath) {
        await deleteHeroImage(imageToDelete.posterPath);
      }
      if (imageToDelete.thumbPath) {
        await deleteHeroImage(imageToDelete.thumbPath);
      }
      if (imageToDelete.midPath) {
        await deleteHeroImage(imageToDelete.midPath);
      }
      if (imageToDelete.path) {
        await deleteHeroImage(imageToDelete.path);
      }

      // Remove from array
      const updatedImages = heroImages.filter((_, i) => i !== index);
      await saveHeroImages(updatedImages);
    } catch (error) {
      console.error('Error deleting hero image:', error);
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error';
      const shortDetail = detail.length > 220 ? `${detail.slice(0, 217)}…` : detail;
      toast({
        title: t.error,
        description:
          language === 'en'
            ? `Failed to delete hero image: ${shortDetail}`
            : `Échec de la suppression de l'image hero : ${shortDetail}`,
        variant: 'destructive',
      });
    }
  };

  // Handle reorder hero images
  const handleReorderHeroImages = async (newOrder: HeroImage[]) => {
    try {
      await saveHeroImages(newOrder);
    } catch (error) {
      console.error('Error reordering hero images:', error);
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error';
      toast({
        title: t.error,
        description:
          language === 'en'
            ? `Failed to save hero order: ${detail}`
            : `Échec de l'enregistrement de l'ordre hero : ${detail}`,
        variant: 'destructive',
      });
    }
  };

  // Save hero typewriter texts (hero title typing effect) to site_content
  const saveHeroTypewriterTexts = async (newTexts: { en: string[]; fr: string[] }) => {
    try {
      const { data: existingData } = await supabase
        .from('site_content')
        .select('content')
        .eq('key', 'hero_section')
        .single();

      let existingContent = existingData?.content || {};
      if (typeof existingContent !== 'object') {
        existingContent = {};
      }

      const updatedContent = {
        ...existingContent,
        images: heroImages,
        typewriter_texts: {
          en: newTexts.en,
          fr: newTexts.fr,
        },
      };

      await upsertSiteContentViaApi('hero_section', updatedContent);

      setHeroTypewriterTexts(newTexts);
      toast({
        title: language === 'en' ? 'Hero texts updated' : 'Textes du hero mis à jour',
        description:
          language === 'en'
            ? 'Hero typing texts have been updated successfully'
            : 'Les textes du hero ont été mis à jour avec succès',
      });
    } catch (error) {
      console.error('Error saving hero typewriter texts:', error);
      toast({
        title: t.error,
        description:
          language === 'en'
            ? 'Failed to save hero typing texts'
            : 'Échec de la sauvegarde des textes du hero',
        variant: 'destructive',
      });
    }
  };

  // Update local state while editing (no auto-save)
  const handleUpdateHeroTypewriterTexts = (lang: 'en' | 'fr', texts: string[]) => {
    setHeroTypewriterTexts((prev) => ({
      ...prev,
      [lang]: texts,
    }));
  };

  // Explicit save handler called from Settings tab
  const handleSaveHeroTypewriterTexts = () => {
    saveHeroTypewriterTexts(heroTypewriterTexts);
  };

  // Fetch Ambassador Sales System data
  const fetchAmbassadorSalesData = async (statusFilter?: string) => {
    setLoadingOrders(true);
    try {
      const ambassadorNameMap = new Map<string, string>();
      const ambassadorStatusMap = new Map<string, string>();

      const apiBase = getApiBaseUrl();
      let ordersUrl = buildFullApiUrl(API_ROUTES.AMBASSADOR_SALES_ORDERS, apiBase) + '?limit=1000';
      if (statusFilter) {
        ordersUrl += `&status=${encodeURIComponent(statusFilter)}`;
      }
      if (selectedEventId) {
        ordersUrl += `&event_id=${encodeURIComponent(selectedEventId)}`;
      }

      let allAmbassadorsData: any[] = [];
      let ambassadorsError: any = null;
      if (ambassadors.length > 0) {
        allAmbassadorsData = ambassadors;
      } else {
        const res = await (supabase as any).from('ambassadors').select('id, full_name, ville, status, city');
        allAmbassadorsData = res.data || [];
        ambassadorsError = res.error;
      }

      if (!ambassadorsError && allAmbassadorsData?.length) {
        (allAmbassadorsData || []).forEach((amb: any) => {
          ambassadorNameMap.set(amb.id, amb.full_name);
          ambassadorStatusMap.set(amb.id, amb.status || '');
        });
      }

      const ordersResponse = await fetch(ordersUrl, { credentials: 'include' });

      if (!ordersResponse.ok) {
        let errMessage = 'Failed to fetch ambassador orders';
        try {
          const errBody = await ordersResponse.json();
          if (errBody?.details) errMessage = errBody.details;
          else if (errBody?.error) errMessage = errBody.error;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      const ordersResult = await ordersResponse.json();
      const allOrdersData = ordersResult.data || [];

      // Filter by source for backward compatibility
      const manualData = allOrdersData.filter((order: any) => order.source === 'ambassador_manual');
      const codAmbassadorData = allOrdersData.filter((order: any) => 
        order.payment_method === 'ambassador_cash' && 
        ['platform_cod', 'ambassador_manual'].includes(order.source)
      );

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
        }

        return {
          ...order,
          ambassador_name: order.ambassador_id ? (ambassadorNameMap.get(order.ambassador_id) || null) : null,
          ambassador_status: order.ambassador_id ? (ambassadorStatusMap.get(order.ambassador_id) || null) : null,
          ambassador_id: order.ambassador_id,
          passes: passes
        };
      });
      setCodAmbassadorOrders(enrichedCodAmbassadorOrders);

      // Calculate pending ambassador orders count
      // Count orders that are NOT completed (not PAID) and are ambassador sales
      const pendingStatuses = ['PENDING_CASH', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION'];
      const pendingOrders = enrichedCodAmbassadorOrders.filter((order: any) => 
        order.payment_method === 'ambassador_cash' &&
        pendingStatuses.includes(order.status)
      );
      
      // Store previous count for trend calculation
      setPreviousPendingAmbassadorOrdersCount(pendingAmbassadorOrdersCount);
      setPendingAmbassadorOrdersCount(pendingOrders.length);

      // All data already fetched from API above
      const allData = allOrdersData.filter((order: any) => order.source === 'ambassador_manual');

      // Legacy: Keep codOrders state for backward compatibility (empty array since platform_cod is deprecated)
      // All COD orders are now in codAmbassadorOrders (ambassador_manual + payment_method = cod)
      setCodOrders([]);
      
      const enrichedManualOrders = (manualData || []).map((order: any) => ({
        ...order,
        ambassador_name: order.ambassador_id ? (ambassadorNameMap.get(order.ambassador_id) || null) : null,
        ambassador_status: order.ambassador_id ? (ambassadorStatusMap.get(order.ambassador_id) || null) : null
      }));
      setManualOrders(enrichedManualOrders);
      
      const enrichedAllOrders = (allData || []).map((order: any) => ({
        ...order,
        ambassador_name: order.ambassador_id ? (ambassadorNameMap.get(order.ambassador_id) || null) : null,
        ambassador_status: order.ambassador_id ? (ambassadorStatusMap.get(order.ambassador_id) || null) : null
      }));
      setAllAmbassadorOrders(enrichedAllOrders);

      // Order logs: load after orders so the tab stops spinning sooner
      void (async () => {
        try {
          const result = await adminOrdersApi.listOrderLogs(100);
          setOrderLogs(result.data || []);
        } catch (e) {
          console.warn('Order logs fetch failed (optional):', e);
          setOrderLogs([]);
        }
      })();
    } catch (error: any) {
      if (error?.message && !error.message.includes('Failed to fetch') && !error.message.includes('NetworkError')) {
        console.error('Error fetching ambassador sales data:', error);
      }
      setCodAmbassadorOrders([]);
      setManualOrders([]);
      setAllAmbassadorOrders([]);
      setCodOrders([]);
      setOrderLogs([]);
      const description = error?.message || (language === 'en' ? 'Failed to fetch sales data' : 'Échec de la récupération des données de vente');
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description,
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
      const dateTo = onlineOrderFilters.dateTo
        ? (() => {
            const d = new Date(onlineOrderFilters.dateTo!);
            d.setHours(23, 59, 59, 999);
            return d.toISOString();
          })()
        : undefined;

      const result = await adminOrdersApi.listOnlineOrders({
        event_id: selectedEventId,
        payment_status: onlineOrderFilters.status !== 'all' ? onlineOrderFilters.status : undefined,
        city: onlineOrderFilters.city !== 'all' ? onlineOrderFilters.city : undefined,
        date_from: onlineOrderFilters.dateFrom?.toISOString(),
        date_to: dateTo,
        limit: ONLINE_ORDERS_PAGE_LIMIT,
      });

      let filteredData = result.data || [];
      if (onlineOrderFilters.orderId && onlineOrderFilters.orderId.trim() !== '') {
        const search = onlineOrderFilters.orderId.trim().replace(/^#/, '').toUpperCase();
        filteredData = filteredData.filter((order: any) => {
          if (order.order_number != null) {
            return String(order.order_number).toUpperCase().includes(search);
          }
          return order.id && order.id.toUpperCase().includes(search);
        });
      }
      if (onlineOrderFilters.phone && onlineOrderFilters.phone.trim() !== '') {
        const phoneSearch = onlineOrderFilters.phone.trim().replace(/\s/g, '');
        filteredData = filteredData.filter((order: any) => {
          const phone = (order.user_phone || order.phone || '').toString().replace(/\s/g, '');
          return phone && phone.includes(phoneSearch);
        });
      }
      if (onlineOrderFilters.passType !== 'all') {
        const pt = onlineOrderFilters.passType;
        filteredData = filteredData.filter((order: any) =>
          order.order_passes && order.order_passes.some((op: any) => op.pass_type === pt)
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
      const dateTo = filters.dateTo
        ? (() => {
            const d = new Date(filters.dateTo!);
            d.setHours(23, 59, 59, 999);
            return d.toISOString();
          })()
        : undefined;

      const result = await adminOrdersApi.listOnlineOrders({
        event_id: selectedEventId,
        payment_status: filters.status !== 'all' ? filters.status : undefined,
        city: filters.city !== 'all' ? filters.city : undefined,
        date_from: filters.dateFrom?.toISOString(),
        date_to: dateTo,
        limit: ONLINE_ORDERS_PAGE_LIMIT,
      });

      let filteredData = result.data || [];
      if (filters.orderId && filters.orderId.trim() !== '') {
        const search = filters.orderId.trim().replace(/^#/, '').toUpperCase();
        filteredData = filteredData.filter((order: any) => {
          if (order.order_number != null) {
            return String(order.order_number).toUpperCase().includes(search);
          }
          return order.id && order.id.toUpperCase().includes(search);
        });
      }
      if (filters.phone && filters.phone.trim() !== '') {
        const phoneSearch = filters.phone.trim().replace(/\s/g, '');
        filteredData = filteredData.filter((order: any) => {
          const phone = (order.user_phone || order.phone || '').toString().replace(/\s/g, '');
          return phone && phone.includes(phoneSearch);
        });
      }
      if (filters.passType !== 'all') {
        const pt = filters.passType;
        filteredData = filteredData.filter((order: any) =>
          order.order_passes && order.order_passes.some((op: any) => op.pass_type === pt)
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

  fetchOnlineOrdersLatestRef.current = fetchOnlineOrders;

  // Admin order management functions
  // Approve Email/SMS delivery for PAID orders
  const handleApproveEmailSmsDelivery = async (orderId: string) => {
    try {
      await adminOrdersApi.approveEmailSmsDelivery(orderId);
      toast({
        title: language === 'en' ? 'Email/SMS Sent' : 'Email/SMS Envoyé',
        description: language === 'en'
          ? 'Tickets generated and email sent to customer successfully'
          : 'Tickets générés et email envoyé au client avec succès',
        variant: 'default',
      });
      fetchAmbassadorSalesData();
      void fetchOnlineOrders();
    } catch (error: any) {
      console.error('Error approving email/SMS delivery:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description:
          error.message ||
          (language === 'en'
            ? 'Failed to approve email/SMS delivery'
            : "Échec de l'approbation de la livraison email/SMS"),
        variant: 'destructive',
      });
    }
  };

  const handleApproveCodAmbassadorOrder = async (orderId: string) => handleApproveOrderAsAdmin(orderId);

  const handleApproveOrderAsAdmin = async (orderId: string) => {
    try {
      const apiBase = getApiBaseUrl();
      const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_APPROVE_ORDER, apiBase);
      if (!apiUrl) throw new Error('Invalid API URL configuration');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.details || errorData.error || errorMessage;
        } catch {
          // use default
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en'
          ? `Order approved successfully. Tickets: ${data.ticketsCount || 0}, Email: ${data.emailSent ? 'Sent' : 'Failed'}, SMS: ${data.smsSent ? 'Sent' : 'Failed'}`
          : `Commande approuvée avec succès. Billets: ${data.ticketsCount || 0}, Email: ${data.emailSent ? 'Envoyé' : 'Échoué'}, SMS: ${data.smsSent ? 'Envoyé' : 'Échoué'}`,
        variant: 'default',
      });
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) setIsOrderDetailsOpen(false);
    } catch (error: any) {
      console.error('Error approving order:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to approve order' : "Échec de l'approbation de la commande"),
        variant: 'destructive',
      });
    }
  };

  const handleRejectCodAmbassadorOrder = async (orderId: string, rejectionReason: string) => {
    if (!rejectionReason?.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' ? 'Rejection reason is required' : 'La raison du rejet est requise',
        variant: 'destructive',
      });
      return;
    }
    try {
      await adminOrdersApi.rejectOrder(orderId, rejectionReason.trim());
      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Order rejected' : 'Commande rejetée',
        variant: 'default',
      });
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) setIsOrderDetailsOpen(false);
    } catch (error: any) {
      console.error('Error rejecting COD ambassador order:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to reject order' : 'Échec du rejet de la commande'),
        variant: 'destructive',
      });
    }
  };

  const handleRejectOrderAsAdmin = async (orderId: string, rejectionReason?: string) =>
    handleRejectCodAmbassadorOrder(orderId, rejectionReason || '');

  // Admin Remove Order - NEW FEATURE
  const handleRemoveOrder = async (orderId: string) => {
    try {
      const apiBase = getApiBaseUrl();
      const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_REMOVE_ORDER, apiBase);
      
      if (!apiUrl) {
        throw new Error('Invalid API URL configuration');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to remove order');
      }

      toast({
        title: language === 'en' ? 'Order Removed' : 'Commande Retirée',
        description: language === 'en' ? 'Order has been removed successfully' : 'La commande a été retirée avec succès',
        variant: 'default'
      });
      
      // Refresh order lists
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) {
        setIsOrderDetailsOpen(false);
        setSelectedOrder(null);
      }
    } catch (error: any) {
      console.error('Error removing order:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to remove order' : 'Échec du retrait de la commande'),
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Admin Skip Ambassador Confirmation - NEW FEATURE
  const handleSkipAmbassadorConfirmation = async (orderId: string, reason?: string) => {
    try {
      const apiBase = getApiBaseUrl();
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

      // Refresh data
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
      throw error;
    }
  };

  // Admin Resend Ticket Email - NEW FEATURE
  const handleResendTicketEmail = async (orderId: string) => {
    setResendingTicketEmail(true);
    try {
      const apiBase = getApiBaseUrl();
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
      await adminOrdersApi.completeOrder(orderId);
      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Order completed' : 'Commande terminée',
        variant: 'default',
      });
      fetchAmbassadorSalesData();
      if (selectedOrder?.id === orderId) setIsOrderDetailsOpen(false);
    } catch (error: any) {
      console.error('Error completing order:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to complete order' : 'Échec de la finalisation de la commande'),
        variant: 'destructive',
      });
    }
  };

  // Update online order payment status
  const updateOnlineOrderStatus = async (orderId: string, newStatus: 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'REFUNDED' | 'EXPIRED') => {
    try {
      await adminOrdersApi.updatePaymentStatus(
        orderId,
        newStatus,
        selectedOnlineOrder?.payment_status ?? null
      );

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

  // Update online order customer email
  const updateOnlineOrderEmail = async (orderId: string, newEmail: string) => {
    const normalizedEmail = newEmail.trim();
    if (!normalizedEmail) {
      throw new Error(language === 'en' ? 'Email cannot be empty' : "L'email ne peut pas etre vide");
    }

    const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_UPDATE_ORDER_EMAIL, getApiBaseUrl());
    if (!apiUrl) throw new Error('Invalid API URL configuration');

    const response = await fetch(apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, email: normalizedEmail }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || body.details || 'Failed to update email');
    }

    setOnlineOrders((prev) =>
      prev.map((order: any) =>
        order.id === orderId
          ? { ...order, user_email: normalizedEmail, email: normalizedEmail, updated_at: new Date().toISOString() }
          : order
      )
    );

    setSelectedOnlineOrder((prev: any) =>
      prev && prev.id === orderId
        ? { ...prev, user_email: normalizedEmail, email: normalizedEmail, updated_at: new Date().toISOString() }
        : prev
    );
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

      await upsertSiteContentViaApi('about_section', updatedContent);

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

  // Fetch phone subscribers (paginated: Supabase/PostgREST caps at 1000 rows per request)
  const fetchPhoneSubscribers = async () => {
    try {
      setLoadingSubscribers(true);
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('phone_subscribers' as any)
          .select('id, phone_number, created_at, import_label')
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          console.warn('phone_subscribers query error:', error);
          setPhoneSubscribers([]);
          return;
        }
        const chunk = data || [];
        allData = allData.concat(chunk);
        hasMore = chunk.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      setPhoneSubscribers(allData.map((item: any) => ({
        id: item.id,
        phone_number: item.phone_number,
        subscribed_at: item.created_at || new Date().toISOString(),
        city: undefined,
        import_label: item.import_label ?? null,
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
        title: language === 'en' ? 'Import Complete' : 'Importation terminée',
        description: language === 'en'
          ? `Imported: ${results.length}, Duplicates: ${duplicates}, Errors: ${errors.length}`
          : `Importé : ${results.length}, Doublons : ${duplicates}, Erreurs : ${errors.length}`,
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

  // Export phone numbers to Excel
  const handleExportPhones = async () => {
    try {
      if (phoneSubscribers.length === 0) {
        toast({
          title: language === 'en' ? 'No Data' : 'Aucune Donnée',
          description: language === 'en' 
            ? 'No phone numbers to export'
            : 'Aucun numéro de téléphone à exporter',
          variant: 'default'
        });
        return;
      }

      const workbook = await createExcelWorkbook();
      const worksheet = workbook.addWorksheet('Phone Numbers');

      // Add header row
      worksheet.columns = [
        { header: 'Phone Number', key: 'phone_number', width: 20 },
        { header: 'Import Label', key: 'import_label', width: 24 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE21836' }
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Add data rows
      phoneSubscribers.forEach(subscriber => {
        worksheet.addRow({
          phone_number: subscriber.phone_number,
          import_label: subscriber.import_label || '',
        });
      });

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `phone_subscribers_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: language === 'en' ? 'Export Successful' : 'Exportation Réussie',
        description: language === 'en' 
          ? `Exported ${phoneSubscribers.length} phone numbers`
          : `${phoneSubscribers.length} numéros exportés`,
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Error exporting phone numbers:', error);
      toast({
        title: language === 'en' ? 'Export Failed' : 'Échec de l\'Exportation',
        description: error.message || (language === 'en' ? 'Failed to export phone numbers' : 'Échec de l\'exportation des numéros'),
        variant: 'destructive'
      });
    }
  };

  const resetPhoneImportDialog = () => {
    setPhoneImportLabel("");
    setPhoneImportFile(null);
  };

  const normalizeTunisianPhoneFromExcel = (raw: string): string | null => {
    let phoneValue = String(raw).trim().replace(/[^\d+]/g, '');
    if (phoneValue.startsWith('+')) phoneValue = phoneValue.substring(1);
    if (phoneValue.startsWith('00216')) phoneValue = phoneValue.substring(5);
    else if (phoneValue.startsWith('216')) phoneValue = phoneValue.substring(3);
    phoneValue = phoneValue.replace(/^0+/, '');
    const phoneRegex = /^[2594][0-9]{7}$/;
    return phoneRegex.test(phoneValue) ? phoneValue : null;
  };

  // Import phone numbers from Excel file with a required import label
  const handleImportPhonesFromExcel = async (file: File, importLabel: string) => {
    const label = importLabel.trim();
    if (!label) {
      toast({
        title: language === 'en' ? 'Label required' : 'Libellé requis',
        description: language === 'en'
          ? 'Enter a label for this import (e.g. Old Event Summer 2024)'
          : 'Saisissez un libellé pour cet import (ex. Ancien événement été 2024)',
        variant: 'destructive',
      });
      return;
    }

    try {
      setImportingPhones(true);

      const workbook = await createExcelWorkbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error(language === 'en' ? 'Invalid Excel file format' : 'Format de fichier Excel invalide');
      }

      const seenInFile = new Set<string>();
      const phoneNumbers: string[] = [];
      let validRowsInFile = 0;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const phoneCell = row.getCell(1);
        if (phoneCell && phoneCell.value) {
          const normalized = normalizeTunisianPhoneFromExcel(String(phoneCell.value));
          if (normalized) {
            validRowsInFile++;
            if (!seenInFile.has(normalized)) {
              seenInFile.add(normalized);
              phoneNumbers.push(normalized);
            }
          }
        }
      });

      const duplicatesInFile = validRowsInFile - phoneNumbers.length;

      if (phoneNumbers.length === 0) {
        toast({
          title: language === 'en' ? 'No Valid Numbers' : 'Aucun Numéro Valide',
          description: language === 'en' 
            ? 'No valid phone numbers found in Excel file'
            : 'Aucun numéro de téléphone valide trouvé dans le fichier Excel',
          variant: 'destructive'
        });
        return;
      }

      const existingPhoneSet = new Set<string>();
      const checkChunkSize = 500;
      for (let i = 0; i < phoneNumbers.length; i += checkChunkSize) {
        const chunk = phoneNumbers.slice(i, i + checkChunkSize);
        const { data: existingSubscribers, error: checkError } = await supabase
          .from('phone_subscribers')
          .select('phone_number')
          .in('phone_number', chunk);

        if (checkError) throw checkError;
        (existingSubscribers || []).forEach((s: { phone_number: string }) => {
          existingPhoneSet.add(s.phone_number);
        });
      }

      const newPhonesToImport = phoneNumbers.filter(
        phone => !existingPhoneSet.has(phone)
      );

      let duplicatesCount = phoneNumbers.length - newPhonesToImport.length + duplicatesInFile;
      const results: string[] = [];
      const errors: Array<{ phone: string; error: string }> = [];

      if (newPhonesToImport.length === 0) {
        toast({
          title: language === 'en' ? 'All Duplicates' : 'Tous Doublons',
          description: language === 'en' 
            ? `All ${phoneNumbers.length} phone numbers already exist in database`
            : `Tous les ${phoneNumbers.length} numéros existent déjà dans la base de données`,
          variant: 'default'
        });
        return;
      }

      // Batch insert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < newPhonesToImport.length; i += chunkSize) {
        const chunk = newPhonesToImport.slice(i, i + chunkSize).map(phone => ({
          phone_number: phone,
          language: 'en' as const,
          import_label: label,
        }));

        try {
          const { data: inserted, error: insertError } = await supabase
            .from('phone_subscribers')
            .insert(chunk)
            .select('phone_number');

          if (insertError) {
            // If batch fails, try individual inserts
            for (const phone of chunk) {
              try {
                const { error: singleError } = await supabase
                  .from('phone_subscribers')
                  .insert(phone);

                if (singleError) {
                  if (singleError.code === '23505') {
                    // Duplicate (race condition)
                    duplicatesCount++;
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
            if (inserted) {
              results.push(...inserted.map((item: any) => item.phone_number));
            }
          }
        } catch (err: any) {
          console.error('Batch insert error:', err);
          errors.push({ phone: 'batch', error: err.message });
        }
      }

      // Refresh subscribers list
      await fetchPhoneSubscribers();

      toast({
        title: language === 'en' ? 'Import Complete' : 'Importation Terminée',
        description: language === 'en'
          ? `Label "${label}" — Imported: ${results.length}, Skipped duplicates: ${duplicatesCount}, Errors: ${errors.length}`
          : `Libellé Â« ${label} Â» — Importé: ${results.length}, Doublons ignorés: ${duplicatesCount}, Erreurs: ${errors.length}`,
        variant: results.length > 0 ? 'default' : 'destructive'
      });

      if (errors.length > 0) {
        console.error('Import errors:', errors);
      }

      setShowImportDialog(false);
      resetPhoneImportDialog();
    } catch (error: any) {
      console.error('Error importing from Excel:', error);
      toast({
        title: language === 'en' ? 'Import Failed' : 'Échec de l\'Importation',
        description: error.message || (language === 'en' ? 'Failed to import phone numbers' : 'Échec de l\'importation des numéros'),
        variant: 'destructive'
      });
    } finally {
      setImportingPhones(false);
    }
  };

  // Fetch email subscribers (paginated: Supabase/PostgREST caps at 1000 rows per request)
  const fetchEmailSubscribers = async () => {
    try {
      setLoadingEmailSubscribers(true);
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('newsletter_subscribers')
          .select('id, email, subscribed_at, language, import_label')
          .order('subscribed_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          console.warn('newsletter_subscribers query error:', error);
          setEmailSubscribers([]);
          return;
        }
        const chunk = data || [];
        allData = allData.concat(chunk);
        hasMore = chunk.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      setEmailSubscribers(allData.map((item: any) => ({
        id: item.id,
        email: item.email,
        subscribed_at: item.subscribed_at || new Date().toISOString(),
        language: item.language || 'en',
        import_label: item.import_label ?? null,
      })));
    } catch (error) {
      console.error('Error fetching email subscribers:', error);
      setEmailSubscribers([]);
    } finally {
      setLoadingEmailSubscribers(false);
    }
  };

  // Export email subscribers to Excel
  const handleExportEmails = async () => {
    try {
      if (emailSubscribers.length === 0) {
        toast({
          title: language === 'en' ? 'No Data' : 'Aucune Donnée',
          description: language === 'en' 
            ? 'No email addresses to export'
            : 'Aucune adresse email à exporter',
          variant: 'default'
        });
        return;
      }

      const workbook = await createExcelWorkbook();
      const worksheet = workbook.addWorksheet('Email Subscribers');

      worksheet.columns = [
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Import Label', key: 'import_label', width: 24 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE21836' }
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      emailSubscribers.forEach(subscriber => {
        worksheet.addRow({
          email: subscriber.email,
          import_label: subscriber.import_label || '',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `email_subscribers_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: language === 'en' ? 'Export Successful' : 'Exportation Réussie',
        description: language === 'en' 
          ? `Exported ${emailSubscribers.length} email addresses`
          : `${emailSubscribers.length} adresses email exportées`,
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Error exporting email addresses:', error);
      toast({
        title: language === 'en' ? 'Export Failed' : 'Échec de l\'Exportation',
        description: error.message || (language === 'en' ? 'Failed to export email addresses' : 'Échec de l\'exportation des adresses email'),
        variant: 'destructive'
      });
    }
  };

  const resetEmailImportDialog = () => {
    setEmailImportLabel("");
    setEmailImportFile(null);
  };

  // Import email addresses from Excel file with a required import label
  const handleImportEmailsFromExcel = async (file: File, importLabel: string) => {
    const label = importLabel.trim();
    if (!label) {
      toast({
        title: language === 'en' ? 'Label required' : 'Libellé requis',
        description: language === 'en'
          ? 'Enter a label for this import (e.g. Old Event Summer 2024)'
          : 'Saisissez un libellé pour cet import (ex. Ancien événement été 2024)',
        variant: 'destructive',
      });
      return;
    }

    try {
      setImportingEmails(true);

      const workbook = await createExcelWorkbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error(language === 'en' ? 'Invalid Excel file format' : 'Format de fichier Excel invalide');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const seenInFile = new Set<string>();
      const emails: string[] = [];
      let validRowsInFile = 0;
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        
        const emailCell = row.getCell(1);
        if (emailCell && emailCell.value) {
          const emailValue = String(emailCell.value).trim().toLowerCase();
          if (emailRegex.test(emailValue)) {
            validRowsInFile++;
            if (!seenInFile.has(emailValue)) {
              seenInFile.add(emailValue);
              emails.push(emailValue);
            }
          }
        }
      });

      const duplicatesInFile = validRowsInFile - emails.length;

      if (emails.length === 0) {
        toast({
          title: language === 'en' ? 'No Valid Emails' : 'Aucun Email Valide',
          description: language === 'en' 
            ? 'No valid email addresses found in Excel file'
            : 'Aucune adresse email valide trouvée dans le fichier Excel',
          variant: 'destructive'
        });
        return;
      }

      // Check for duplicates against existing subscribers (batch in chunks of 500)
      const existingEmailSet = new Set<string>();
      const checkChunkSize = 500;
      for (let i = 0; i < emails.length; i += checkChunkSize) {
        const chunk = emails.slice(i, i + checkChunkSize);
        const { data: existingSubscribers, error: checkError } = await supabase
          .from('newsletter_subscribers')
          .select('email')
          .in('email', chunk);

        if (checkError) throw checkError;
        (existingSubscribers || []).forEach((s: { email: string }) => {
          existingEmailSet.add(s.email.toLowerCase());
        });
      }

      const newEmailsToImport = emails.filter(
        email => !existingEmailSet.has(email.toLowerCase())
      );

      let duplicatesCount = emails.length - newEmailsToImport.length + duplicatesInFile;
      const results: string[] = [];
      const errors: Array<{ email: string; error: string }> = [];

      if (newEmailsToImport.length === 0) {
        toast({
          title: language === 'en' ? 'All Duplicates' : 'Tous Doublons',
          description: language === 'en' 
            ? `All ${emails.length} email addresses already exist in database`
            : `Toutes les ${emails.length} adresses email existent déjà dans la base de données`,
          variant: 'default'
        });
        return;
      }

      // Batch insert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < newEmailsToImport.length; i += chunkSize) {
        const chunk = newEmailsToImport.slice(i, i + chunkSize).map(email => ({
          email: email,
          language: 'en' as const,
          import_label: label,
        }));

        try {
          const { data: inserted, error: insertError } = await supabase
            .from('newsletter_subscribers')
            .insert(chunk)
            .select('email');

          if (insertError) {
            for (const emailData of chunk) {
              try {
                const { error: singleError } = await supabase
                  .from('newsletter_subscribers')
                  .insert(emailData);

                if (singleError) {
                  if (singleError.code === '23505') {
                    duplicatesCount++;
                  } else {
                    errors.push({ email: emailData.email, error: singleError.message });
                  }
                } else {
                  results.push(emailData.email);
                }
              } catch (err: any) {
                errors.push({ email: emailData.email, error: err.message });
              }
            }
          } else {
            if (inserted) {
              results.push(...inserted.map((item: any) => item.email));
            }
          }
        } catch (err: any) {
          console.error('Batch insert error:', err);
          errors.push({ email: 'batch', error: err.message });
        }
      }

      await fetchEmailSubscribers();

      toast({
        title: language === 'en' ? 'Import Complete' : 'Importation Terminée',
        description: language === 'en'
          ? `Label "${label}" — Imported: ${results.length}, Skipped duplicates: ${duplicatesCount}, Errors: ${errors.length}`
          : `Libellé Â« ${label} Â» — Importé: ${results.length}, Doublons ignorés: ${duplicatesCount}, Erreurs: ${errors.length}`,
        variant: results.length > 0 ? 'default' : 'destructive'
      });

      if (errors.length > 0) {
        console.error('Import errors:', errors);
      }

      setShowEmailImportDialog(false);
      resetEmailImportDialog();
    } catch (error: any) {
      console.error('Error importing from Excel:', error);
      toast({
        title: language === 'en' ? 'Import Failed' : 'Échec de l\'Importation',
        description: error.message || (language === 'en' ? 'Failed to import email addresses' : 'Échec de l\'importation des adresses email'),
        variant: 'destructive'
      });
    } finally {
      setImportingEmails(false);
    }
  };

  // Test / bulk newsletter sends use the official campaign HTML from the API (api/lib/campaign-email-html.cjs).

  // Send test email to a single address
  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter a test email address' 
          : 'Veuillez entrer une adresse email de test',
        variant: 'destructive',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmailAddress.trim())) {
      toast({
        title: language === 'en' ? 'Invalid Email' : 'Email Invalide',
        description: language === 'en' 
          ? 'Please enter a valid email address' 
          : 'Veuillez entrer une adresse email valide',
        variant: 'destructive',
      });
      return;
    }

    if (!emailSubject.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter an email subject' 
          : 'Veuillez entrer un sujet d\'email',
        variant: 'destructive',
      });
      return;
    }

    if (!emailContent.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter email content' 
          : 'Veuillez entrer le contenu de l\'email',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSendingTestEmail(true);
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testEmailAddress.trim(),
          subject: emailSubject,
          campaignTemplate: true,
          emailBody: emailContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to send test email');
      }

      toast({
        title: language === 'en' ? 'Test Email Sent' : 'Email de Test Envoyé',
        description: language === 'en'
          ? `Test email sent successfully to ${testEmailAddress.trim()}`
          : `Email de test envoyé avec succès à ${testEmailAddress.trim()}`,
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: language === 'en' ? 'Test Email Failed' : 'Échec de l\'Email de Test',
        description: error.message || (language === 'en' ? 'Failed to send test email' : 'Échec de l\'envoi de l\'email de test'),
        variant: 'destructive'
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Send bulk emails with delay
  const handleSendBulkEmails = async () => {
    if (!emailSubject.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter an email subject' 
          : 'Veuillez entrer un sujet d\'email',
        variant: 'destructive',
      });
      return;
    }

    if (!emailContent.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Please enter email content' 
          : 'Veuillez entrer le contenu de l\'email',
        variant: 'destructive',
      });
      return;
    }

    if (emailSubscribers.length === 0) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'No email subscribers available' 
          : 'Aucun abonné email disponible',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSendingBulkEmails(true);
      const results: Array<{ email: string; success: boolean; error?: string }> = [];
      
      // Send emails with delay between each
      for (let i = 0; i < emailSubscribers.length; i++) {
        const subscriber = emailSubscribers[i];
        
        try {
          const response = await fetch('/api/send-email', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: subscriber.email,
              subject: emailSubject,
              campaignTemplate: true,
              emailBody: emailContent,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.details || errorData.error || 'Failed to send email');
          }

          results.push({ email: subscriber.email, success: true });
        } catch (error: any) {
          results.push({ 
            email: subscriber.email, 
            success: false, 
            error: error.message || 'Unknown error' 
          });
        }

        // Delay before next email (except for the last one)
        if (i < emailSubscribers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, emailDelaySeconds * 1000));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      toast({
        title: language === 'en' ? 'Bulk Email Complete' : 'Envoi en Masse Terminé',
        description: language === 'en'
          ? `Sent: ${successCount}, Failed: ${failCount}`
          : `Envoyé: ${successCount}, Échoué: ${failCount}`,
        variant: failCount === 0 ? 'default' : 'destructive'
      });

      // Clear form after successful send
      if (failCount === 0) {
        setEmailSubject("");
        setEmailContent("");
      }
    } catch (error: any) {
      console.error('Error sending bulk emails:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to send bulk emails' : 'Échec de l\'envoi en masse'),
        variant: 'destructive'
      });
    } finally {
      setSendingBulkEmails(false);
    }
  };

  // Fetch SMS logs
  const fetchSmsLogs = async () => {
    // Import getSourceDisplayName at the top if not already imported
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
      setSmsLogs((data || []) as unknown as Array<{id: string; phone_number: string; message: string; status: string; error_message?: string; sent_at?: string; created_at: string; api_response?: any; source?: string; campaign_name?: string}>);
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

  // Fetch comprehensive logs from API
  const fetchLogs = async (resetOffset = false) => {
    try {
      setLoadingComprehensiveLogs(true);
      
      const params = new URLSearchParams();
      if (logsFilters.type.length > 0) {
        params.append('type', logsFilters.type[0]); // API supports single type, take first
      }
      if (logsFilters.category) {
        params.append('category', logsFilters.category);
      }
      if (logsFilters.userRole) {
        params.append('userRole', logsFilters.userRole);
      }
      if (logsFilters.startDate) {
        params.append('startDate', logsFilters.startDate.toISOString());
      }
      if (logsFilters.endDate) {
        params.append('endDate', logsFilters.endDate.toISOString());
      }
      if (logsFilters.search) {
        params.append('search', logsFilters.search);
      }
      params.append('limit', logsPagination.limit.toString());
      params.append('offset', resetOffset ? '0' : logsPagination.offset.toString());
      params.append('sortBy', logsFilters.sortBy);
      params.append('order', logsFilters.order);

      const url = buildFullApiUrl(API_ROUTES.ADMIN_LOGS) + '?' + params.toString();
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setLogs(data.logs);
        setLogsPagination(data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch logs');
      }
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? `Failed to fetch logs: ${error.message}` 
          : `Échec de la récupération des logs: ${error.message}`,
        variant: 'destructive',
      });
      setLogs([]);
    } finally {
      setLoadingComprehensiveLogs(false);
    }
  };

  // Fetch CSP violation reports
  const fetchCspReports = async () => {
    try {
      setLoadingCspReports(true);
      const url = buildFullApiUrl(API_ROUTES.ADMIN_CSP_REPORTS) + '?limit=100&offset=0';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 404) return; // Table may not exist yet
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setCspReports(data.reports || []);
    } catch (error: any) {
      console.warn('Failed to fetch CSP reports:', error?.message);
      setCspReports([]);
    } finally {
      setLoadingCspReports(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && activeTab === 'logs') {
      const interval = setInterval(() => {
        fetchLogs(true);
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load logs and CSP reports when tab is opened
  useEffect(() => {
    if (activeTab === 'logs') {
      if (logs.length === 0 && !loadingComprehensiveLogs) fetchLogs(true);
      fetchCspReports();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Send Test SMS - specific number only
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

    const phoneToSend = cleanPhone;

    // Check balance before sending
    if (smsBalance?.balanceValue === 0 || smsBalance?.balance === 0 || smsBalance?.balance === '0') {
      const confirmSend = window.confirm(
        language === 'en' 
          ? 'âš ï¸ Warning: Your SMS balance appears to be 0. Messages may fail to send. Do you want to continue?'
          : 'âš ï¸ Avertissement: Votre solde SMS semble être de 0. Les messages peuvent échouer. Voulez-vous continuer?'
      );
      if (!confirmSend) {
        return;
      }
    }

    try {
      setSendingTestSms(true);
      
      console.log('Sending test SMS:', { phoneNumber: phoneToSend, messageLength: testSmsMessage.trim().length });
      
      const response = await apiFetch(API_ROUTES.SEND_SMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumbers: [phoneToSend], 
          message: testSmsMessage.trim() 
        }),
      });

      console.log('Test SMS response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || errorData.message || `Server error: ${response.status} ${response.statusText}`);
        } catch (parseError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}. ${errorText.substring(0, 200)}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Unexpected content type:', contentType, 'Response:', text.substring(0, 200));
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
      }

      const responseData = await response.json();
      console.log('Test SMS response data:', responseData);

      if (responseData.success) {
        // Check if there were any errors in the results
        if (responseData.errors && responseData.errors.length > 0) {
          const errorMsg = responseData.errors[0].error || 'Failed to send SMS';
          throw new Error(errorMsg);
        }

        // Check if SMS was actually sent
        if (responseData.sent === 0 && responseData.failed > 0) {
          const errorMsg = responseData.errors?.[0]?.error || 'SMS failed to send';
          throw new Error(errorMsg);
        }

        toast({
          title: language === 'en' ? 'Test SMS Sent' : 'SMS Test Envoyé',
          description: language === 'en' 
            ? `Test SMS sent successfully to +216 ${phoneToSend}`
            : `SMS test envoyé avec succès à +216 ${phoneToSend}`,
        });
        
        await fetchSmsLogs();
        await fetchSmsBalance();
        
        // Clear test fields
        setTestPhoneNumber('');
        setTestSmsMessage('');
      } else {
        const errorMsg = responseData.error || responseData.message || 'Failed to send test SMS';
        console.error('Test SMS failed:', errorMsg, responseData);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error sending test SMS:', error);
      const errorMessage = error instanceof Error ? error.message : (language === 'en' ? 'Failed to send test SMS' : 'Échec de l\'envoi du SMS test');
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSendingTestSms(false);
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
          ? 'âš ï¸ Warning: Your SMS balance appears to be 0. Messages may fail to send. Do you want to continue?'
          : 'âš ï¸ Avertissement: Votre solde SMS semble être de 0. Les messages peuvent échouer. Voulez-vous continuer?'
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
          ? 'âš ï¸ Warning: Your SMS balance appears to be 0. Messages may fail to send. Do you want to continue?'
          : 'âš ï¸ Avertissement: Votre solde SMS semble être de 0. Les messages peuvent échouer. Voulez-vous continuer?'
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

  const cameFromLogin =
    (location.state as { fromLogin?: boolean } | undefined)?.fromLogin === true;

  const suppress401Until = useMemo(
    // On some mobile webviews, the httpOnly cookie becomes available to subsequent requests
    // slightly after navigation completes. Allow a longer warm-up window.
    () => (cameFromLogin ? Date.now() + 8000 : 0),
    [cameFromLogin],
  );

  // Fetch current admin role and verify token validity
  // This ensures the 1-hour session is enforced - token expiration is checked periodically
  useEffect(() => {
    const cached = peekAndConsumeAdminVerifyCache();
    if (cached?.admin) {
      const role = cached.admin.role || "admin";
      setCurrentAdminRole(role);
      setAllowedTabs(cached.allowedTabs || []);
      setAdminPermissions(cached.permissions || []);
      setAuthReady(true);
      setCurrentAdminId(cached.admin.id || null);
      setCurrentAdminName(cached.admin.name || null);
      setCurrentAdminEmail(cached.admin.email || null);
      if (cached.sessionExpiresAt) {
        const expiration = cached.sessionExpiresAt;
        const remainingFromServer =
          typeof cached.sessionTimeRemaining === "number" ? cached.sessionTimeRemaining : null;
        const fallbackRemaining = Math.max(0, Math.floor((expiration - Date.now()) / 1000));
        const remainingSeconds =
          remainingFromServer !== null ? remainingFromServer : fallbackRemaining;
        setSessionCountdown({ expiresAt: expiration, remainingSeconds });
      }
    }

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
            setAllowedTabs(Array.isArray(data.allowedTabs) ? data.allowedTabs : []);
            setAdminPermissions(Array.isArray(data.permissions) ? data.permissions : []);
            setAuthReady(true);
            setCurrentAdminId(data.admin.id || null);
            setCurrentAdminName(data.admin.name || null);
            setCurrentAdminEmail(data.admin.email || null);
            
            // Update session expiration timestamp from server response
            // STRICT: This is the JWT 'exp' field - immutable, non-resettable
            // The expiration time is set at login and NEVER changes until re-login
            if (data.sessionExpiresAt) {
              const expiration = data.sessionExpiresAt;
              const remainingFromServer =
                typeof (data as any).sessionTimeRemaining === "number"
                  ? (data as any).sessionTimeRemaining
                  : null;
              const fallbackRemaining = Math.max(
                0,
                Math.floor((expiration - Date.now()) / 1000),
              );
              const remainingSeconds =
                remainingFromServer !== null ? remainingFromServer : fallbackRemaining;

              setSessionCountdown((prev) => {
                const nextExpiresAt =
                  prev?.expiresAt === expiration
                    ? prev.expiresAt
                    : prev
                      ? prev.expiresAt
                      : expiration;
                return { expiresAt: nextExpiresAt, remainingSeconds };
              });
            }
            
            // Show alert if role is not super_admin but user expects it
            if (role !== 'super_admin') {
              console.warn('âš ï¸ Current role is:', role, '- Expected: super_admin');
              console.warn('ðÅ¸’Â¡ If you should be super_admin, run FIX_SUPER_ADMIN_ROLE.sql and log out/in');
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
              const now = Date.now();
              const willSuppress = suppress401Until && now < suppress401Until;

              if (willSuppress) {
                console.warn('Suppressing redirect after fresh login (warmup window)');
              } else {
                window.location.href = '/admin/login';
              }
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
                const now = Date.now();
                const willSuppress = suppress401Until && now < suppress401Until;

                if (willSuppress) {
                  console.warn('Suppressing redirect after fresh login (warmup window)');
                } else {
                  window.location.href = '/admin/login';
                }
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
              const now = Date.now();
              const willSuppress = suppress401Until && now < suppress401Until;

              if (willSuppress) {
                console.warn('Suppressing redirect after fresh login (warmup window)');
              } else {
                window.location.href = '/admin/login';
              }
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
    let initialFetchTimeout: ReturnType<typeof setTimeout> | undefined;
    if (!cached?.admin) {
      if (cameFromLogin) {
        // Give the server time to set/refresh the httpOnly cookie on fast mobile navigations.
        initialFetchTimeout = setTimeout(() => fetchCurrentAdminRole(), 1200);
      } else {
        fetchCurrentAdminRole();
      }
    }
    
    // Verify token periodically to catch expiration
    // STRICT: This only checks expiration - it NEVER extends or resets the timer
    // The JWT 'exp' field is immutable and cannot be changed
    // Changed to 15 minutes as requested
    const interval = setInterval(() => {
      retryCount = 0; // Reset retry count for each interval
      fetchCurrentAdminRole();
    }, 15 * 60 * 1000); // Every 15 minutes
    
    return () => {
      clearInterval(interval);
      if (initialFetchTimeout) clearTimeout(initialFetchTimeout);
    };
  }, [navigate, cameFromLogin, suppress401Until]);

  const fetchAdmins = async () => {
    if (!canAccessTab('admins')) return;

    try {
      const result = await adminApi.listAdmins();
      setAdmins((result.data || []) as Array<{id: string; name: string; email: string; phone?: string; role: string; is_active: boolean; created_at: string}>);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchAdminLogs = async () => {
    setLoadingAdminLogs(true);
    try {
      const result = await adminOrdersApi.listAuditLogs(150);
      setAdminLogs(result.data || []);
    } catch (e) {
      console.error('Error fetching admin logs:', e);
    } finally {
      setLoadingAdminLogs(false);
    }
  };

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
      const payload: Record<string, unknown> = {
        name: newAdminData.name,
        email: newAdminData.email,
      };
      if (newAdminData.phone?.trim()) {
        payload.phone = newAdminData.phone;
      }

      const result = await adminApi.createAdmin(payload);
      const newAdmin = result.data;
      const password = result.generatedPassword as string;

      const emailConfig = createAdminCredentialsEmail(
        {
          name: newAdminData.name,
          email: newAdminData.email,
          phone: newAdminData.phone || undefined,
          password,
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
        toast({
          title: language === 'en' ? 'Admin Created - Email Failed' : 'Admin Créé - Email Échoué',
          description: language === 'en'
            ? `Admin account created, but email failed: ${emailResult.error || 'Unknown error'}. Please check the password manually.`
            : `Compte admin créé, mais l'email a échoué: ${emailResult.error || 'Erreur inconnue'}. Veuillez vérifier le mot de passe manuellement.`,
          variant: 'destructive',
          duration: 10000,
        });
      }

      setNewAdminData({ name: '', email: '', phone: '' });
      setIsAddAdminDialogOpen(false);
      if (currentAdminId && newAdmin?.id) {
        logAdminAction({
          adminId: currentAdminId,
          adminName: currentAdminName || 'Unknown',
          adminEmail: currentAdminEmail,
          action: 'admin.created',
          targetType: 'admin',
          targetId: newAdmin.id,
          details: { name: newAdminData.name, email: newAdminData.email },
        }).catch(() => {});
      }
      await fetchAdmins();
      await fetchAdminLogs();
    } catch (error: unknown) {
      console.error('Error creating admin:', error);
      const err = error as { message?: string; code?: string };
      let errorMessage =
        language === 'en' ? 'Failed to create admin account' : 'Échec de la création du compte admin';
      if (err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
        errorMessage =
          language === 'en'
            ? 'An admin with this email already exists.'
            : 'Un admin avec cet email existe déjà.';
      } else if (err?.message) {
        errorMessage = err.message;
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
      const previousRole = admins.find((a) => a.id === editingAdmin.id)?.role;
      const updatePayload: Record<string, unknown> = {
        name: editingAdmin.name,
        email: editingAdmin.email,
        role: editingAdmin.role,
        is_active: editingAdmin.is_active,
      };
      if (editingAdmin.phone !== undefined) {
        updatePayload.phone =
          editingAdmin.phone && editingAdmin.phone.trim() ? editingAdmin.phone : null;
      }

      await adminApi.updateAdmin(editingAdmin.id, updatePayload);

      toast({
        title: language === 'en' ? 'Admin Updated' : 'Admin Modifié',
        description: language === 'en'
          ? 'Admin account updated successfully'
          : 'Compte admin modifié avec succès',
      });

      setEditingAdmin(null);
      setIsEditAdminDialogOpen(false);
      if (currentAdminId && previousRole !== editingAdmin.role) {
        if (editingAdmin.role === 'super_admin') {
          logAdminAction({
            adminId: currentAdminId,
            adminName: currentAdminName || 'Unknown',
            adminEmail: currentAdminEmail,
            action: 'admin.role_set_super_admin',
            targetType: 'admin',
            targetId: editingAdmin.id,
            details: { target_name: editingAdmin.name, target_email: editingAdmin.email },
          }).catch(() => {});
        } else if (editingAdmin.role === 'admin') {
          logAdminAction({
            adminId: currentAdminId,
            adminName: currentAdminName || 'Unknown',
            adminEmail: currentAdminEmail,
            action: 'admin.role_set_admin',
            targetType: 'admin',
            targetId: editingAdmin.id,
            details: { target_name: editingAdmin.name, target_email: editingAdmin.email },
          }).catch(() => {});
        }
        await fetchAdminLogs();
      }
      await fetchAdmins();
    } catch (error: unknown) {
      console.error('Error updating admin:', error);
      const err = error as { message?: string; code?: string };

      let errorMessage = language === 'en' ? 'Failed to update admin account' : 'Échec de la modification du compte admin';

      if (err?.code === '42501' || err?.message?.includes('policy') || err?.message?.includes('permission')) {
        errorMessage = language === 'en'
          ? 'Permission denied. Please check your admin permissions.'
          : 'Permission refusée. Veuillez vérifier vos permissions d\'admin.';
      } else if (err?.code === '23505' || err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
        errorMessage = language === 'en'
          ? 'An admin with this email already exists.'
          : 'Un admin avec cet email existe déjà.';
      } else if (err?.message) {
        errorMessage = err.message;
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

    setConfirmDelete({ kind: 'delete-admin', adminId });
  };

  const doDeleteAdmin = async (adminId: string) => {
    setProcessingId(`delete-admin-${adminId}`);
    try {
      const target = admins.find((a) => a.id === adminId);
      await adminApi.deleteAdmin(adminId);

      if (currentAdminId) {
        logAdminAction({ adminId: currentAdminId, adminName: currentAdminName || 'Unknown', adminEmail: currentAdminEmail, action: 'admin.deleted', targetType: 'admin', targetId: adminId, details: { target_name: target?.name, target_email: target?.email } }).catch(() => {});
      }
      toast({
        title: language === 'en' ? 'Admin Deleted' : 'Admin Supprimé',
        description: language === 'en' ? 'Admin account deleted successfully' : 'Compte admin supprimé avec succès',
      });
      await fetchAdmins();
      await fetchAdminLogs();
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      let errorMessage = language === 'en' ? 'Failed to delete admin account' : 'Échec de la suppression du compte admin';
      if (error?.code === '42501' || error?.message?.includes('policy') || error?.message?.includes('permission')) {
        errorMessage = language === 'en' ? 'Permission denied. Please check your admin permissions.' : 'Permission refusée. Veuillez vérifier vos permissions d\'admin.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({ title: language === 'en' ? 'Error' : 'Erreur', description: errorMessage, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const doDeletePass = async (passId: string, eventId: string) => {
    try {
      await adminApi.deletePass(passId);
      const apiBase = getApiBaseUrl();
      const passesResponse = await fetch(`${apiBase}/api/admin/passes/${eventId}`, { credentials: 'include' });
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
        setPassesForManagement(passesWithStock);
      }
      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Pass deleted successfully' : 'Pass supprimé avec succès',
      });
    } catch (error: any) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error?.message || (language === 'en' ? 'Failed to delete pass' : 'Échec de la suppression du pass'),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (authReady && canAccessTab('admins')) {
      fetchAdmins();
    }
  }, [authReady, allowedTabs]);

  // Preload Reports chunk after idle so switching to Reports usually skips the Suspense skeleton (data fetch still shows KPI skeletons until ready).
  useEffect(() => {
    if (!canAccessTab("tickets")) return;
    if (typeof globalThis === "undefined") return;
    const w = globalThis as Window & typeof globalThis;
    const run = () => {
      void import("@/components/admin/analytics/ReportsAnalytics");
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 4000 });
      return () => w.cancelIdleCallback(id);
    }
    const t = w.setTimeout(run, 800);
    return () => w.clearTimeout(t);
  }, [currentAdminRole]);

  useEffect(() => {
    if (activeTab === 'admins' && canAccessTab('admins')) {
      fetchAdminLogs();
    }
  }, [activeTab, currentAdminRole]);

  // Redirect to first allowed tab when active tab is not permitted
  useEffect(() => {
    if (!authReady || !allowedTabs.length) return;
    if (activeTab && !canAccessTab(activeTab)) {
      setActiveTab(resolveDefaultTab(allowedTabs));
    }
  }, [activeTab, allowedTabs, authReady, canAccessTab]);

  // Load passes when editing dialog opens for an existing event
  useEffect(() => {
    if (!isEventDialogOpen) {
      adminPassesFetchAttemptRef.current = null;
      return;
    }
    const loadPassesForEditing = async () => {
      // Only run if dialog is open, we're editing (has id), and passes are missing or empty
      if (isEventDialogOpen && editingEvent?.id && (!editingEvent.passes || editingEvent.passes.length === 0)) {
        if (adminPassesFetchAttemptRef.current === editingEvent.id) return;
        adminPassesFetchAttemptRef.current = editingEvent.id;
        
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
        
        // Fetch passes with stock info from admin API
        try {
          // Use getApiBaseUrl() for consistent API routing
          const apiBase = getApiBaseUrl();
          const passesResponse = await fetch(`${apiBase}/api/admin/passes/${editingEvent.id}`, {
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
            setEditingEvent(prev => prev ? { ...prev, passes: passesWithStock } : null);
            return;
          }
        } catch (apiError) {
          console.warn('Failed to fetch passes with stock from API, falling back to direct query:', apiError);
        }
        
        // Fallback to direct query if API fails
        const mappedPasses = (passesData || []).map((p: any) => ({
          id: p.id,
          name: p.name || '',
          price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
          description: p.description || '',
          is_primary: p.is_primary || false,
          max_quantity: p.max_quantity ?? null,
          sold_quantity: p.sold_quantity || 0,
          remaining_quantity: p.max_quantity === null ? null : (p.max_quantity - (p.sold_quantity || 0)),
          is_unlimited: p.max_quantity === null,
          is_active: p.is_active !== undefined ? p.is_active : true,
          is_sold_out: p.max_quantity !== null && (p.max_quantity - (p.sold_quantity || 0)) <= 0
        }));
        
        setEditingEvent(prev => prev ? { ...prev, passes: mappedPasses } : null);
      }
    };
    
    loadPassesForEditing();
  }, [isEventDialogOpen, editingEvent?.id, language]);

  // Load passes when pass management dialog opens
  useEffect(() => {
    if (!isPassManagementDialogOpen) {
      passManagementFetchAttemptRef.current = null;
      return;
    }
    const loadPassesForManagement = async () => {
      if (isPassManagementDialogOpen && eventForPassManagement?.id) {
        if (passManagementFetchAttemptRef.current === eventForPassManagement.id) return;
        passManagementFetchAttemptRef.current = eventForPassManagement.id;
        try {
          setIsPassManagementLoading(true);
          const apiBase = getApiBaseUrl();
          const passesResponse = await fetch(`${apiBase}/api/admin/passes/${eventForPassManagement.id}`, {
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
            setPassesForManagement(passesWithStock);
          } else {
            console.error('Failed to fetch passes:', passesResponse.status);
            setPassesForManagement([]);
          }
        } catch (error) {
          console.error('Error loading passes for management:', error);
          setPassesForManagement([]);
        } finally {
          setIsPassManagementLoading(false);
        }
      } else if (!isPassManagementDialogOpen && !isEventDialogOpen) {
        // Clear passes when stock manager is not in use.
        // (Pass stock can now be managed inline inside the Edit Event dialog.)
        setPassesForManagement([]);
        setEventForPassManagement(null);
        setNewPassForm(null);
      }
    };
    
    loadPassesForManagement();
  }, [isPassManagementDialogOpen, isEventDialogOpen, eventForPassManagement?.id, language]);

  const fetchAllData = async () => {
    setLoading(true);
    const SAFETY_TIMEOUT_MS = 25000;
    const safetyTimer = window.setTimeout(() => {
      setLoading(false);
    }, SAFETY_TIMEOUT_MS);

    try {
      // Core bootstrap data in parallel to reduce initial dashboard wait.
      const [{ data: appsData, error: appsError }, { data: eventsData, error: eventsError }, { data: ambassadorsData, error: ambassadorsError }] = await Promise.all([
        supabase.from('ambassador_applications').select(APPLICATIONS_LIST_COLUMNS).order('created_at', { ascending: false }),
        supabase.from('events').select(EVENTS_ADMIN_LIST_COLUMNS).order('date', { ascending: false }),
        supabase.from('ambassadors').select(AMBASSADORS_LIST_COLUMNS).order('created_at', { ascending: false }),
      ]);

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

      if (ambassadorsError) console.error('Error fetching ambassadors:', ambassadorsError);
      else setAmbassadors(ambassadorsData || []);

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
      } else {
        const eventRows = eventsData || [];
        const eventIds = eventRows.map((event: any) => event.id).filter(Boolean);
        let passesByEventId: Record<string, any[]> = {};

        if (eventIds.length > 0) {
          const { data: allPassesData, error: passesError } = await supabase
            .from('event_passes')
            .select(
              'id, event_id, name, price, description, is_primary, sold_quantity, max_quantity, is_active, allowed_payment_methods, release_version, created_at, updated_at',
            )
            .in('event_id', eventIds)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true });

          if (passesError) {
            if (passesError.code !== 'PGRST116' && passesError.message !== 'relation "public.event_passes" does not exist') {
              console.error('Error fetching event passes:', passesError);
            }
          } else {
            for (const p of allPassesData || []) {
              const eid = p?.event_id;
              if (!eid) continue;
              if (!passesByEventId[eid]) passesByEventId[eid] = [];
              passesByEventId[eid].push({
                id: p.id,
                name: p.name || '',
                price: typeof p.price === 'number' ? p.price : (p.price ? parseFloat(p.price) : 0),
                description: p.description || '',
                is_primary: p.is_primary || false,
                sold_quantity: p.sold_quantity ?? 0
              });
            }
          }
        }

        const eventsWithPasses = eventRows.map((event: any) => ({
          ...event,
          passes: passesByEventId[event.id] || [],
        }));

        setEvents(eventsWithPasses);
      }

      // Legacy clients table has been removed; keep ambassador sales empty here.
      setAmbassadorSales({});

      // Unblock shell + overview as soon as core lists exist; settings/hero load in background.
      window.clearTimeout(safetyTimer);
      setLoading(false);

      void (async () => {
        try {
          await Promise.all([
            fetchSalesSettingsData(),
            fetchMaintenanceSettings(),
            fetchAmbassadorApplicationSettings(),
            fetchAmbassadorSelectionSettingsState(),
            fetchHeroImages(),
            fetchAboutImages(),
          ]);
        } catch (e) {
          console.warn("Secondary dashboard hydration failed:", e);
        }
      })();
      // Activity chart online series loads when `selectedEventId` is set (see dedicated effect).
      // Marketing/SMS data loads when Marketing tab is opened.
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: t.error,
        description: language === 'en' ? "Failed to load data" : "Échec du chargement des données",
        variant: "destructive",
      });
      window.clearTimeout(safetyTimer);
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
      const hashedPassword = await hashPasswordBcrypt(password, 10);

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
          title: language === 'en' ? 'âš ï¸ Email Delivery Failed' : 'âš ï¸ Échec de l\'envoi de l\'email',
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
  // Export approved ambassadors list to Excel with branded styling
  const exportApprovedAmbassadorsToExcel = async () => {
    try {
      const approvedAmbassadors = ambassadors.filter(amb => amb.status === 'approved');
      
      const workbook = await createExcelWorkbook();
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
      const count = await exportAmbassadorApplicationsListExcel({
        applications: filteredApplications,
        ambassadors,
      });

      toast({
        title: language === 'en' ? 'Export Successful' : 'Exportation réussie',
        description: language === 'en' 
          ? `Exported ${count} ambassadors to Excel`
          : `${count} ambassadeurs exportés vers Excel`,
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
        console.error('âŒ Ambassador not found for resend email:', {
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
          title: language === 'en' ? "âŒ Email Address Required" : "âŒ Adresse email requise",
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
        const hashedPassword = await hashPasswordBcrypt(password, 10);
        
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
            title: language === 'en' ? "âœ… Email Sent Successfully" : "âœ… Email envoyé avec succès",
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
            title: language === 'en' ? "âŒ Email Failed to Send" : "âŒ Échec de l'envoi de l'email",
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
          title: language === 'en' ? "âŒ Email Error" : "âŒ Erreur d'email",
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

  const commitCountdownBannerSettings = useCallback(async () => {
    try {
      await upsertCountdownBannerSettings({
        enabled: countdownBannerEnabled,
        label_en: countdownBannerLabelEn.trim() || COUNTDOWN_LABEL_DEFAULT_EN,
        label_fr: countdownBannerLabelFr.trim() || COUNTDOWN_LABEL_DEFAULT_FR,
      });
      await queryClient.invalidateQueries({ queryKey: ["site_content", COUNTDOWN_BANNER_SETTINGS_KEY] });
    } catch (error: unknown) {
      console.error("Error saving countdown banner settings:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : language === "en"
            ? "Failed to save countdown banner text"
            : "Échec de l'enregistrement du texte de la bannière";
      toast({
        title: t.error,
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [
    countdownBannerEnabled,
    countdownBannerLabelEn,
    countdownBannerLabelFr,
    language,
    queryClient,
    t.error,
  ]);

  const updateCountdownBannerSettingsData = async (enabled: boolean) => {
    setLoadingCountdownBannerSettings(true);
    try {
      await upsertCountdownBannerSettings({
        enabled,
        label_en: countdownBannerLabelEn.trim() || COUNTDOWN_LABEL_DEFAULT_EN,
        label_fr: countdownBannerLabelFr.trim() || COUNTDOWN_LABEL_DEFAULT_FR,
      });
      setCountdownBannerEnabled(enabled);
      toast({
        title: language === "en" ? "Settings updated" : "Paramètres mis à jour",
        description:
          language === "en"
            ? enabled
              ? "The countdown banner is visible on the site when events qualify."
              : "The countdown banner is hidden on the public site."
            : enabled
              ? "La bannière compte à rebours s’affiche sur le site lorsque les événements sont éligibles."
              : "La bannière compte à rebours est masquée sur le site public.",
      });
      await queryClient.invalidateQueries({ queryKey: ["site_content", COUNTDOWN_BANNER_SETTINGS_KEY] });
      const countdown = await fetchCountdownBannerSettings();
      setCountdownBannerEnabled(countdown.enabled);
      setCountdownBannerLabelEn(countdown.label_en);
      setCountdownBannerLabelFr(countdown.label_fr);
    } catch (error: unknown) {
      console.error("Error updating countdown banner settings:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : language === "en"
            ? "Failed to update settings"
            : "Échec de la mise à jour des paramètres";
      toast({
        title: t.error,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingCountdownBannerSettings(false);
    }
  };

  const updateMaintenanceSettings = async (enabled: boolean, message?: string, allowAmbassador?: boolean) => {
    setLoadingMaintenanceSettings(true);
    try {
      await upsertSiteContentViaApi('maintenance_settings', {
        enabled,
        message: message !== undefined ? message : maintenanceMessage,
        allowAmbassadorApplication: allowAmbassador !== undefined ? allowAmbassador : allowAmbassadorApplication,
      });

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

      await upsertSiteContentViaApi('ambassador_application_settings', {
        enabled,
        message: message || "",
      });
      toast({
        title: language === 'en' ? 'Settings Updated' : 'Paramètres Mis à Jour',
        description: enabled
          ? (language === 'en' ? 'Ambassador applications are now open. Users can submit applications.' : 'Les candidatures ambassadeur sont maintenant ouvertes. Les utilisateurs peuvent soumettre des candidatures.')
          : (language === 'en' ? 'Ambassador applications are now closed. Users will see the closed message.' : 'Les candidatures ambassadeur sont maintenant fermées. Les utilisateurs verront le message de fermeture.'),
      });

      setTimeout(() => {
        fetchAmbassadorApplicationSettings().catch((err) => {
          console.error('Error refreshing settings:', err);
        });
      }, 100);
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

  const updateAmbassadorCityWide = async (city: AmbassadorNeighborhoodCity, enabled: boolean) => {
    if (loadingAmbassadorSelectionSettings) return;

    setLoadingAmbassadorSelectionSettings(true);
    const previous = ambassadorSelectionSettings;

    const cityWide = { ...ambassadorSelectionSettings.cityWide };
    if (enabled) {
      cityWide[city] = true;
    } else {
      delete cityWide[city];
    }
    const nextSettings: AmbassadorSelectionSettings = { cityWide };
    setAmbassadorSelectionSettings(nextSettings);

    try {
      await upsertAmbassadorSelectionSettings(nextSettings);
      await queryClient.invalidateQueries({
        queryKey: ['site_content', AMBASSADOR_SELECTION_SETTINGS_KEY],
      });
      toast({
        title: language === 'en' ? 'Settings Updated' : 'Paramètres Mis à Jour',
        description: enabled
          ? (language === 'en'
              ? `Checkout will show all ambassadors in ${city}.`
              : `Le paiement affichera tous les ambassadeurs à ${city}.`)
          : (language === 'en'
              ? `Checkout will filter ambassadors by neighborhood in ${city}.`
              : `Le paiement filtrera les ambassadeurs par quartier à ${city}.`),
      });
    } catch (error: unknown) {
      console.error('Error updating ambassador selection settings:', error);
      setAmbassadorSelectionSettings(previous);
      toast({
        title: t.error,
        description:
          error instanceof Error
            ? error.message
            : language === 'en'
              ? 'Failed to update settings'
              : 'Échec de la mise à jour des paramètres',
        variant: 'destructive',
      });
    } finally {
      setLoadingAmbassadorSelectionSettings(false);
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

  const handleSaveEvent = async (event: Event, uploadedFile?: File | null): Promise<boolean> => {
    try {
      const isCompleted = event.event_status === 'completed';
      const effectiveEventType = isCompleted ? 'gallery' : (event.event_type || 'upcoming');

      // Gallery conversion only allowed after the event date has passed (unless admin marked completed — then gallery is allowed anytime)
      if (effectiveEventType === 'gallery' && event.date && !isCompleted) {
        const eventDate = new Date(event.date);
        const now = new Date();
        if (eventDate.getTime() > now.getTime()) {
          toast({
            title: t.error,
            description: language === 'en' 
              ? "Cannot set as gallery event until after the event date, or mark the event as Completed." 
              : "Impossible de passer en galerie avant la date de l'événement, ou marquez l'événement comme Terminé.",
            variant: "destructive",
          });
          return false;
        }
      }
      // Pass management is now handled separately via Pass Stock Management dialog
      // No pass validation or saving needed here - passes are managed independently

      let posterUrl = event.poster_url;
      let seatingChartUrl = event.seating_chart_url?.trim() || null;

      // Upload image if file is provided
      if (uploadedFile) {
        setUploadingImage(true);
        const { optimizeImageToWebp } = await loadHeroMediaPreprocess();
        const optimizedPoster = await optimizeImageToWebp(uploadedFile, { maxEdge: 1920, quality: 0.84 });
        const uploadResult = await uploadImage(optimizedPoster, 'posters');
        
        if (uploadResult.error) {
          toast({
            title: t.error,
            description: language === 'en' ? `Failed to upload image: ${uploadResult.error}` : `Échec du téléchargement: ${uploadResult.error}`,
            variant: "destructive",
          });
          setUploadingImage(false);
          return false;
        }
        
        posterUrl = uploadResult.url;
        setUploadingImage(false);
      }

      if (event._uploadSeatingChartFile) {
        setUploadingImage(true);
        const { optimizeImageToWebp } = await loadHeroMediaPreprocess();
        const optimizedSeating = await optimizeImageToWebp(event._uploadSeatingChartFile, { maxEdge: 1920, quality: 0.84 });
        const seatingUpload = await uploadImage(optimizedSeating, 'seating-charts');
        if (seatingUpload.error) {
          toast({
            title: t.error,
            description: language === 'en' ? `Failed to upload seating plan: ${seatingUpload.error}` : `Échec du téléchargement du plan de salle: ${seatingUpload.error}`,
            variant: "destructive",
          });
          setUploadingImage(false);
          return false;
        }
        seatingChartUrl = seatingUpload.url;
        setUploadingImage(false);
      }

      // Upload pending gallery files if event is gallery type
      let finalGalleryImages = event.gallery_images || [];
      let finalGalleryVideos = event.gallery_videos || [];
      
      if (effectiveEventType === 'gallery') {
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
          return false;
        } finally {
          setUploadingGallery(false);
        }
      }

      let eventId = event.id;
      let newEventData: any = null; // Declare outside if/else block for scope access

      const dateRaw = event.date?.trim() ?? "";
      if (!dateRaw) {
        toast({
          title: t.error,
          description:
            language === "en"
              ? "Event date is required."
              : "La date de l'événement est requise.",
          variant: "destructive",
        });
        return false;
      }
      const eventDate = fromDatetimeLocalToIso(dateRaw);
      if (!eventDate) {
        toast({
          title: t.error,
          description:
            language === "en"
              ? "Invalid event date. Use the date picker or correct the value."
              : "Date d'événement invalide. Utilisez le sélecteur ou corrigez la valeur.",
          variant: "destructive",
        });
        return false;
      }

      const rawStatus = event.event_status;
      const normalizedEventStatus =
        rawStatus === 'completed' || rawStatus === 'cancelled' || rawStatus === 'active'
          ? rawStatus
          : 'active';

      const eventPayload = {
        name: event.name,
        date: eventDate,
        venue: event.venue,
        city: event.city,
        description: event.description,
        poster_url: posterUrl,
        seating_chart_url: seatingChartUrl,
        event_status: normalizedEventStatus,
        event_type: effectiveEventType,
        gallery_images: finalGalleryImages,
        gallery_videos: finalGalleryVideos,
        presale_enabled: !!event.presale_enabled,
        presale_active_from: null,
        presale_active_until: null,
        presale_hide_from_public_list: !!event.presale_enabled,
      };

      if (event.id) {
        const r = await apiFetch(API_ROUTES.ADMIN_EVENT(event.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: eventPayload })
        });
        const result = await r.json().catch(() => ({}));
        if (!r.ok) {
          const apiMsg = [
            typeof result?.details === 'string' ? result.details : '',
            typeof result?.error === 'string' ? result.error : '',
            typeof result?.message === 'string' ? result.message : '',
          ]
            .filter(Boolean)
            .join(' — ');
          throw new Error(apiMsg || 'Failed to update event');
        }
        newEventData = result?.data || null;
        eventId = event.id;
      } else {
        const r = await apiFetch(API_ROUTES.ADMIN_EVENTS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: eventPayload })
        });
        const result = await r.json().catch(() => ({}));
        if (!r.ok) {
          const apiMsg = [
            typeof result?.details === 'string' ? result.details : '',
            typeof result?.error === 'string' ? result.error : '',
            typeof result?.message === 'string' ? result.message : '',
          ]
            .filter(Boolean)
            .join(' — ');
          throw new Error(apiMsg || 'Failed to create event');
        }
        newEventData = result?.data || null;
        eventId = newEventData?.id;
      }

      // At this point, the event is successfully saved to the database
      // Show success immediately and update UI optimistically
      toast({
        title: t.eventSaved,
        description: language === 'en' ? "Event saved successfully" : "Événement enregistré avec succès",
      });

      // Update local state immediately for instant UI feedback
      if (event.id) {
        // Update existing event in the list
        const persistedDate = newEventData?.date ?? eventDate;
        setEvents(prev => prev.map(e => 
          e.id === event.id
            ? { 
                ...e, 
                ...event, 
                poster_url: posterUrl,
                seating_chart_url: seatingChartUrl,
                date: persistedDate,
                // Keep existing passes (not modified in edit dialog)
                gallery_images: finalGalleryImages,
                gallery_videos: finalGalleryVideos,
                event_status: normalizedEventStatus,
                event_type: effectiveEventType,
                presale_enabled: !!event.presale_enabled,
                presale_active_from: null,
                presale_active_until: null,
                presale_hide_from_public_list: !!event.presale_enabled,
                updated_at: new Date().toISOString() 
              }
            : e
        ));
      } else {
        // For new events, use the data returned from database and add gallery
        const newEvent: Event = {
          ...(newEventData || {}),
          passes: [], // Passes will be created via Pass Stock Management dialog
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
      
      // Post-save operations (cache invalidation and refresh) - wrap in try-catch
      // These should not trigger the main error handler since the save already succeeded
      try {
        // Invalidate events cache so frontend shows updated data
        invalidateEvents();
        
        // Refresh all data to ensure consistency (but don't wait for it to close dialog)
        // The optimistic update above already shows the event immediately
        fetchAllData().catch(err => {
          console.error('Error refreshing data after save:', err);
          // If refresh fails, the optimistic update is still there, so UI is fine
        });
      } catch (postSaveError) {
        // Log post-save errors but don't show error toast since save already succeeded
        console.error('Error in post-save operations (cache invalidation):', postSaveError);
        // Silently fail - the event is already saved and shown in UI
      }

      return true;
    } catch (error) {
      const description = errorToUserMessage(error).trim();
      console.error('Error saving event:', error);
      toast({
        title: t.error,
        description:
          description ||
          (language === 'en' ? "Failed to save event" : "Échec de l'enregistrement"),
        variant: "destructive",
      });
      return false;
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
            title: language === 'en' ? 'âš ï¸ Partial Update' : 'âš ï¸ Mise à Jour Partielle',
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

      // Update local state for ambassadors (no full refresh needed)
      setAmbassadors(prev => prev.map(amb => 
        amb.id === ambassador.id 
          ? { ...amb, status: newStatus }
          : amb
      ));

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

        const primaryVille =
          ambassador.city === 'Sousse' || ambassador.city === 'Tunis'
            ? ambassador.ville?.trim() || null
            : null;

        // Update existing ambassador
        const updateData: any = {
            full_name: ambassador.full_name,
            phone: ambassador.phone,
            email: ambassador.email,
            city: ambassador.city,
            ville: primaryVille,
            extra_villes:
              ambassador.city === 'Sousse' || ambassador.city === 'Tunis'
                ? normalizeExtraVilles({
                    primaryVille,
                    extraVilles: ambassador.extra_villes,
                    allowedVilles: getAllowedVillesForCity(ambassador.city),
                  })
                : [],
            status: ambassador.status,
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
          updateData.password = await hashPasswordBcrypt(ambassador.password, 10);
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
        social_link?: string;
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
      const hashedPassword = await hashPasswordBcrypt(password, 10);

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
          title: language === 'en' ? "âœ… Ambassador Added Successfully" : "âœ… Ambassadeur ajouté avec succès",
          description: language === 'en' 
            ? `Ambassador created and approval email sent to ${newAmbassadorForm.email}`
            : `Ambassadeur créé et email d'approbation envoyé à ${newAmbassadorForm.email}`,
        });
      } else {
        toast({
          title: language === 'en' ? "Ambassador Added" : "Ambassadeur ajouté",
          description: emailError || (language === 'en' 
            ? "Ambassador created, but email failed to send. Use 'Resend Email' button to retry."
            : "Ambassadeur créé, mais l'e-mail n'a pas pu être envoyé. Utilisez le bouton 'Renvoyer e-mail' pour réessayer."),
          variant: "default",
        });
        toast({
          title: language === 'en' ? 'Email Delivery Failed' : "Échec de l'envoi de l'e-mail",
          description: language === 'en' 
            ? `The approval email could not be sent to ${newAmbassadorForm.email}. Please use the 'Resend Email' button to retry.`
            : `L'e-mail d'approbation n'a pas pu être envoyé à ${newAmbassadorForm.email}. Veuillez utiliser le bouton 'Renvoyer e-mail' pour réessayer.`,
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
        social_link: '',
        motivation: ''
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
      const r = await apiFetch(API_ROUTES.ADMIN_EVENT(eventToDelete.id), { method: 'DELETE' });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(result?.details || result?.error || 'Failed to delete event');
      }

      // Update local state immediately for instant UI feedback
      setEvents(prev => prev.filter(e => e.id !== eventToDelete.id));

      // Invalidate events cache so frontend shows updated data
      invalidateEvents();
      
      toast({
        title: language === 'en' ? "Event deleted" : "Événement supprimé",
        description: language === 'en' ? "Event deleted successfully" : "Événement supprimé avec succès",
      });

      // Refresh all data to ensure consistency
      await fetchAllData();

    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: t.error,
        description: (error as any)?.message || (language === 'en' ? 'Failed to delete event' : 'Échec de la suppression'),
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

  const handleBulkPauseAmbassadors = async (ambassadorsToPause: Ambassador[]) => {
    if (ambassadorsToPause.length === 0) return;
    setBulkAmbassadorProcessing(true);
    try {
      for (const ambassador of ambassadorsToPause) {
        // Only pause currently approved ambassadors
        if (ambassador.status === "approved") {
          await handleToggleAmbassadorStatus(ambassador);
        }
      }
    } finally {
      setBulkAmbassadorProcessing(false);
    }
  };

  const handleBulkDeleteAmbassadors = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBulkAmbassadorProcessing(true);
    try {
      for (const id of ids) {
        await handleDeleteAmbassador(id);
      }
    } finally {
      setBulkAmbassadorProcessing(false);
    }
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
    try {
      let saved;
      if (isNew) {
        const result = await adminApi.createSponsor(sponsorData);
        saved = result.data;
        sponsorId = saved.id;
        setSponsors((prev) =>
          [...prev, { ...sponsorData, id: sponsorId, created_at: new Date().toISOString() }].sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          )
        );
      } else {
        const result = await adminApi.updateSponsor(sponsorId, sponsorData);
        saved = result.data;
        setSponsors((prev) =>
          prev.map((s) =>
            s.id === sponsorId ? { ...s, ...sponsorData, updated_at: new Date().toISOString() } : s
          )
        );
      }
      closeSponsorDialog();
      toast({
        title: language === 'en' ? 'Sponsor saved' : 'Sponsor enregistré',
        description: language === 'en' ? 'Sponsor details updated successfully.' : 'Détails du sponsor mis à jour avec succès.',
      });
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
      
      await adminApi.deleteSponsor(sponsorIdToDelete);
      
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
        logAdminAction({ adminId: currentAdminId, adminName: currentAdminName || 'Unknown', adminEmail: currentAdminEmail, action: 'admin.logout' }).catch(() => {});
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
      'EXPIRED': {
        color: '#2563EB',
        bgColor: 'rgba(37, 99, 235, 0.15)',
        textColor: '#2563EB',
        label: language === 'en' ? 'Expired' : 'Expiré'
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
    
    const { optimizeImageToWebp, transcodeHeroVideoToMp4 } = await loadHeroMediaPreprocess();

    for (const file of files) {
      const optimizedFile =
        type === 'images'
          ? await optimizeImageToWebp(file, { maxEdge: 1920, quality: 0.84 })
          : await transcodeHeroVideoToMp4(file);
      const uploadResult = await uploadImage(optimizedFile, 'gallery');
      
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
    if (!authReady || !canAccessTab('sponsors')) return;
    adminApi
      .listSponsors()
      .then((result) => setSponsors(result.data || []))
      .catch((err) => console.error('Error fetching sponsors:', err));
  }, [authReady, allowedTabs, canAccessTab]);

  useEffect(() => {
    if (!authReady || !canAccessTab('team')) return;
    adminApi
      .listTeamMembers()
      .then((result) => setTeamMembers(result.data || []))
      .catch((err) => console.error('Error fetching team members:', err));
  }, [authReady, allowedTabs, canAccessTab]);

  const fetchConsultationInquiries = useCallback(async () => {
    try {
      const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_CONSULTATION_INQUIRIES, getApiBaseUrl());
      if (!apiUrl) return;
      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) return;
      const json = await response.json();
      if (json?.success && Array.isArray(json.data)) {
        setConsultationInquiries(json.data);
      }
    } catch {
      // Keep UI silent to avoid noisy toasts during background polling.
    }
  }, []);

  // Load contact / B2B leads / suggestions only when their tab is opened (keeps initial dashboard light).
  useEffect(() => {
    if (activeTab === "contact" && contactMessages.length === 0) {
      void (async () => {
        const { data, error } = await supabase
          .from("contact_messages")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data) setContactMessages(data);
      })();
    }
    if (activeTab === "consultation-inquiries" && consultationInquiries.length === 0) {
      void fetchConsultationInquiries();
    }
    if (activeTab === "suggestions" && suggestions.length === 0) {
      void (async () => {
        const { data, error } = await (supabase as any)
          .from("audience_suggestions")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data) setSuggestions(data);
      })();
    }
  }, [
    activeTab,
    contactMessages.length,
    consultationInquiries.length,
    suggestions.length,
    fetchConsultationInquiries,
  ]);

  // Mark suggestion as read when detail is opened
  useEffect(() => {
    if (!selectedSuggestion || selectedSuggestion.read_at) return;
    const id = selectedSuggestion.id;
    const readAt = new Date().toISOString();
    (async () => {
      const { error } = await (supabase as any).from('audience_suggestions').update({ read_at: readAt }).eq('id', id);
      if (!error) {
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, read_at: readAt } : s));
        setSelectedSuggestion((prev: any) => prev && prev.id === id ? { ...prev, read_at: readAt } : prev);
      }
    })();
  }, [selectedSuggestion?.id]);

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
    try {
      if (isNew) {
        const result = await adminApi.createTeamMember(teamData);
        teamMemberId = result.data.id;
        setTeamMembers((prev) =>
          [...prev, { ...teamData, id: teamMemberId, created_at: new Date().toISOString() }].sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          )
        );
      } else {
        await adminApi.updateTeamMember(teamMemberId, teamData);
        setTeamMembers((prev) =>
          prev.map((m) =>
            m.id === teamMemberId ? { ...m, ...teamData, updated_at: new Date().toISOString() } : m
          )
        );
      }
      closeTeamDialog();
      toast({
        title: language === 'en' ? 'Team member saved' : 'Membre enregistré',
        description: language === 'en' ? 'Team member details updated successfully.' : 'Détails du membre mis à jour avec succès.',
      });
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
      
      await adminApi.deleteTeamMember(memberIdToDelete);
      
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

  const openDeleteSuggestionDialog = (s: any) => {
    setSuggestionToDelete(s);
    setIsDeleteSuggestionDialogOpen(true);
  };
  const closeDeleteSuggestionDialog = () => {
    setSuggestionToDelete(null);
    setIsDeleteSuggestionDialogOpen(false);
  };
  const handleDeleteSuggestion = async () => {
    if (!suggestionToDelete) return;
    try {
      const id = suggestionToDelete.id;
      const { error } = await (supabase as any).from('audience_suggestions').delete().eq('id', id);
      if (error) throw error;
      setSuggestions(prev => prev.filter(s => s.id !== id));
      if (selectedSuggestion?.id === id) setSelectedSuggestion(null);
      closeDeleteSuggestionDialog();
      toast({
        title: language === 'en' ? 'Suggestion deleted' : 'Suggestion supprimée',
        description: language === 'en' ? 'Suggestion removed successfully.' : 'Suggestion supprimée avec succès.',
      });
    } catch (err: any) {
      toast({
        title: t.error,
        description: err.message || (language === 'en' ? 'Failed to delete suggestion.' : 'Échec de la suppression.'),
        variant: 'destructive',
      });
    }
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

  // Reports tab handlers (placeholder for now)
  const openTicketDialog = (ticket = null) => {
    toast({
      title: 'Coming Soon',
      description: 'Reports will be available once the database table is created.',
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

  // Add JWT expiration handling
  useEffect(() => {
    const handleApiError = (response: Response) => {
      if (response.status === 401) {
        if (suppress401Until && Date.now() < suppress401Until) {
          return true; // Don't redirect yet
        }
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
        const now = Date.now();
        const willSuppress = !!(suppress401Until && now < suppress401Until);

        // During warm-up, avoid user-facing "Not authenticated" toasts by rewriting
        // suppressed 401 responses into a benign 200 with empty list payloads.
        if (willSuppress) {
          const reqUrlForRewrite =
            typeof args[0] === "string"
              ? args[0]
              : (args[0] as any)?.url
                ? String((args[0] as any).url)
                : "unknown";

          // Do not rewrite verify-admin: we need real 401s so the session timer
          // can be initialized via retries when the cookie becomes available.
          const isVerifyAdmin = reqUrlForRewrite.includes("/api/verify-admin");
          if (!isVerifyAdmin) {
            return new Response(
              JSON.stringify({
                success: false,
                valid: false,
                error: "Warm-up 401 suppressed",
                data: [],
                count: 0,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
        }
        handleApiError(response);
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [navigate, toast, language, suppress401Until]);

  // Mobile nav drawer open state (must be before any conditional return to satisfy Rules of Hooks)
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Mobile: regular admin = allowed-tab subset; super_admin = full nav (sheet + bottom bar subsets)
  const mobileAllowedTabs = useMemo(() => allowedTabs, [allowedTabs]);

  // On mobile, if current tab is not allowed, switch to first allowed tab
  useEffect(() => {
    if (isMobile && activeTab && !mobileAllowedTabs.includes(activeTab)) {
      setActiveTab(mobileAllowedTabs[0] ?? "overview");
    }
  }, [isMobile, activeTab, mobileAllowedTabs]);

  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollToTop();
    const t = window.setTimeout(scrollToTop, 0);
    const raf = requestAnimationFrame(scrollToTop);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [activeTab]);

  const isTabAllowedOnMobile = (tab: string) => mobileAllowedTabs.includes(tab);

  const handleMobileNavSelect = (tab: string) => {
    if (!isTabAllowedOnMobile(tab)) return;
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  // Mobile bottom nav: prefetch data when switching to tabs that rely on it
  const handleBottomNavSelect = (tab: string) => {
    if (tab === "logout") {
      handleLogout();
      return;
    }
    if (!isTabAllowedOnMobile(tab)) return;
    if (tab === "online-orders" && onlineOrders.length === 0) fetchOnlineOrders();
    if (tab === "ambassador-sales" && codAmbassadorOrders.length === 0) fetchAmbassadorSalesData();
    if (tab === "marketing") {
      if (phoneSubscribers.length === 0) void fetchPhoneSubscribers();
      if (smsLogs.length === 0) void fetchSmsLogs();
    }
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const mobileBottomTabs = [
    ...getMobileBottomTabItems(allowedTabs, t, language),
    { key: "logout", label: t.logout, icon: LogOutIcon },
  ].filter((tab) => tab.key === "logout" || isTabAllowedOnMobile(tab.key));

  if (!authReady) {
    return <LoadingScreen />;
  }

  return (
    <div
      data-admin-dashboard="true"
      className={cn(
        "min-h-screen min-w-0",
        // Site Navigation is fixed h-16 (z-50); match desktop offset to navbar height.
        isMobile ? "pt-14 pb-24" : "pt-16",
      )}
      style={{ backgroundColor: 'hsl(var(--background))' }}
    >
      {/* Mobile top bar */}
      {isMobile && (
        <header
          className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-2 px-3 sm:px-4 h-14 border-b shrink-0"
          style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="hidden"
            onClick={handleLogout}
            aria-label={language === 'en' ? 'Logout' : 'Déconnexion'}
          >
            <LogOut className="w-5 h-5 shrink-0" style={{ color: '#E21836' }} />
            <span className="text-sm font-medium" style={{ color: '#E21836' }}>
              {language === 'en' ? 'Logout' : 'Déconnexion'}
            </span>
          </Button>
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-2 py-1">
            <span className="w-full truncate text-center text-sm font-medium text-foreground">
              {activeTab === "overview" && t.overview}
              {activeTab === "events" && t.events}
              {activeTab === "ambassadors" && t.ambassadors}
              {activeTab === "applications" && t.applications}
              {activeTab === "online-orders" && (language === 'en' ? 'Online Orders' : 'Commandes en Ligne')}
              {activeTab === "ambassador-sales" && (language === 'en' ? 'Ambassador Sales' : 'Ventes Ambassadeurs')}
              {activeTab === "pos" && (language === 'en' ? 'Point de Vente' : 'Point de Vente')}
              {activeTab === "scanners" && (language === 'en' ? 'Scanners' : 'Scanners')}
              {activeTab === "tickets" && (language === 'en' ? 'Reports' : 'Rapports')}
              {activeTab === "marketing" && 'SMS - E-mail'}
              {activeTab === "settings" && t.settings}
              {activeTab === "consultation-inquiries" && (language === 'en' ? 'B2B Leads' : 'B2B Leads')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-muted-foreground">
            <AdminSessionCountdown
              session={sessionCountdown}
              language={language}
              suppress401Until={suppress401Until > 0 ? suppress401Until : null}
              variant="mobile"
            />
          </div>
        </header>
      )}

      {isMobile && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-sm"
          aria-label={language === 'en' ? 'Dashboard navigation' : 'Navigation du tableau de bord'}
        >
          <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 scrollbar-hide">
            {mobileBottomTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleBottomNavSelect(tab.key)}
                  className={cn(
                    "flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2.5 py-2 transition-colors",
                    isActive
                      ? "bg-muted/60 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile nav Sheet */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-[260px] flex-col border-r p-0">
          <SheetHeader className="border-b border-border/60 px-4 py-3 text-left">
            <SheetTitle className="text-base font-semibold">
              {language === 'en' ? 'Menu' : 'Menu'}
            </SheetTitle>
          </SheetHeader>
          <nav className="admin-nav-scrollbar flex-1 overflow-y-auto px-2 py-2">
            <div className="space-y-1">
              {isTabAllowedOnMobile("overview") && (
                <AdminSidebarNavItem
                  active={activeTab === "overview"}
                  onClick={() => handleMobileNavSelect("overview")}
                  icon={BarChart3}
                  label={t.overview}
                />
              )}
              {isTabAllowedOnMobile("events") && (
                <AdminSidebarNavItem
                  active={activeTab === "events"}
                  onClick={() => handleMobileNavSelect("events")}
                  icon={CalendarIcon}
                  label={t.events}
                />
              )}
              {isTabAllowedOnMobile("ambassadors") && (
                <AdminSidebarNavItem
                  active={activeTab === "ambassadors"}
                  onClick={() => handleMobileNavSelect("ambassadors")}
                  icon={Users}
                  label={t.ambassadors}
                />
              )}
              {isTabAllowedOnMobile("applications") && (
                <AdminSidebarNavItem
                  active={activeTab === "applications"}
                  onClick={() => handleMobileNavSelect("applications")}
                  icon={FileText}
                  label={t.applications}
                />
              )}
              {isTabAllowedOnMobile("careers") && (
                <AdminSidebarNavItem
                  active={activeTab === "careers"}
                  onClick={() => handleMobileNavSelect("careers")}
                  icon={Briefcase}
                  label={language === 'en' ? 'Careers' : 'Carrières'}
                />
              )}
              {isTabAllowedOnMobile("academy") && (
                <AdminSidebarNavItem
                  active={activeTab === "academy"}
                  onClick={() => handleMobileNavSelect("academy")}
                  icon={GraduationCap}
                  label="Academy"
                />
              )}
              {isTabAllowedOnMobile("online-orders") && (
                <AdminSidebarNavItem
                  active={activeTab === "online-orders"}
                  onClick={() => {
                    handleMobileNavSelect("online-orders");
                    if (onlineOrders.length === 0) fetchOnlineOrders();
                  }}
                  icon={CreditCard}
                  label={language === 'en' ? 'Online Orders' : 'Commandes en Ligne'}
                />
              )}
              {isTabAllowedOnMobile("ambassador-sales") && (
                <AdminSidebarNavItem
                  active={activeTab === "ambassador-sales"}
                  onClick={() => {
                    handleMobileNavSelect("ambassador-sales");
                    if (codAmbassadorOrders.length === 0) fetchAmbassadorSalesData();
                  }}
                  icon={Package}
                  label={language === 'en' ? 'Ambassador Sales' : 'Ventes Ambassadeurs'}
                />
              )}
              {isTabAllowedOnMobile("pos") && (
                <AdminSidebarNavItem
                  active={activeTab === "pos"}
                  onClick={() => handleMobileNavSelect("pos")}
                  icon={Store}
                  label={language === 'en' ? 'Point de Vente' : 'Point de Vente'}
                />
              )}
              {isTabAllowedOnMobile("scanners") && canAccessTab("scanners") && (
                <AdminSidebarNavItem
                  active={activeTab === "scanners"}
                  onClick={() => handleMobileNavSelect("scanners")}
                  icon={QrCode}
                  label={language === 'en' ? 'Scanners' : 'Scanners'}
                />
              )}
              {isTabAllowedOnMobile("settings") && canAccessTab("settings") && (
                <AdminSidebarNavItem
                  active={activeTab === "settings"}
                  onClick={() => handleMobileNavSelect("settings")}
                  icon={Settings}
                  label={t.settings}
                />
              )}
              {isTabAllowedOnMobile("official-invitations") && canAccessTab("official-invitations") && (
                <AdminSidebarNavItem
                  active={activeTab === "official-invitations"}
                  onClick={() => handleMobileNavSelect("official-invitations")}
                  icon={Mail}
                  label={language === 'en' ? 'Official Invitations' : 'Invitations Officielles'}
                />
              )}
              {isTabAllowedOnMobile("tickets") && (
                <AdminSidebarNavItem
                  active={activeTab === "tickets"}
                  onClick={() => handleMobileNavSelect("tickets")}
                  icon={DollarSign}
                  label={language === 'en' ? 'Reports' : 'Rapports'}
                />
              )}
              {isTabAllowedOnMobile("marketing") && canAccessTab("marketing") && (
                <AdminSidebarNavItem
                  active={activeTab === "marketing"}
                  onClick={() => {
                    handleMobileNavSelect("marketing");
                    if (phoneSubscribers.length === 0) void fetchPhoneSubscribers();
                    if (smsLogs.length === 0) void fetchSmsLogs();
                  }}
                  icon={Megaphone}
                  label="SMS - E-mail"
                />
              )}
            </div>
          </nav>
          {currentAdminRole !== 'super_admin' && (
            <div className="border-t border-border/60 px-2 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                <span>{t.logout}</span>
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <div className="flex">
        <AdminDesktopSidebarRail
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentAdminRole={currentAdminRole}
          language={language}
          t={t}
          canAccessTab={canAccessTab}
          onlineOrdersCount={onlineOrders.length}
          fetchOnlineOrders={fetchOnlineOrders}
          codAmbassadorOrdersCount={codAmbassadorOrders.length}
          fetchAmbassadorSalesData={fetchAmbassadorSalesData}
          phoneSubscribersCount={phoneSubscribers.length}
          fetchPhoneSubscribers={fetchPhoneSubscribers}
          smsLogsCount={smsLogs.length}
          fetchSmsLogs={fetchSmsLogs}
          consultationInquiriesCount={consultationInquiries.length}
          fetchConsultationInquiries={fetchConsultationInquiries}
          logsCount={logs.length}
          fetchLogs={fetchLogs}
          handleLogout={handleLogout}
        />

                {/* Main Content - overflow hidden to prevent horizontal scroll on mobile */}
        <div className="flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 min-w-0">
            {/* Header - hidden on mobile (shown in top bar) */}
            <div className="mb-6 min-w-0 sm:mb-8">
              {!isMobile && (
                <AdminDashboardHeader
                  language={language}
                  title={t.title}
                  subtitle={t.subtitle}
                  session={sessionCountdown}
                  suppress401Until={suppress401Until > 0 ? suppress401Until : null}
                />
              )}
              
              {/* Event filter + toolbar utilities */}
              <div className="admin-dashboard-toolbar w-full min-w-0 rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {language === "en" ? "Event" : "Événement"}
                    </p>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      {selectableDashboardEvents.length === 0 ? (
                        <span
                          id="event-selector"
                          className="inline-flex h-9 min-w-0 items-center truncate rounded-md border border-border bg-background px-3 text-sm text-muted-foreground"
                        >
                          {language === "en" ? "No events" : "Aucun événement"}
                        </span>
                      ) : (
                        <Select
                          value={selectedEventId}
                          onValueChange={setSelectedEventId}
                        >
                          <SelectTrigger
                            id="event-selector"
                            className="h-9 w-full min-w-0 bg-background text-sm sm:max-w-lg"
                          >
                            <SelectValue
                              placeholder={
                                language === "en"
                                  ? "Select event"
                                  : "Choisir un événement"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent
                            className="admin-event-select-content z-[100]"
                            viewportClassName="!w-auto min-w-[var(--radix-select-trigger-width)] max-w-[min(100vw-2rem,28rem)] !h-auto max-h-[min(24rem,calc(100vh-8rem))]"
                          >
                            {selectableDashboardEvents.map((event) => {
                              const eventName = `${event.name}${event.is_test ? " (test)" : ""}`
                              const eventDate = formatDateDMY(event.date, language)
                              return (
                                <SelectItem
                                  key={event.id}
                                  value={event.id}
                                  textValue={`${eventName} — ${eventDate}`}
                                  className="admin-event-select-item py-2 pl-9 pr-3 data-[highlighted]:bg-muted data-[state=checked]:bg-muted focus:bg-muted"
                                >
                                  <span className="flex min-w-0 items-baseline gap-2 text-left">
                                    <span className="min-w-0 truncate leading-snug">
                                      {eventName}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {eventDate}
                                    </span>
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      )}
                      {selectedEventId && selectableDashboardEvents.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            fetchAllData();
                            fetchAmbassadorSalesData();
                            fetchOnlineOrders();
                            void fetchPosOrdersForOverview();
                          }}
                          className="h-9 w-full shrink-0 justify-center gap-1.5 text-xs sm:w-auto sm:min-w-[6.5rem]"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          {language === "en" ? "Reload" : "Actualiser"}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-border/50 pt-3 lg:border-t-0 lg:pt-0">
                    <AdminNotificationPanel
                      language={language}
                      notifications={notifications}
                      unreadCount={unreadNotifications}
                      soundEnabled={soundEnabled}
                      onSoundChange={(next) => {
                        setSoundEnabled(next);
                        if (typeof window !== "undefined") {
                          try {
                            window.localStorage.setItem(
                              "adminNotificationSoundEnabled",
                              String(next),
                            );
                          } catch {
                            // ignore storage errors
                          }
                        }
                      }}
                      onMarkAllRead={() => setUnreadNotifications(0)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs Content — skeleton until core lists (events, applications, ambassadors) are ready */}
            {loading ? (
              <div className="space-y-6 py-8" aria-busy="true">
                <Skeleton className="h-36 w-full max-w-3xl rounded-xl" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
                <Skeleton className="h-72 w-full rounded-xl" />
              </div>
            ) : (
            <Tabs 
              value={activeTab} 
              onValueChange={(value) => {
                // On mobile, only allow mobile-allowed tabs
                if (isMobile && !mobileAllowedTabs.includes(value)) return;
                if (!canAccessTab(value)) return;
                setActiveTab(value);
              }} 
              className="space-y-6 min-w-0"
            >
              <TabsContent value="overview" className="space-y-6 mt-8 sm:mt-0">
                <OverviewTab
                  language={language}
                  t={t}
                  applications={applications}
                  pendingApplications={pendingApplications}
                  approvedCount={approvedCount}
                  events={events}
                  displayStats={dashboardOrderStats}
                  showFinancialKpis={isSuperAdmin}
                  adminName={currentAdminName}
                  pendingAmbassadorOrdersCount={pendingAmbassadorOrdersCount}
                  previousPendingAmbassadorOrdersCount={previousPendingAmbassadorOrdersCount}
                  activityChartData={activityChartData}
                  setActiveTab={setActiveTab}
                  getStatusBadge={getStatusBadge}
                />
              </TabsContent>

              {canAccessTab("events") && activeTab === "events" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyEventsTab
                language={language}
                t={t}
                events={events}
                editingEvent={editingEvent}
                setEditingEvent={setEditingEvent}
                isEventDialogOpen={isEventDialogOpen}
                setIsEventDialogOpen={setIsEventDialogOpen}
                eventSaveBusy={uploadingImage || uploadingGallery}
                pendingGalleryImages={pendingGalleryImages}
                setPendingGalleryImages={setPendingGalleryImages}
                pendingGalleryVideos={pendingGalleryVideos}
                setPendingGalleryVideos={setPendingGalleryVideos}
                passValidationErrors={passValidationErrors}
                setPassValidationErrors={setPassValidationErrors}
                handleSaveEvent={handleSaveEvent}
                handleGalleryFileSelect={handleGalleryFileSelect}
                removeGalleryFile={removeGalleryFile}
                removePendingGalleryFile={removePendingGalleryFile}
                isPassManagementDialogOpen={isPassManagementDialogOpen}
                setIsPassManagementDialogOpen={setIsPassManagementDialogOpen}
                eventForPassManagement={eventForPassManagement}
                setEventForPassManagement={setEventForPassManagement}
                passesForManagement={passesForManagement}
                setPassesForManagement={setPassesForManagement}
                selectedPassForSettings={selectedPassForSettings}
                setSelectedPassForSettings={setSelectedPassForSettings}
                newPassForm={newPassForm}
                setNewPassForm={setNewPassForm}
                setConfirmDelete={setConfirmDelete}
                isPassManagementLoading={isPassManagementLoading}
                setIsPassManagementLoading={setIsPassManagementLoading}
                handleDeleteEvent={handleDeleteEvent}
                  />
                </Suspense>
              )}

              {/* Admins Management Tab */}
              {canAccessTab("admins") && (
                <TabsContent value="admins" className="space-y-6">
                  {activeTab === "admins" && (
                    <Suspense fallback={adminTabSuspenseFallback}>
                      <LazyAdminsTab
                    language={language}
                    admins={admins}
                    newAdminData={newAdminData}
                    setNewAdminData={setNewAdminData}
                    isAddAdminDialogOpen={isAddAdminDialogOpen}
                    setIsAddAdminDialogOpen={setIsAddAdminDialogOpen}
                    isEditAdminDialogOpen={isEditAdminDialogOpen}
                    setIsEditAdminDialogOpen={setIsEditAdminDialogOpen}
                    editingAdmin={editingAdmin}
                    setEditingAdmin={setEditingAdmin}
                    processingId={processingId}
                    currentAdminId={currentAdminId}
                    adminLogs={adminLogs}
                    loadingAdminLogs={loadingAdminLogs}
                    onAddAdmin={handleAddAdmin}
                    onEditAdmin={handleEditAdmin}
                    onDeleteAdmin={handleDeleteAdmin}
                      />
                    </Suspense>
                  )}
                </TabsContent>
              )}

              {/* Official Invitations Tab */}
              {canAccessTab("official-invitations") && activeTab === "official-invitations" && (
                  <Suspense fallback={adminTabSuspenseFallback}>
                    <LazyOfficialInvitationsTab language={language} selectedEventId={selectedEventId || undefined} />
                  </Suspense>
              )}
              {canAccessTab("scanners") && (
                <TabsContent value="scanners" className="space-y-6">
                  {activeTab === "scanners" && (
                    <Suspense fallback={adminTabSuspenseFallback}>
                      <LazyScannersTab language={language} selectedEventId={selectedEventId || undefined} />
                    </Suspense>
                  )}
                </TabsContent>
              )}

              <TabsContent value="pos" className="space-y-6">
              {activeTab === "pos" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyPosTab
                language={language}
                selectedEventId={selectedEventId || undefined}
                isSuperAdmin={isSuperAdmin}
                  />
                </Suspense>
              )}
              </TabsContent>

              {/* Ambassadors Tab */}
              {activeTab === "ambassadors" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyAmbassadorsTab
                language={language}
                t={t}
                ambassadors={ambassadors}
                editingAmbassador={editingAmbassador}
                setEditingAmbassador={setEditingAmbassador}
                newAmbassadorForm={newAmbassadorForm}
                setNewAmbassadorForm={setNewAmbassadorForm}
                ambassadorErrors={ambassadorErrors}
                setAmbassadorErrors={setAmbassadorErrors}
                isAmbassadorDialogOpen={isAmbassadorDialogOpen}
                setIsAmbassadorDialogOpen={setIsAmbassadorDialogOpen}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                processingId={processingId}
                onExportExcel={exportApprovedAmbassadorsToExcel}
                onSaveAmbassador={handleSaveAmbassador}
                onToggleStatus={handleToggleAmbassadorStatus}
                onRequestDelete={setAmbassadorToDelete}
                onBulkPause={handleBulkPauseAmbassadors}
                onBulkDelete={handleBulkDeleteAmbassadors}
                  />
                </Suspense>
              )}

              {/* Applications Tab */}
              {activeTab === "applications" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyApplicationsTab
                language={language}
                t={t}
                filteredApplications={filteredApplications}
                applications={applications}
                ambassadors={ambassadors}
                applicationSearchTerm={applicationSearchTerm}
                setApplicationSearchTerm={setApplicationSearchTerm}
                applicationStatusFilter={applicationStatusFilter}
                setApplicationStatusFilter={setApplicationStatusFilter}
                applicationCityFilter={applicationCityFilter}
                setApplicationCityFilter={setApplicationCityFilter}
                applicationVilleFilter={applicationVilleFilter}
                setApplicationVilleFilter={setApplicationVilleFilter}
                applicationDateFrom={applicationDateFrom}
                setApplicationDateFrom={setApplicationDateFrom}
                applicationDateTo={applicationDateTo}
                setApplicationDateTo={setApplicationDateTo}
                emailStatus={emailStatus}
                emailFailedApplications={emailFailedApplications}
                selectedMotivation={selectedMotivation}
                setSelectedMotivation={setSelectedMotivation}
                isMotivationDialogOpen={isMotivationDialogOpen}
                setIsMotivationDialogOpen={setIsMotivationDialogOpen}
                getStatusBadge={getStatusBadge}
                onExportExcel={exportAmbassadorsToExcel}
                onCleanupOrphaned={handleCleanupOrphanedApplications}
                onApprove={handleApprove}
                onReject={handleReject}
                onResendEmail={resendEmail}
                onCopyCredentials={copyCredentials}
                processingId={processingId}
                orphanedCount={applications.filter(app => app.status === 'approved' && !ambassadors.some(amb => amb.phone === app.phone_number || (app.email && amb.email && amb.email === app.email))).length}
                currentAdminId={currentAdminId}
                currentAdminName={currentAdminName}
                currentAdminEmail={currentAdminEmail}
                ambassadorMap={ambassadorMap}
                  />
                </Suspense>
              )}

              <TabsContent value="careers" className="space-y-6">
                {activeTab === "careers" && (
                  <Suspense fallback={adminTabSuspenseFallback}>
                    <LazyCareerTab language={language} />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="academy" className="space-y-6">
                {activeTab === "academy" && (
                  <Suspense fallback={adminTabSuspenseFallback}>
                    <LazyAcademyTab language={language} />
                  </Suspense>
                )}
              </TabsContent>

              {/* Sponsors Tab */}
              {activeTab === "sponsors" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazySponsorsTab
                sponsors={sponsors}
                editingSponsor={editingSponsor}
                setEditingSponsor={setEditingSponsor}
                isSponsorDialogOpen={isSponsorDialogOpen}
                setIsSponsorDialogOpen={setIsSponsorDialogOpen}
                isDeleteDialogOpen={isDeleteDialogOpen}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                onOpenAdd={() => openSponsorDialog()}
                onOpenEdit={openSponsorDialog}
                onOpenDelete={openDeleteDialog}
                onSave={handleSponsorSave}
                onCloseAddEdit={closeSponsorDialog}
                onCloseDelete={closeDeleteDialog}
                onConfirmDelete={handleDeleteSponsor}
                  />
                </Suspense>
              )}

              {/* Team Tab */}
              {activeTab === "team" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyTeamTab
                teamMembers={teamMembers}
                editingTeamMember={editingTeamMember}
                setEditingTeamMember={setEditingTeamMember}
                isTeamDialogOpen={isTeamDialogOpen}
                setIsTeamDialogOpen={setIsTeamDialogOpen}
                isDeleteTeamDialogOpen={isDeleteTeamDialogOpen}
                setIsDeleteTeamDialogOpen={setIsDeleteTeamDialogOpen}
                onOpenAdd={() => openTeamDialog()}
                onOpenEdit={openTeamDialog}
                onOpenDelete={openDeleteTeamDialog}
                onSave={handleTeamSave}
                onCloseAddEdit={closeTeamDialog}
                onCloseDelete={closeDeleteTeamDialog}
                onConfirmDelete={handleDeleteTeamMember}
                  />
                </Suspense>
              )}

              {/* Contact Messages Tab */}
              {activeTab === "contact" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyContactTab
                filteredContactMessages={filteredContactMessages}
                contactMessages={contactMessages}
                contactMessageSearchTerm={contactMessageSearchTerm}
                setContactMessageSearchTerm={setContactMessageSearchTerm}
                messageToDelete={messageToDelete}
                isDeleteMessageDialogOpen={isDeleteMessageDialogOpen}
                setIsDeleteMessageDialogOpen={setIsDeleteMessageDialogOpen}
                onOpenDelete={openDeleteMessageDialog}
                onCloseDelete={closeDeleteMessageDialog}
                onConfirmDelete={handleDeleteMessage}
                  />
                </Suspense>
              )}

              {activeTab === "consultation-inquiries" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyConsultationInquiriesTab
                consultationInquiries={consultationInquiries}
                filteredConsultationInquiries={filteredConsultationInquiries}
                consultationInquirySearchTerm={consultationInquirySearchTerm}
                setConsultationInquirySearchTerm={setConsultationInquirySearchTerm}
                  />
                </Suspense>
              )}

              {/* Audience Suggestions Tab */}
              {activeTab === "suggestions" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazySuggestionsTab
                filteredSuggestions={filteredSuggestions}
                suggestions={suggestions}
                suggestionSearchTerm={suggestionSearchTerm}
                setSuggestionSearchTerm={setSuggestionSearchTerm}
                readFilter={suggestionReadFilter}
                setReadFilter={setSuggestionReadFilter}
                typeFilter={suggestionTypeFilter}
                setTypeFilter={setSuggestionTypeFilter}
                selectedSuggestion={selectedSuggestion}
                onView={(s) => setSelectedSuggestion(s)}
                onCloseDetail={() => setSelectedSuggestion(null)}
                suggestionToDelete={suggestionToDelete}
                isDeleteDialogOpen={isDeleteSuggestionDialogOpen}
                setIsDeleteDialogOpen={setIsDeleteSuggestionDialogOpen}
                onOpenDelete={openDeleteSuggestionDialog}
                onCloseDelete={closeDeleteSuggestionDialog}
                onConfirmDelete={handleDeleteSuggestion}
                  />
                </Suspense>
              )}

              {/* Reports & Analytics Tab */}
              <TabsContent value="tickets" className="space-y-6">
                {activeTab === "tickets" && (
                  <Suspense fallback={adminTabSuspenseFallback}>
                    <LazyReportsAnalytics
                  language={language}
                  dashboardSelectedEventId={selectedEventId || null}
                  adminRole={currentAdminRole}
                    />
                  </Suspense>
                )}
              </TabsContent>

              {/* Online Orders Tab */}
              <TabsContent value="online-orders" className="space-y-6">
                {activeTab === "online-orders" && (
                  <Suspense fallback={adminTabSuspenseFallback}>
                    <LazyOnlineOrdersTab
                  language={language}
                  onlineOrders={onlineOrders}
                  onlineOrderFilters={onlineOrderFilters}
                  setOnlineOrderFilters={setOnlineOrderFilters}
                  loadingOnlineOrders={loadingOnlineOrders}
                  onRefresh={fetchOnlineOrders}
                  onFetchWithFilters={fetchOnlineOrdersWithFilters}
                  onViewOrder={(order) => { setSelectedOnlineOrder(order); setIsOnlineOrderDetailsOpen(true); }}
                  eventPassTypes={selectedEventId
                    ? (events.find((e: { id: string }) => e.id === selectedEventId)?.passes?.map((p: { name: string }) => p.name).filter(Boolean) ?? [])
                    : [...new Set((events || []).flatMap((e: { passes?: { name: string }[] }) => (e.passes || []).map((p) => p.name).filter(Boolean)))]}
                    />
                  </Suspense>
                )}
              </TabsContent>

              {activeTab === "ambassador-sales" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyAmbassadorSalesTab
                  language={language}
                  salesSystemTab={salesSystemTab}
                  setSalesSystemTab={setSalesSystemTab}
                  orderFilters={orderFilters}
                  setOrderFilters={setOrderFilters}
                  filterOptions={filterOptions}
                  filteredCodOrders={filteredCodOrders}
                  codAmbassadorOrders={codAmbassadorOrders}
                  dashboardEventId={selectedEventId}
                  selectedPassTypeTotal={selectedPassTypeTotal}
                  loadingOrders={loadingOrders}
                  orderLogs={orderLogs}
                  onExportExcel={exportOrdersToExcel}
                  onRefresh={fetchAmbassadorSalesData}
                  onViewOrder={(order) => {
                    setSelectedOrder(order);
                    setIsOrderDetailsOpen(true);
                  }}
                  onViewAmbassador={handleViewAmbassador}
                  />
                </Suspense>
              )}

              {activeTab === "marketing" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyMarketingTab
                  language={language}
                  marketingSubTab={marketingSubTab}
                  setMarketingSubTab={setMarketingSubTab}
                  emailSubscribers={emailSubscribers}
                  fetchEmailSubscribers={fetchEmailSubscribers}
                  loadingBalance={loadingBalance}
                  smsBalance={smsBalance}
                  fetchSmsBalance={fetchSmsBalance}
                  testPhoneNumber={testPhoneNumber}
                  setTestPhoneNumber={setTestPhoneNumber}
                  testSmsMessage={testSmsMessage}
                  setTestSmsMessage={setTestSmsMessage}
                  handleSendTestSms={handleSendTestSms}
                  sendingTestSms={sendingTestSms}
                  phoneSubscribers={phoneSubscribers}
                  handleExportPhones={handleExportPhones}
                  showImportDialog={showImportDialog}
                  setShowImportDialog={setShowImportDialog}
                  phoneImportLabel={phoneImportLabel}
                  setPhoneImportLabel={setPhoneImportLabel}
                  phoneImportFile={phoneImportFile}
                  setPhoneImportFile={setPhoneImportFile}
                  resetPhoneImportDialog={resetPhoneImportDialog}
                  handleImportPhonesFromExcel={handleImportPhonesFromExcel}
                  importingPhones={importingPhones}
                  loadingLogs={loadingLogs}
                  smsLogs={smsLogs}
                  fetchSmsLogs={fetchSmsLogs}
                  fetchPhoneSubscribers={fetchPhoneSubscribers}
                  loadingEmailSubscribers={loadingEmailSubscribers}
                  handleExportEmails={handleExportEmails}
                  showEmailImportDialog={showEmailImportDialog}
                  setShowEmailImportDialog={setShowEmailImportDialog}
                  emailImportLabel={emailImportLabel}
                  setEmailImportLabel={setEmailImportLabel}
                  emailImportFile={emailImportFile}
                  setEmailImportFile={setEmailImportFile}
                  resetEmailImportDialog={resetEmailImportDialog}
                  handleImportEmailsFromExcel={handleImportEmailsFromExcel}
                  importingEmails={importingEmails}
                  emailSubject={emailSubject}
                  setEmailSubject={setEmailSubject}
                  emailContent={emailContent}
                  setEmailContent={setEmailContent}
                  testEmailAddress={testEmailAddress}
                  setTestEmailAddress={setTestEmailAddress}
                  handleSendTestEmail={handleSendTestEmail}
                  sendingTestEmail={sendingTestEmail}
                  emailDelaySeconds={emailDelaySeconds}
                  setEmailDelaySeconds={setEmailDelaySeconds}
                  handleSendBulkEmails={handleSendBulkEmails}
                  sendingBulkEmails={sendingBulkEmails}
                  getSourceDisplayName={getSourceDisplayName}
                  />
                </Suspense>
              )}

              {activeTab === "logs" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazyLogsTab
                  language={language}
                  logs={logs}
                  loading={loadingComprehensiveLogs}
                  logsFilters={logsFilters}
                  setLogsFilters={setLogsFilters}
                  logsPagination={logsPagination}
                  setLogsPagination={setLogsPagination}
                  autoRefresh={autoRefresh}
                  setAutoRefresh={setAutoRefresh}
                  selectedLog={selectedLog}
                  setSelectedLog={setSelectedLog}
                  isLogDrawerOpen={isLogDrawerOpen}
                  setIsLogDrawerOpen={setIsLogDrawerOpen}
                  onRefresh={fetchLogs}
                  cspReports={cspReports}
                  loadingCspReports={loadingCspReports}
                  onRefreshCspReports={fetchCspReports}
                  />
                </Suspense>
              )}

              {canAccessTab("settings") && activeTab === "settings" && (
                <Suspense fallback={adminTabSuspenseFallback}>
                  <LazySettingsTab
                  language={language}
                  t={t}
                  salesEnabled={salesEnabled}
                  updateSalesSettingsData={updateSalesSettingsData}
                  loadingSalesSettings={loadingSalesSettings}
                  countdownBannerEnabled={countdownBannerEnabled}
                  updateCountdownBannerSettingsData={updateCountdownBannerSettingsData}
                  loadingCountdownBannerSettings={loadingCountdownBannerSettings}
                  countdownBannerLabelEn={countdownBannerLabelEn}
                  countdownBannerLabelFr={countdownBannerLabelFr}
                  setCountdownBannerLabelEn={setCountdownBannerLabelEn}
                  setCountdownBannerLabelFr={setCountdownBannerLabelFr}
                  commitCountdownBannerSettings={commitCountdownBannerSettings}
                  maintenanceEnabled={maintenanceEnabled}
                  maintenanceMessage={maintenanceMessage}
                  allowAmbassadorApplication={allowAmbassadorApplication}
                  updateMaintenanceSettings={updateMaintenanceSettings}
                  loadingMaintenanceSettings={loadingMaintenanceSettings}
                  setMaintenanceMessage={setMaintenanceMessage}
                  setAllowAmbassadorApplication={setAllowAmbassadorApplication}
                  expirationSettings={expirationSettings}
                  loadingExpirationSettings={loadingExpirationSettings}
                  updateExpirationSettings={updateExpirationSettings}
                  triggerAutoRejectExpired={triggerAutoRejectExpired}
                  rejectingExpired={rejectingExpired}
                  ambassadorApplicationEnabled={ambassadorApplicationEnabled}
                  ambassadorApplicationMessage={ambassadorApplicationMessage}
                  updateAmbassadorApplicationSettings={updateAmbassadorApplicationSettings}
                  loadingAmbassadorApplicationSettings={loadingAmbassadorApplicationSettings}
                  setAmbassadorApplicationMessage={setAmbassadorApplicationMessage}
                  ambassadorSelectionSettings={ambassadorSelectionSettings}
                  loadingAmbassadorSelectionSettings={loadingAmbassadorSelectionSettings}
                  updateAmbassadorCityWide={updateAmbassadorCityWide}
                  heroImages={heroImages}
                  handleUploadHeroImage={handleUploadHeroImage}
                  uploadingHeroImage={uploadingHeroImage}
                  loadingHeroImages={loadingHeroImages}
                  handleReorderHeroImages={handleReorderHeroImages}
                  handleDeleteHeroImage={handleDeleteHeroImage}
                  heroTypewriterTexts={heroTypewriterTexts}
                  handleUpdateHeroTypewriterTexts={handleUpdateHeroTypewriterTexts}
                  handleSaveHeroTypewriterTexts={handleSaveHeroTypewriterTexts}
                  aboutImages={aboutImages}
                  handleUploadAboutImage={handleUploadAboutImage}
                  uploadingAboutImage={uploadingAboutImage}
                  loadingAboutImages={loadingAboutImages}
                  handleReorderAboutImages={handleReorderAboutImages}
                  handleDeleteAboutImage={handleDeleteAboutImage}
                  />
                </Suspense>
              )}
            </Tabs>
            )}
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

      <OrderDetailsDialog
        open={isOrderDetailsOpen}
        onOpenChange={(open) => {
          setIsOrderDetailsOpen(open);
          if (!open) {
            setSelectedOrder(null);
            setSelectedOrderAmbassador(null);
            setEmailDeliveryLogs([]);
          }
        }}
        order={selectedOrder}
        ambassador={selectedOrderAmbassador}
        orderLogs={orderLogs}
        language={language}
        isSuperAdmin={currentAdminRole === "super_admin"}
        resendingTicketEmail={resendingTicketEmail}
        onOrderUpdate={(updates) => setSelectedOrder(prev => prev ? { ...prev, ...updates } : null)}
        onRefresh={(status) => fetchAmbassadorSalesData(status)}
        orderFilters={orderFilters}
        onApprove={handleApproveOrderAsAdmin}
        onReject={handleRejectCodAmbassadorOrder}
        onRemove={handleRemoveOrder}
        onSkip={handleSkipAmbassadorConfirmation}
        onComplete={handleCompleteOrderAsAdmin}
        onResendTicket={handleResendTicketEmail}
      />
      

      <OnlineOrderDetailsDialog
        open={isOnlineOrderDetailsOpen}
        onOpenChange={(open) => {
          setIsOnlineOrderDetailsOpen(open);
          if (!open) setSelectedOnlineOrder(null);
        }}
        order={selectedOnlineOrder}
        language={language}
        onUpdateStatus={updateOnlineOrderStatus}
        onUpdateEmail={updateOnlineOrderEmail}
        onResendTicket={handleResendTicketEmail}
        resendingTicketEmail={resendingTicketEmail}
        isSuperAdmin={currentAdminRole === "super_admin"}
      />

      <AmbassadorInfoDialog
        open={isAmbassadorInfoDialogOpen}
        onOpenChange={(open) => {
          setIsAmbassadorInfoDialogOpen(open);
          if (!open) setSelectedOrderAmbassador(null);
        }}
        ambassador={selectedOrderAmbassador}
        language={language}
      />

      {confirmDelete && (
        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
          title={confirmDelete.kind === 'delete-admin'
            ? (language === 'en' ? 'Are you sure you want to delete this admin? This action cannot be undone.' : 'Êtes-vous sûr de vouloir supprimer cet admin? Cette action ne peut pas être annulée.')
            : (language === 'en' ? `Are you sure you want to delete "${confirmDelete.passName}"? This action cannot be undone.` : `Êtes-vous sûr de vouloir supprimer "${confirmDelete.passName}" ? Cette action est irréversible.`)}
          confirmLabel={language === 'en' ? 'Confirm' : 'Confirmer'}
          cancelLabel={language === 'en' ? 'Cancel' : 'Annuler'}
          onConfirm={() => {
            if (confirmDelete.kind === 'delete-admin') doDeleteAdmin(confirmDelete.adminId);
            else doDeletePass(confirmDelete.passId, confirmDelete.eventId);
            setConfirmDelete(null);
          }}
          variant="danger"
        />
      )}
    </div>
  );
};

export default AdminDashboard; 

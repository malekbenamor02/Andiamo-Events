/**
 * Admin Dashboard types.
 * Extracted from Dashboard.tsx for maintainability.
 */

export interface AdminDashboardProps {
  language: 'en' | 'fr';
}

export interface AmbassadorApplication {
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

/** Selected application motivation for view dialog (Applications tab). */
export interface SelectedMotivation {
  application: AmbassadorApplication;
  motivation: string;
}

export interface EventPass {
  id?: string;
  name: string;
  price: number;
  description: string;
  is_primary: boolean;
  // Stock management fields
  max_quantity?: number | null;
  sold_quantity?: number;
  remaining_quantity?: number | null;
  is_unlimited?: boolean;
  is_active?: boolean;
  is_sold_out?: boolean;
  // Payment method restrictions
  allowed_payment_methods?: string[] | null;
}

export interface Event {
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

export interface Ambassador {
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

export interface PassPurchase {
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

/** Admin user (for admins list in Admin Management tab). */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

/** Admin being edited (for edit dialog). */
export interface EditingAdminShape {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
}

export type ConfirmDeleteTarget =
  | { kind: 'delete-admin'; adminId: string }
  | { kind: 'delete-pass'; passId: string; passName: string; eventId: string };

/** Hero image/video for site content (admin settings). */
export interface HeroImage {
  type: 'image' | 'video';
  src: string;
  alt: string;
  path?: string;
  poster?: string; // Optional poster image for videos
  srcMobile?: string; // Optional mobile version for videos
}

/** About section image (admin settings). */
export interface AboutImage {
  src: string;
  alt: string;
  path?: string;
}

/** New ambassador form (add ambassador dialog). */
export interface NewAmbassadorForm {
  full_name: string;
  age: string;
  phone_number: string;
  email: string;
  city: string;
  ville: string;
  social_link: string;
  motivation: string;
}

/** Ambassador form validation errors. */
export interface AmbassadorErrors {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  city?: string;
  ville?: string;
  social_link?: string;
}

/** Sponsor (admin sponsors tab). */
export interface Sponsor {
  id?: string;
  name: string;
  logo_url?: string;
  description?: string;
  website_url?: string;
  category?: string;
  is_global?: boolean;
  created_at?: string;
  updated_at?: string;
  _uploadFile?: File | null;
}

/** Team member (admin team tab). */
export interface TeamMember {
  id?: string;
  name: string;
  role: string;
  photo_url?: string | null;
  bio?: string | null;
  social_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Contact form message (admin contact tab). */
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
}

/** Filters for online orders tab. */
export interface OnlineOrderFilters {
  status: string;
  city: string;
  passType: string;
  orderId: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}

/** Online order (platform_online) for admin list. */
export interface OnlineOrder {
  id: string;
  user_name?: string;
  customer_name?: string;
  user_phone?: string;
  phone?: string;
  user_email?: string;
  email?: string;
  quantity?: number;
  pass_type?: string;
  total_price?: number;
  city?: string;
  ville?: string;
  payment_status?: string;
  created_at: string;
  notes?: string | Record<string, unknown>;
  source?: string;
  [key: string]: unknown;
}

/** AIO Events form submission (admin aio-events tab). */
export interface AioEventsSubmission {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  ville?: string;
  event_name?: string;
  event_date?: string;
  selected_passes?: Array<{ name?: string; passName?: string; quantity?: number }>;
  total_quantity?: number;
  total_price?: number;
  submitted_at?: string;
  [key: string]: unknown;
}

/** Pagination for AIO Events submissions list. */
export interface AioEventsPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Log entry for admin logs tab. */
export interface AdminLog {
  id: string;
  log_type: string;
  category: string;
  message: string;
  source?: string;
  user_type?: string;
  created_at: string;
  details?: unknown;
  ip_address?: string;
  request_method?: string;
  request_path?: string;
  response_status?: number;
  error_stack?: string;
  user_agent?: string;
  [key: string]: unknown;
}

/** Filters for logs tab. */
export interface LogsFilters {
  type: string[];
  category: string;
  userRole: string;
  startDate: Date | null;
  endDate: Date | null;
  search: string;
  sortBy: string;
  order: string;
}

/** Pagination for logs list. */
export interface LogsPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Order filters for Ambassador Sales COD orders tab. */
export interface AmbassadorOrderFilters {
  status: string;
  phone: string;
  ambassador: string;
  city: string;
  ville: string;
  orderId: string;
  passType: string;
}

/** Filter options derived from COD orders. */
export interface AmbassadorFilterOptions {
  ambassadors: string[];
  passTypes: string[];
}

/** Order log entry for Ambassador Sales. */
export interface AmbassadorOrderLog {
  id: string;
  order_id?: string;
  action: string;
  performed_by?: string;
  performed_by_type?: string;
  details?: unknown;
  created_at: string;
}

/** Performance report for Ambassador Sales. */
export interface AmbassadorPerformanceReport {
  totalOrders?: number;
  successRate?: number;
  avgResponseTime?: number;
}

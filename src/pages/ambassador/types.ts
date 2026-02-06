/**
 * Ambassador dashboard and order types.
 * Extracted from Dashboard.tsx for reuse in tab components.
 */

export interface AmbassadorDashboardProps {
  language: "en" | "fr";
}

export type OrderStatus =
  | "PENDING_ADMIN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "PENDING"
  | "ACCEPTED"
  | "CANCELLED"
  | "CANCELLED_BY_AMBASSADOR"
  | "CANCELLED_BY_ADMIN"
  | "REFUNDED"
  | "FRAUD_SUSPECT"
  | "IGNORED"
  | "ON_HOLD"
  | "PENDING_CASH"
  | "PAID";

export interface Order {
  id: string;
  source: "platform_cod" | "platform_online";
  user_name: string;
  user_phone: string;
  user_email?: string;
  city: string;
  ville?: string;
  ambassador_id: string;
  event_id?: string;
  pass_type: string;
  quantity: number;
  total_price: number;
  payment_method: "cod" | "online";
  status: OrderStatus;
  cancellation_reason?: string;
  rejection_reason?: string;
  notes?: string | Record<string, unknown>;
  order_passes?: Array<{
    id: string;
    order_id: string;
    pass_type: string;
    quantity: number;
    price: number;
  }>;
  assigned_at?: string;
  accepted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  expiration_notes?: string;
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
}

export interface AmbassadorTranslations {
  title: string;
  welcome: string;
  assignedOrders: string;
  completedOrders: string;
  performance: string;
  profile: string;
  logout: string;
  loading: string;
  accept: string;
  cancel: string;
  complete: string;
  customerName: string;
  phone: string;
  email: string;
  city: string;
  ville: string;
  passType: string;
  quantity: string;
  totalPrice: string;
  status: string;
  assignedAt: string;
  actions: string;
  noAssignedOrders: string;
  noCompletedOrders: string;
  event: string;
  selectEvent: string;
  noUpcomingEvents?: string;
  save: string;
  cancelOrder: string;
  cancelReason: string;
  confirmCancel: string;
  reasonRequired: string;
  orderAccepted: string;
  orderCancelled: string;
  orderCompleted: string;
  error: string;
  editProfile: string;
  currentPhone: string;
  newPhone: string;
  newPassword: string;
  confirmPassword: string;
  passwordMismatch: string;
  profileUpdated: string;
  completionRate: string;
  cancellationRate: string;
  rejectionRate: string;
  ignoreRate: string;
  avgResponseTime: string;
  totalOrders: string;
  totalRevenue: string;
  commissionEarned: string;
  pending: string;
  accepted: string;
  cancelled: string;
  completed: string;
  standard: string;
  vip: string;
  cod: string;
  online: string;
  salesDisabled: string;
  salesDisabledMessage: string;
  salesDisabledTitle: string;
  suspended: string;
  suspendedMessage: string;
  suspendedTitle: string;
}

export interface PerformanceData {
  total: number;
  paid: number;
  completed: number;
  cancelled: number;
  rejected: number;
  ignored: number;
  totalPassesSold: number;
  baseCommission: number;
  totalBonuses: number;
  commission: number;
  completionRate: string;
  cancellationRate: string;
  rejectionRate: string;
  ignoreRate: string;
  totalRevenue: number;
  averageResponseTime: number;
}

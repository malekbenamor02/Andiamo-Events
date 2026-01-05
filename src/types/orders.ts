/**
 * TypeScript Types for Order System
 */

import { OrderStatus, PaymentMethod, CancelledBy, AmbassadorStatus } from '@/lib/constants/orderStatuses';

/**
 * Payment Option Configuration
 */
export interface PaymentOption {
  id: string;
  option_type: 'online' | 'external_app' | 'ambassador_cash';
  enabled: boolean;
  app_name?: string | null;  // For external_app only
  external_link?: string | null;  // For external_app only
  app_image?: string | null;  // For external_app only
  created_at: string;
  updated_at: string;
}

/**
 * Order Pass (from order_passes table)
 */
export interface OrderPass {
  id: string;
  order_id: string;
  pass_type: string;
  quantity: number;
  price: number;
  created_at: string;
  updated_at: string;
}

/**
 * Unified Order Interface
 */
export interface Order {
  id: string;
  order_number?: number | null;  // Sequential order number for SMS/reference
  source: 'platform_cod' | 'platform_online' | 'ambassador_manual';
  user_name: string;
  user_phone: string;
  user_email?: string | null;
  city: string;
  ville?: string | null;
  ambassador_id?: string | null;
  event_id?: string | null;
  pass_type?: string | null;  // DEPRECATED - use order_passes
  quantity: number;
  total_price: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  payment_status?: string | null;  // For online orders: PENDING_PAYMENT, PAID, FAILED, REFUNDED
  payment_gateway_reference?: string | null;
  payment_response_data?: any | null;
  transaction_id?: string | null;
  external_app_reference?: string | null;
  cancellation_reason?: string | null;
  cancelled_by?: CancelledBy | null;
  notes?: string | null;  // JSON string
  assigned_at?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations (when fetched with joins)
  order_passes?: OrderPass[];
  ambassador?: Ambassador;
  event?: Event;
}

/**
 * Ambassador Interface
 */
export interface Ambassador {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  city: string;
  ville?: string | null;
  password?: string;  // Only when creating/updating
  status: AmbassadorStatus;
  commission_rate: number;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  social_link?: string | null;  // Instagram link from ambassador_applications
}

/**
 * Customer Information (for order creation)
 */
export interface CustomerInfo {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  ville?: string;
}

/**
 * Selected Pass (for order creation)
 */
export interface SelectedPass {
  passId: string;
  passName: string;
  quantity: number;
  price: number;
}

/**
 * Order Creation Data
 */
export interface CreateOrderData {
  customerInfo: CustomerInfo;
  passes: SelectedPass[];
  paymentMethod: PaymentMethod;
  ambassadorId?: string;  // Required for AMBASSADOR_CASH
  eventId?: string;
  notes?: string;
}

/**
 * Order Cancellation Data
 */
export interface CancelOrderData {
  orderId: string;
  cancelledBy: CancelledBy;
  reason: string;
  ambassadorId?: string;  // Required if cancelledBy === 'ambassador'
}

/**
 * Order Status Update Data
 */
export interface UpdateOrderStatusData {
  orderId: string;
  status: OrderStatus;
  metadata?: {
    payment_gateway_reference?: string;
    external_app_reference?: string;
    payment_response_data?: any;
  };
}

/**
 * Ambassador Sales Analytics
 */
export interface AmbassadorSalesOverview {
  totalOrders: {
    allTime: number;
    thisMonth: number;
    thisWeek: number;
  };
  totalRevenue: {
    allTime: number;
    thisMonth: number;
    thisWeek: number;
  };
  totalCommissions: {
    allTime: number;
    thisMonth: number;
    thisWeek: number;
  };
  averageOrderValue: number;
  averageOrdersPerAmbassador: number;
  topPerformers: Array<{
    ambassador_id: string;
    ambassador_name: string;
    total_orders: number;
    total_revenue: number;
    total_commissions: number;
  }>;
}

/**
 * Ambassador Sales Analytics (Time Series)
 */
export interface AmbassadorSalesAnalytics {
  ordersOverTime: Array<{
    date: string;
    count: number;
    revenue: number;
  }>;
  revenueTrends: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  ambassadorPerformance: Array<{
    ambassador_id: string;
    ambassador_name: string;
    orders: number;
    revenue: number;
    commissions: number;
  }>;
  cityDistribution: Array<{
    city: string;
    orders: number;
    revenue: number;
  }>;
  statusBreakdown: {
    PENDING_CASH: number;
    PAID: number;
    CANCELLED: number;
  };
  paymentMethodBreakdown: {
    ambassador_cash: number;
    online: number;
    external_app: number;
  };
  conversionRate: number;  // orders created → PAID
  cancellationRate: number;
  averageTimeToPayment: number;  // in hours
}

/**
 * Order Log Entry
 */
export interface OrderLog {
  id: string;
  order_id: string;
  action: 'assigned' | 'accepted' | 'completed' | 'cancelled' | 'reassigned' | 'status_changed' | 'admin_refunded';
  performed_by?: string | null;
  performed_by_type: 'admin' | 'ambassador' | 'system';
  details?: any | null;
  created_at: string;
}


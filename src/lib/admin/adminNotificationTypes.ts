/**
 * Admin notification feed types (server + client).
 */

export type AdminFeedEventType =
  | 'online_order_created'
  | 'online_order_paid'
  | 'online_order_status_changed'
  | 'ambassador_sale_created'
  | 'ambassador_sale_status_changed'
  | 'ambassador_application_created'
  | 'ambassador_application_status_changed';

export type AdminFeedNotificationKind =
  | 'online_order'
  | 'ambassador_order'
  | 'ambassador_application';

export type AdminFeedTabTarget = 'online-orders' | 'ambassador-sales' | 'applications';

export interface AdminFeedEvent {
  id: string;
  type: AdminFeedEventType;
  kind: AdminFeedNotificationKind;
  eventId: string | null;
  recordId: string;
  occurredAt: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning';
  tabTarget: AdminFeedTabTarget;
  playSound: boolean;
  showDesktop: boolean;
}

export interface AdminNotificationFeedResponse {
  success: boolean;
  serverTime: string;
  nextCursor: string;
  hasMore: boolean;
  events: AdminFeedEvent[];
}

export const ADMIN_NOTIFICATION_BASELINE_KEY = 'adminNotificationFeedBaseline';

export const ADMIN_NOTIFICATION_SEEN_KEY = 'adminNotificationSeenIds';
export const ADMIN_NOTIFICATION_CURSOR_KEY = 'adminNotificationFeedCursor';
export const ADMIN_DESKTOP_ALERTS_KEY = 'adminDesktopNotificationsEnabled';

export const BROADCAST_CHANNEL_NAME = 'admin-notifications';

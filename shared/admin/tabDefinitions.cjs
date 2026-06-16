'use strict';

/** CJS tab definitions for tests and server-side use. */
module.exports.ADMIN_TAB_DEFINITIONS = [
  { key: 'overview', requiredPermission: 'dashboard:view', order: 0, showInMobileBottomNav: true, mobileOrder: 0 },
  { key: 'events', requiredPermission: 'events:manage', order: 1, showInMobileBottomNav: true, mobileOrder: 1 },
  { key: 'ambassadors', requiredPermission: 'ambassadors:manage', order: 2 },
  { key: 'applications', requiredPermission: 'applications:manage', order: 3 },
  { key: 'careers', requiredPermission: 'careers:manage', order: 4 },
  { key: 'academy', requiredPermission: 'academy:manage', order: 5 },
  { key: 'online-orders', requiredPermission: 'orders:manage', order: 6, showInMobileBottomNav: true, mobileOrder: 3 },
  { key: 'ambassador-sales', requiredPermission: 'ambassador_sales:manage', order: 7, showInMobileBottomNav: true, mobileOrder: 2 },
  { key: 'pos', requiredPermission: 'pos:manage', order: 8, showInMobileBottomNav: true, mobileOrder: 4 },
  { key: 'official-invitations', requiredPermission: 'official_invitations:manage', order: 9 },
  { key: 'tickets', requiredPermission: 'reports:view', order: 10, showInMobileBottomNav: true, mobileOrder: 6 },
  { key: 'scanners', requiredPermission: 'scanners:manage', order: 11, showInMobileBottomNav: true, mobileOrder: 5 },
  { key: 'admins', requiredPermission: 'admins:manage', order: 12 },
  { key: 'sponsors', requiredPermission: 'sponsors:manage', order: 13 },
  { key: 'team', requiredPermission: 'team:manage', order: 14 },
  { key: 'marketing', requiredPermission: 'marketing:manage', order: 15, showInMobileBottomNav: true, mobileOrder: 7 },
  { key: 'contact', requiredPermission: 'contact:view', order: 16 },
  { key: 'consultation-inquiries', requiredPermission: 'consultation_inquiries:view', order: 17 },
  { key: 'suggestions', requiredPermission: 'suggestions:manage', order: 18 },
  { key: 'aio-events', requiredPermission: 'aio_events:view', order: 19 },
  { key: 'logs', requiredPermission: 'logs:view', order: 20 },
  { key: 'settings', requiredPermission: 'settings:manage', order: 21, showInMobileBottomNav: true, mobileOrder: 8 },
];

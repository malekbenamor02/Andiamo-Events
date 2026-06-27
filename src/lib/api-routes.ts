/**
 * Centralized API Routes Constants
 * 
 * This file contains all API route endpoints used throughout the application.
 * Using constants instead of hardcoded strings prevents typos and ensures
 * frontend and backend routes always match.
 * 
 * IMPORTANT: When adding a new route:
 * 1. Add the constant here
 * 2. Ensure the backend route in server.cjs matches exactly
 * 3. Use the constant in all frontend code
 */

import { buildApiUrl, sanitizeUrl } from './url-validator';

export const API_ROUTES = {
  // Authentication & Admin
  ADMIN_LOGIN: '/api/admin-login',
  ADMIN_LOGOUT: '/api/admin-logout',
  VERIFY_ADMIN: '/api/verify-admin',
  ADMIN_SITE_CONTENT: (key: string) => `/api/admin/site-content/${encodeURIComponent(key)}`,
  ADMIN_ADMINS: '/api/admin/admins',
  ADMIN_ADMIN: (id: string) => `/api/admin/admins/${encodeURIComponent(id)}`,
  ADMIN_SPONSORS: '/api/admin/sponsors',
  ADMIN_SPONSOR: (id: string) => `/api/admin/sponsors/${encodeURIComponent(id)}`,
  ADMIN_TEAM_MEMBERS: '/api/admin/team-members',
  ADMIN_TEAM_MEMBER: (id: string) => `/api/admin/team-members/${encodeURIComponent(id)}`,
  ADMIN_PASS_DELETE: (id: string) => `/api/admin/passes/${encodeURIComponent(id)}`,
  ADMIN_EVENTS: '/api/admin/events',
  ADMIN_EVENT: (id: string) => `/api/admin/events/${id}`,

  PRESALE_REDEEM: '/api/presale/redeem',
  /** Server truth for whether pass purchase requires presale code (matches DB used by /api/passes). */
  PRESALE_REQUIRED: '/api/presale/required',
  PRESALE_SESSION: '/api/presale/session',
  PRESALE_SESSION_CLEAR: '/api/presale/session/clear',
  ADMIN_PRESALE_CODES: (eventId: string) =>
    `/api/admin/presale/codes?eventId=${encodeURIComponent(eventId)}`,
  ADMIN_PRESALE_CODE_PAUSE: (id: string) => `/api/admin/presale/codes/${encodeURIComponent(id)}/pause`,
  ADMIN_PRESALE_CODE_UNPAUSE: (id: string) => `/api/admin/presale/codes/${encodeURIComponent(id)}/unpause`,
  ADMIN_PRESALE_CODE_MAX_REDEMPTIONS: (id: string) =>
    `/api/admin/presale/codes/${encodeURIComponent(id)}/max-redemptions`,
  ADMIN_PRESALE_CODE_MAX_UNLOCKS: (id: string) =>
    `/api/admin/presale/codes/${encodeURIComponent(id)}/max-unlocks`,
  ADMIN_PRESALE_CODE_DISCOUNTS: (id: string) =>
    `/api/admin/presale/codes/${encodeURIComponent(id)}/discounts`,

  EVENT_PROMO_AVAILABILITY: (eventId: string) =>
    `/api/event-promo/availability?eventId=${encodeURIComponent(eventId)}`,
  EVENT_PROMO_VALIDATE: '/api/event-promo/validate',
  ADMIN_EVENT_PROMO_CODES: (eventId: string) =>
    `/api/admin/event-promo/codes?eventId=${encodeURIComponent(eventId)}`,
  ADMIN_EVENT_PROMO_CODE: (id: string) =>
    `/api/admin/event-promo/codes/${encodeURIComponent(id)}`,
  ADMIN_EVENT_PROMO_CODE_DISCOUNTS: (id: string) =>
    `/api/admin/event-promo/codes/${encodeURIComponent(id)}/discounts`,

  /** Create pass for an event (service role; required when event has presale — anon cannot SELECT inserted row). */
  ADMIN_PASS_CREATE: '/api/admin/passes/create',
  /** Admin auth + service role; required when event.presale_enabled hides passes from anon client. */
  ADMIN_PASSES_FOR_EVENT: (eventId: string) =>
    `/api/admin/passes/${encodeURIComponent(eventId)}`,
  
  // Application Management
  ADMIN_UPDATE_APPLICATION: '/api/admin-update-application',
  ADMIN_DASHBOARD_BOOTSTRAP: '/api/admin/dashboard/bootstrap',
  ADMIN_AMBASSADORS: '/api/admin/ambassadors',
  ADMIN_AMBASSADOR: (id: string) => `/api/admin/ambassadors/${encodeURIComponent(id)}`,
  ADMIN_AMBASSADOR_APPLICATIONS: '/api/admin/ambassador-applications',
  ADMIN_CONTACT_MESSAGES: '/api/admin/contact-messages',
  ADMIN_CONTACT_MESSAGE: (id: string) => `/api/admin/contact-messages/${encodeURIComponent(id)}`,
  ADMIN_SUBSCRIBERS_PHONES: '/api/admin/subscribers/phones',
  ADMIN_SUBSCRIBER_PHONE: (id: string) => `/api/admin/subscribers/phones/${encodeURIComponent(id)}`,
  ADMIN_SUBSCRIBERS_NEWSLETTERS: '/api/admin/subscribers/newsletters',
  ADMIN_SUBSCRIBER_NEWSLETTER: (id: string) =>
    `/api/admin/subscribers/newsletters/${encodeURIComponent(id)}`,
  ADMIN_AUDIENCE_SUGGESTIONS: '/api/admin/audience-suggestions',
  ADMIN_AUDIENCE_SUGGESTION: (id: string) =>
    `/api/admin/audience-suggestions/${encodeURIComponent(id)}`,
  ADMIN_SMS_LOGS: '/api/admin/sms-logs',
  ADMIN_SITE_LOGS: '/api/admin/site-logs',
  ADMIN_ORDER_PASSES: '/api/admin/order-passes',
  
  // Email
  SEND_EMAIL: '/api/send-email',

  /** R2 media (requires env); 503 R2_DISABLED → client falls back to Supabase upload helpers */
  MEDIA_UPLOAD: '/api/media/upload',
  MEDIA_DELETE: '/api/media/delete',
  MEDIA_FAVICON_CLEANUP: '/api/media/favicon/cleanup',
  RESEND_ORDER_COMPLETION_EMAIL: '/api/resend-order-completion-email',
  EMAIL_DELIVERY_LOGS: (orderId: string) => `/api/email-delivery-logs/${orderId}`,
  
  // SMS
  SMS_BALANCE: '/api/sms-balance',
  SEND_SMS: '/api/send-sms',
  BULK_PHONES: '/api/bulk-phones',
  SEND_ORDER_CONFIRMATION_SMS: '/api/send-order-confirmation-sms',
  SEND_AMBASSADOR_ORDER_SMS: '/api/send-ambassador-order-sms',
  
  // Bulk SMS (Admin)
  ADMIN_PHONE_NUMBERS_SOURCES: '/api/admin/phone-numbers/sources',
  ADMIN_PHONE_NUMBERS_COUNTS: '/api/admin/phone-numbers/counts',
  ADMIN_BULK_SMS_SEND: '/api/admin/bulk-sms/send',

  // Bulk Email (Admin) - same source/filter model as SMS
  ADMIN_EMAIL_ADDRESSES_COUNTS: '/api/admin/email-addresses/counts',
  ADMIN_EMAIL_ADDRESSES_SOURCES: '/api/admin/email-addresses/sources',
  ADMIN_INVESTOR_CONTACTS: '/api/admin/investor-contacts',

  // Marketing campaigns (bulk email/SMS in batches)
  MARKETING_CAMPAIGNS: '/api/marketing/campaigns',
  MARKETING_CAMPAIGN: (id: string) => `/api/marketing/campaigns/${id}`,
  MARKETING_CAMPAIGN_LAUNCH: (id: string) => `/api/marketing/campaigns/${id}/launch`,
  MARKETING_CAMPAIGN_SEND_BATCH: (id: string) => `/api/marketing/campaigns/${id}/send-batch`,
  MARKETING_CRON_EMAIL_CAMPAIGNS: '/api/marketing/cron/email-campaigns',
  
  // Phone Subscription
  PHONE_SUBSCRIBE: '/api/phone-subscribe',
  
  // Ambassador
  AMBASSADOR_LOGIN: '/api/ambassador-login',
  AMBASSADOR_LOGOUT: '/api/ambassador-logout',
  AMBASSADOR_ME: '/api/ambassador/me',
  AMBASSADOR_APPLICATION: '/api/ambassador-application',
  AMBASSADOR_UPDATE_PASSWORD: '/api/ambassador-update-password',
  AMBASSADOR_ORDERS: '/api/ambassador/orders',
  AMBASSADOR_PERFORMANCE: '/api/ambassador/performance',
  AMBASSADOR_CONFIRM_CASH: '/api/ambassador/confirm-cash',
  AMBASSADOR_CANCEL_ORDER: '/api/ambassador/cancel-order',
  
  // Tickets & QR Codes
  VALIDATE_TICKET: '/api/validate-ticket',
  GENERATE_QR_CODE: '/api/generate-qr-code',
  GENERATE_TICKETS_FOR_ORDER: '/api/generate-tickets-for-order',
  
  // ClicToPay Payment Gateway
  CLICTOPAY_GENERATE_PAYMENT: '/api/clictopay-generate-payment',
  CLICTOPAY_CONFIRM_PAYMENT: '/api/clictopay-confirm-payment',

  // Academy registration
  ACADEMY_STATUS: '/api/academy/status',
  ACADEMY_VALIDATE_PROMO: '/api/academy/validate-promo',
  ACADEMY_REGISTER: '/api/academy/register',
  ACADEMY_CLICTOPAY_GENERATE: '/api/academy/clictopay-generate-payment',
  ACADEMY_CLICTOPAY_CONFIRM: '/api/academy/clictopay-confirm-payment',
  ACADEMY_REGISTRATION_STATUS: (id: string) => `/api/academy/registration/${encodeURIComponent(id)}/status`,
  ADMIN_ACADEMY_SETTINGS: '/api/admin/academy/settings',
  ADMIN_ACADEMY_REGISTRATIONS: '/api/admin/academy/registrations',
  ADMIN_ACADEMY_REGISTRATION: (id: string) => `/api/admin/academy/registrations/${encodeURIComponent(id)}`,
  ADMIN_ACADEMY_REGISTRATION_APPROVE: (id: string) =>
    `/api/admin/academy/registrations/${encodeURIComponent(id)}/approve`,
  ADMIN_ACADEMY_REGISTRATION_REJECT: (id: string) =>
    `/api/admin/academy/registrations/${encodeURIComponent(id)}/reject`,
  ADMIN_ACADEMY_REGISTRATION_RESEND: (id: string) =>
    `/api/admin/academy/registrations/${encodeURIComponent(id)}/resend-email`,
  ADMIN_ACADEMY_REPORTS: '/api/admin/academy/reports',
  ADMIN_ACADEMY_PROMO_CODES: '/api/admin/academy/promo-codes',
  ADMIN_ACADEMY_PROMO_CODE: (id: string) => `/api/admin/academy/promo-codes/${encodeURIComponent(id)}`,
  ADMIN_ACADEMY_INFLUENCERS: '/api/admin/academy/influencers',
  ADMIN_ACADEMY_INFLUENCER: (id: string) => `/api/admin/academy/influencers/${encodeURIComponent(id)}`,
  ADMIN_ACADEMY_INFLUENCER_RESEND_INVITE: (id: string) =>
    `/api/admin/academy/influencers/${encodeURIComponent(id)}/resend-invite`,
  ADMIN_ACADEMY_INFLUENCER_SALES: (id: string) =>
    `/api/admin/academy/influencers/${encodeURIComponent(id)}/sales`,

  ACADEMY_INFLUENCER_LOGIN: '/api/academy-influencer/login',
  ACADEMY_INFLUENCER_LOGOUT: '/api/academy-influencer/logout',
  ACADEMY_INFLUENCER_SESSION: '/api/academy-influencer/session',
  ACADEMY_INFLUENCER_CHANGE_PASSWORD: '/api/academy-influencer/change-password',
  ACADEMY_INFLUENCER_SALES: '/api/academy-influencer/sales',

  // Admin Order Management
  ADMIN_SKIP_AMBASSADOR_CONFIRMATION: '/api/admin-skip-ambassador-confirmation',
  ADMIN_APPROVE_ORDER: '/api/admin-approve-order',
  ADMIN_REJECT_ORDER: '/api/admin/reject-order',
  ADMIN_ORDERS_ONLINE: '/api/admin/orders/online',
  ADMIN_ORDERS_CHART: '/api/admin/orders/chart',
  ADMIN_ORDERS_POS_OVERVIEW: '/api/admin/orders/pos-overview',
  ADMIN_ANALYTICS_ORDERS: '/api/admin/analytics/orders',
  ADMIN_ANALYTICS_EXPORT_ORDERS: '/api/admin/analytics/export-orders',
  ADMIN_ANALYTICS_ORDER_SUMMARIES: '/api/admin/analytics/order-summaries',
  ADMIN_ORDER_LOGS: '/api/admin/order-logs',
  ADMIN_ORDER_PAYMENT_STATUS: (id: string) =>
    `/api/admin/orders/${encodeURIComponent(id)}/payment-status`,
  ADMIN_ORDER_COMPLETE: (id: string) =>
    `/api/admin/orders/${encodeURIComponent(id)}/complete`,
  ADMIN_ORDER_APPROVE_EMAIL_SMS: (id: string) =>
    `/api/admin/orders/${encodeURIComponent(id)}/approve-email-sms`,
  ADMIN_AUDIT_LOG: '/api/admin/audit-log',
  ADMIN_AUDIT_LOGS: '/api/admin/audit-logs',
  ADMIN_REMOVE_ORDER: '/api/admin-remove-order',
  ADMIN_RESEND_TICKET_EMAIL: '/api/admin-resend-ticket-email',
  /** Super admin only: QR images and ticket statuses for an order (query param orderId). */
  ADMIN_ORDER_QR_TICKETS: (orderId: string) =>
    `/api/admin/order-qr-tickets?orderId=${encodeURIComponent(orderId)}`,
  ADMIN_UPDATE_ORDER_EMAIL: '/api/admin/update-order-email',
  ADMIN_UPDATE_ORDER_NOTES: '/api/admin/update-order-notes',
  
  
  // Order Completion
  SEND_ORDER_COMPLETION_EMAIL: '/api/send-order-completion-email',
  
  // reCAPTCHA
  VERIFY_RECAPTCHA: '/api/verify-recaptcha',

  // Audience suggestions (events, artists, venues)
  AUDIENCE_SUGGESTIONS: '/api/audience-suggestions',
  
  // Payment Options
  PAYMENT_OPTIONS: '/api/payment-options',
  ADMIN_PAYMENT_OPTIONS: '/api/admin/payment-options',
  UPDATE_PAYMENT_OPTION: (type: string) => `/api/admin/payment-options/${type}`,
  
  // AIO Events Submissions
  AIO_EVENTS_SAVE_SUBMISSION: '/api/aio-events/save-submission',
  
  // Active Ambassadors
  ACTIVE_AMBASSADORS: '/api/ambassadors/active',
  
  // Ambassador Sales
  AMBASSADOR_SALES_OVERVIEW: '/api/admin/ambassador-sales/overview',
  AMBASSADOR_SALES_ORDERS: '/api/admin/ambassador-sales/orders',
  AMBASSADOR_SALES_LOGS: '/api/admin/ambassador-sales/logs',
  
  // Order Expiration Management
  ORDER_EXPIRATION_SETTINGS: '/api/admin/order-expiration-settings',
  SET_ORDER_EXPIRATION: '/api/admin/set-order-expiration',
  CLEAR_ORDER_EXPIRATION: '/api/admin/clear-order-expiration',
  
  // Admin Logs & Analytics
  ADMIN_LOGS: '/api/admin/logs',
  ADMIN_CONSULTATION_INQUIRIES: '/api/admin/consultation-inquiries',
  ADMIN_CSP_REPORTS: '/api/admin/csp-reports',
  
  // Official Invitations (Super Admin Only)
  CREATE_OFFICIAL_INVITATION: '/api/admin/official-invitations/create',
  GET_OFFICIAL_INVITATIONS: '/api/admin/official-invitations',
  GET_OFFICIAL_INVITATION: (id: string) => `/api/admin/official-invitations/${id}`,
  RESEND_INVITATION_EMAIL: (id: string) => `/api/admin/official-invitations/${id}/resend`,
  DELETE_OFFICIAL_INVITATION: (id: string) => `/api/admin/official-invitations/${id}`,
  
  // Admin POS (Point de Vente)
  ADMIN_POS_OUTLETS: '/api/admin/pos-outlets',
  ADMIN_POS_OUTLET: (id: string) => `/api/admin/pos-outlets/${id}`,
  ADMIN_POS_USERS: '/api/admin/pos-users',
  ADMIN_POS_USER: (id: string) => `/api/admin/pos-users/${id}`,
  ADMIN_POS_STOCK: '/api/admin/pos-stock',
  ADMIN_POS_STOCK_ITEM: (id: string) => `/api/admin/pos-stock/${id}`,
  ADMIN_POS_ORDERS: '/api/admin/pos-orders',
  ADMIN_POS_ORDER: (id: string) => `/api/admin/pos-orders/${id}`,
  ADMIN_POS_ORDER_APPROVE: (id: string) => `/api/admin/pos-orders/${id}/approve`,
  ADMIN_POS_ORDER_REJECT: (id: string) => `/api/admin/pos-orders/${id}/reject`,
  ADMIN_POS_ORDER_REMOVE: (id: string) => `/api/admin/pos-orders/${id}/remove`,
  ADMIN_POS_ORDER_RESEND_RECEIVED: (id: string) => `/api/admin/pos-orders/${id}/resend-order-received`,
  ADMIN_POS_ORDER_RESEND_TICKETS: (id: string) => `/api/admin/pos-orders/${id}/resend-tickets-email`,
  ADMIN_POS_AUDIT_LOG: '/api/admin/pos-audit-log',
  ADMIN_POS_EVENTS: '/api/admin/pos-events',
  ADMIN_POS_STATISTICS: '/api/admin/pos-statistics',

  // Scanner system (never trust frontend: scanner_id, role, etc. from verified JWT only)
  SCAN_SYSTEM_STATUS: '/api/scan-system-status',
  SCANNER_LOGIN: '/api/scanner-login',
  SCANNER_LOGOUT: '/api/scanner-logout',
  SCANNER_VALIDATE_TICKET: '/api/scanner/validate-ticket',
  SCANNER_EVENTS: '/api/scanner/events',
  SCANNER_SCANS: '/api/scanner/scans',
  SCANNER_STATISTICS: '/api/scanner/statistics',
  SCANNER_SESSION: '/api/scanner/session',
  SCANNER_LOOKUP_TICKET: '/api/scanner/lookup-ticket',
  /** Supervisor inspect full page: pass qr_ticket_id and event_id query params. */
  SCANNER_INSPECT_DETAIL: (qrTicketId: string, eventId: string) =>
    `/api/scanner/inspect-detail?qr_ticket_id=${encodeURIComponent(qrTicketId)}&event_id=${encodeURIComponent(eventId)}`,
  SCANNER_EVENT_SCANS: '/api/scanner/event-scans',
  SCANNER_EVENT_STATISTICS: '/api/scanner/event-statistics',
  ADMIN_SCAN_SYSTEM_CONFIG: '/api/admin/scan-system-config',
  ADMIN_SCANNERS: '/api/admin/scanners',
  ADMIN_SCANNER: (id: string) => `/api/admin/scanners/${id}`,
  ADMIN_SCANNER_SCANS: (id: string) => `/api/admin/scanners/${id}/scans`,
  ADMIN_SCANNER_STATISTICS: (id: string) => `/api/admin/scanners/${id}/statistics`,
  ADMIN_SCAN_HISTORY: '/api/admin/scan-history',
  ADMIN_SCAN_STATISTICS: '/api/admin/scan-statistics',
  
  // Career / Recruitment
  CAREERS_DOMAINS: '/api/careers/domains',
  CAREERS_PAGE_CONTENT: '/api/careers/page-content',
  CAREERS_DOMAIN_BY_SLUG: (slug: string) => `/api/careers/domains/${slug}`,
  CAREERS_CITY_OPTIONS: '/api/careers/city-options',
  CAREERS_GENDER_OPTIONS: '/api/careers/gender-options',
  CAREER_APPLICATION_SUBMIT: '/api/career-application',
  CAREER_APPLICATION_CHECK_DUPLICATE: '/api/career-application/check-duplicate',
  CAREERS_ADMIN_SETTINGS: '/api/admin/careers/settings',
  CAREERS_ADMIN_CITY_OPTIONS: '/api/admin/careers/city-options',
  CAREERS_ADMIN_GENDER_OPTIONS: '/api/admin/careers/gender-options',
  CAREERS_ADMIN_DOMAINS: '/api/admin/careers/domains',
  CAREERS_ADMIN_DOMAIN: (id: string) => `/api/admin/careers/domains/${id}`,
  CAREERS_ADMIN_DOMAIN_FIELDS: (id: string) => `/api/admin/careers/domains/${id}/fields`,
  CAREERS_ADMIN_DOMAIN_FIELDS_BULK: (id: string) => `/api/admin/careers/domains/${id}/fields/bulk`,
  CAREERS_ADMIN_DOMAIN_FIELDS_REORDER: (id: string) => `/api/admin/careers/domains/${id}/fields/reorder`,
  CAREERS_ADMIN_DOMAIN_FIELD: (domainId: string, fieldId: string) => `/api/admin/careers/domains/${domainId}/fields/${fieldId}`,
  CAREERS_ADMIN_TEMPLATES: '/api/admin/careers/templates',
  CAREERS_ADMIN_TEMPLATES_FROM_DOMAIN: '/api/admin/careers/templates/from-domain',
  CAREERS_ADMIN_DOMAIN_APPLY_TEMPLATE: (domainId: string) => `/api/admin/careers/domains/${domainId}/apply-template`,
  CAREERS_ADMIN_APPLICATIONS: '/api/admin/careers/applications',
  CAREERS_ADMIN_APPLICATION: (id: string) => `/api/admin/careers/applications/${id}`,
  CAREERS_ADMIN_APPLICATION_LOGS: (id: string) => `/api/admin/careers/applications/${id}/logs`,
  CAREERS_ADMIN_APPLICATIONS_COMPARE: '/api/admin/careers/applications/compare',
  CAREERS_ADMIN_APPLICATIONS_EXPORT: '/api/admin/careers/applications/export',

  // Testing & Diagnostics
  TEST: '/api/test',
  TEST_SUPABASE: '/api/test-supabase',
  SMS_TEST: '/api/sms-test',
} as const;

/**
 * Type-safe API route helper
 * Ensures we only use valid route constants
 */
export type ApiRoute = typeof API_ROUTES[keyof typeof API_ROUTES] | string;

/**
 * Helper function to build API routes with parameters
 * Usage: buildApiRoute(API_ROUTES.EMAIL_DELIVERY_LOGS, { orderId: '123' })
 */
export const buildApiRoute = (
  route: string | ((...args: any[]) => string),
  ...args: any[]
): string => {
  if (typeof route === 'function') {
    const result = route(...args);
    // Validate the result
    if (!result || typeof result !== 'string' || result.includes('undefined') || result.includes('null')) {
      console.error('buildApiRoute: Invalid route generated', result, args);
      throw new Error(`Invalid API route generated: ${result}`);
    }
    return result;
  }
  
  // Validate static route
  if (!route || typeof route !== 'string' || route.includes('undefined') || route.includes('null')) {
    console.error('buildApiRoute: Invalid route', route);
    throw new Error(`Invalid API route: ${route}`);
  }
  
  return route;
};

/**
 * Gets the API base URL based on environment
 * 
 * RULES:
 * - Development (import.meta.env.DEV): Returns 'http://localhost:8082'
 * - Production/Preview: Returns '' (empty string for same-origin requests)
 * 
 * This ensures:
 * - Localhost is ONLY used in development
 * - Production uses same-origin /api/* routes
 * - No localhost fallback in production builds
 * 
 * CRITICAL: This function checks both build-time and runtime environment
 * to prevent localhost from being used in production.
 */
export function getApiBaseUrl(): string {
  // Runtime check: If we're running on a production domain, NEVER use localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isProductionDomain = hostname !== 'localhost' && 
                                hostname !== '127.0.0.1' && 
                                !hostname.startsWith('192.168.') &&
                                !hostname.startsWith('10.0.') &&
                                !hostname.startsWith('172.') &&
                                hostname !== '';
    
    // If we're on a production domain, ALWAYS use same-origin (empty string)
    if (isProductionDomain) {
      return '';
    }
  }
  
  // DEV: use '' so /api uses Vite proxy (localhost:3000 -> 8082), avoids CORS
  if (import.meta.env.DEV) return '';
  // Production: same-origin
  return '';
}

/**
 * Runtime guard to prevent localhost in production builds
 * This will throw an error if localhost is detected in non-dev builds
 */
if (typeof window !== 'undefined') {
  // Only run in browser context
  const apiBase = getApiBaseUrl();
  const hostname = window.location.hostname;
  const isProductionDomain = hostname !== 'localhost' && 
                            hostname !== '127.0.0.1' && 
                            !hostname.startsWith('192.168.') &&
                            !hostname.startsWith('10.0.') &&
                            !hostname.startsWith('172.') &&
                            hostname !== '';
  
  // If we're on a production domain and getApiBaseUrl returns localhost, that's a critical error
  if (isProductionDomain && apiBase.includes('localhost')) {
    const error = new Error(
      '❌ CRITICAL: PRODUCTION BUILD IS USING LOCALHOST API!\n' +
      `Hostname: ${hostname}\n` +
      `API Base URL: ${apiBase}\n` +
      `Build Mode: ${import.meta.env.MODE}\n` +
      `DEV Flag: ${import.meta.env.DEV}\n` +
      'This should NEVER happen. The API base URL has been forced to empty string.'
    );
    console.error(error);
    // Force return empty string to prevent the call
    // This is a safety net - getApiBaseUrl() should already handle this
  }
}

/**
 * Safely builds a full API URL with base URL
 * Validates all parts before constructing the URL
 */
export const buildFullApiUrl = (
  route: string | ((...args: any[]) => string),
  baseUrl?: string,
  ...args: any[]
): string | null => {
  const routeString = buildApiRoute(route, ...args);
  // If baseUrl is not provided, use getApiBaseUrl() as default
  const effectiveBaseUrl = baseUrl !== undefined ? baseUrl : getApiBaseUrl();
  const sanitizedBase = effectiveBaseUrl ? sanitizeUrl(effectiveBaseUrl) : null;
  
  if (sanitizedBase) {
    return buildApiUrl(routeString, sanitizedBase);
  }
  
  return sanitizeUrl(routeString);
};


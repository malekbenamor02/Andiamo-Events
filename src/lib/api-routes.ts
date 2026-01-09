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
  
  // Application Management
  ADMIN_UPDATE_APPLICATION: '/api/admin-update-application',
  
  // Email
  SEND_EMAIL: '/api/send-email',
  RESEND_ORDER_COMPLETION_EMAIL: '/api/resend-order-completion-email',
  EMAIL_DELIVERY_LOGS: (orderId: string) => `/api/email-delivery-logs/${orderId}`,
  
  // SMS
  SMS_BALANCE: '/api/sms-balance',
  SEND_SMS: '/api/send-sms',
  BULK_PHONES: '/api/bulk-phones',
  SEND_ORDER_CONFIRMATION_SMS: '/api/send-order-confirmation-sms',
  SEND_AMBASSADOR_ORDER_SMS: '/api/send-ambassador-order-sms',
  
  // Phone Subscription
  PHONE_SUBSCRIBE: '/api/phone-subscribe',
  
  // Ambassador
  AMBASSADOR_LOGIN: '/api/ambassador-login',
  AMBASSADOR_APPLICATION: '/api/ambassador-application',
  AMBASSADOR_UPDATE_PASSWORD: '/api/ambassador-update-password',
  
  // Tickets & QR Codes
  VALIDATE_TICKET: '/api/validate-ticket',
  GENERATE_QR_CODE: '/api/generate-qr-code',
  GENERATE_TICKETS_FOR_ORDER: '/api/generate-tickets-for-order',
  
  // Sales Settings
  UPDATE_SALES_SETTINGS: '/api/update-sales-settings',
  
  // Order Completion
  SEND_ORDER_COMPLETION_EMAIL: '/api/send-order-completion-email',
  
  // reCAPTCHA
  VERIFY_RECAPTCHA: '/api/verify-recaptcha',
  
  // Payment Options
  PAYMENT_OPTIONS: '/api/payment-options',
  ADMIN_PAYMENT_OPTIONS: '/api/admin/payment-options',
  UPDATE_PAYMENT_OPTION: (type: string) => `/api/admin/payment-options/${type}`,
  
  // Active Ambassadors
  ACTIVE_AMBASSADORS: '/api/ambassadors/active',
  
  // Flouci Payment (Clean Implementation)
  FLOUCI_GENERATE: '/api/flouci/generate',
  FLOUCI_VERIFY: '/api/flouci/verify',
  FLOUCI_WEBHOOK: '/api/flouci/webhook',
  
  // Ambassador Sales
  AMBASSADOR_SALES_OVERVIEW: '/api/admin/ambassador-sales/overview',
  AMBASSADOR_SALES_ORDERS: '/api/admin/ambassador-sales/orders',
  AMBASSADOR_SALES_LOGS: '/api/admin/ambassador-sales/logs',
  
  // Order Creation (SECURE SERVER-SIDE)
  CREATE_ORDER: '/api/orders/create',
  
  // Ambassador Actions (SECURE SERVER-SIDE)
  AMBASSADOR_CONFIRM_CASH: '/api/ambassador/confirm-cash',
  AMBASSADOR_CANCEL_ORDER: '/api/ambassador/cancel-order',
  
  // Admin Actions (SECURE SERVER-SIDE)
  ADMIN_APPROVE_ORDER: '/api/admin/approve-order',
  ADMIN_REJECT_ORDER: '/api/admin/reject-order',
  
  // Admin Management (SECURE SERVER-SIDE - PHASE 2)
  ADMIN_SPONSORS: '/api/admin/sponsors',
  ADMIN_SPONSOR: (id: string) => `/api/admin/sponsors/${id}`,
  ADMIN_TEAM_MEMBERS: '/api/admin/team-members',
  ADMIN_TEAM_MEMBER: (id: string) => `/api/admin/team-members/${id}`,
  ADMIN_ORDER_PAYMENT_STATUS: (id: string) => `/api/admin/orders/${id}/payment-status`,
  
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
 * Get the API base URL for the current environment
 * - Uses VITE_API_URL if set AND it's not ngrok/localhost
 * - In development: uses empty string (Vite proxy) if VITE_API_URL not set
 * - In production/preview: uses current origin (same domain)
 * 
 * CRITICAL: On Vercel Preview/Production, NEVER use ngrok or localhost URLs
 */
export const getApiBaseUrl = (): string => {
  const viteApiUrl = import.meta.env.VITE_API_URL;
  
  // Check if we're on Vercel Preview or Production
  const isVercelDeployment = typeof window !== 'undefined' && 
    (window.location.hostname.includes('.vercel.app') || 
     window.location.hostname.includes('vercel.app'));
  
  // If VITE_API_URL is set, validate it's not ngrok/localhost on Vercel
  if (viteApiUrl) {
    const sanitizedUrl = sanitizeUrl(viteApiUrl);
    const isNgrok = sanitizedUrl.includes('ngrok') || sanitizedUrl.includes('ngrok-free.dev');
    const isLocalhost = sanitizedUrl.includes('localhost') || sanitizedUrl.includes('127.0.0.1');
    
    // CRITICAL: On Vercel deployments, reject ngrok/localhost URLs
    if (isVercelDeployment && (isNgrok || isLocalhost)) {
      console.warn('⚠️ VITE_API_URL contains ngrok/localhost on Vercel deployment - using same origin instead');
      // Use same origin for Vercel Preview/Production
      return typeof window !== 'undefined' ? window.location.origin : '';
    }
    
    // Use VITE_API_URL if it's valid (not ngrok/localhost on Vercel)
    return sanitizedUrl;
  }
  
  // In development, use empty string (Vite proxy)
  if (import.meta.env.DEV) {
    return '';
  }
  
  // In production/preview (Vercel), use current origin (same domain)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Fallback (shouldn't happen in browser)
  return '';
};

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
  const sanitizedBase = baseUrl ? sanitizeUrl(baseUrl) : getApiBaseUrl();
  
  if (sanitizedBase) {
    return buildApiUrl(routeString, sanitizedBase);
  }
  
  return sanitizeUrl(routeString);
};


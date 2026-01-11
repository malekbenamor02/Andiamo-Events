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
  
  // Admin Order Management
  ADMIN_SKIP_AMBASSADOR_CONFIRMATION: '/api/admin-skip-ambassador-confirmation',
  ADMIN_APPROVE_ORDER: '/api/admin-approve-order',
  ADMIN_RESEND_TICKET_EMAIL: '/api/admin-resend-ticket-email',
  
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
  
  // Ambassador Sales
  AMBASSADOR_SALES_OVERVIEW: '/api/admin/ambassador-sales/overview',
  AMBASSADOR_SALES_ORDERS: '/api/admin/ambassador-sales/orders',
  AMBASSADOR_SALES_LOGS: '/api/admin/ambassador-sales/logs',
  
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
 */
export function getApiBaseUrl(): string {
  // In development mode, use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:8082';
  }
  
  // In production/preview, use same-origin (empty string)
  // This allows relative URLs like /api/admin-approve-order
  return '';
}

/**
 * Runtime guard to prevent localhost in production builds
 * This will throw an error if localhost is detected in non-dev builds
 */
if (typeof window !== 'undefined') {
  // Only run in browser context
  const apiBase = getApiBaseUrl();
  if (!import.meta.env.DEV && apiBase.includes('localhost')) {
    const error = new Error(
      '❌ PRODUCTION BUILD IS USING LOCALHOST API - This is a critical configuration error!\n' +
      `API Base URL: ${apiBase}\n` +
      'Please check your environment configuration and ensure VITE_API_URL is not set in production.'
    );
    console.error(error);
    // In production, we want to fail loudly but not crash the app
    // The error is logged, but we continue with empty string as fallback
    // This allows the app to work while alerting developers to the issue
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


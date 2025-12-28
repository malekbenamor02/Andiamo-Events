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
  
  // Testing & Diagnostics
  TEST: '/api/test',
  TEST_SUPABASE: '/api/test-supabase',
  TEST_EMAIL: '/api/test-email',
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
 * Safely builds a full API URL with base URL
 * Validates all parts before constructing the URL
 */
export const buildFullApiUrl = (
  route: string | ((...args: any[]) => string),
  baseUrl?: string,
  ...args: any[]
): string | null => {
  const routeString = buildApiRoute(route, ...args);
  const sanitizedBase = baseUrl ? sanitizeUrl(baseUrl) : null;
  
  if (sanitizedBase) {
    return buildApiUrl(routeString, sanitizedBase);
  }
  
  return sanitizeUrl(routeString);
};


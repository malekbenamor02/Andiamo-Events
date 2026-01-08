import { supabase } from "@/integrations/supabase/client";
import { sanitizeObject, sanitizeString } from "./sanitize";

export type LogType = 'info' | 'warning' | 'error' | 'success' | 'action';
export type LogCategory = 
  | 'user_action' 
  | 'api_call' 
  | 'database' 
  | 'page_view' 
  | 'form_submission'
  | 'authentication'
  | 'navigation'
  | 'error'
  | 'system'
  | 'sms'
  | 'email'
  | 'payment';

interface LogDetails {
  [key: string]: any;
}

interface LogOptions {
  category?: LogCategory;
  details?: LogDetails;
  userType?: 'admin' | 'ambassador' | 'guest';
  pageUrl?: string;
  requestMethod?: string;
  requestPath?: string;
  responseStatus?: number;
  errorStack?: string;
}

/**
 * Log an activity to the site_logs table
 * 
 * ⚠️ PHASE 2 SECURITY WARNING: This function creates logs from frontend
 * Frontend logs can be manipulated and are not trustworthy for security audits
 * 
 * @deprecated For security-critical logging, use server-side logging only
 * This function is kept for non-critical frontend activity tracking only
 * 
 * SECURITY RULE: Never use this for:
 * - Admin actions (use server-side security_audit_logs)
 * - Order status changes (use server-side order_logs)
 * - Payment events (use server-side logging)
 * - Any security-sensitive operations
 * 
 * Safe to use for:
 * - Page view tracking (non-critical)
 * - UI interaction logging (non-critical)
 * - Frontend error logging (non-critical, server should also log)
 */
export const logActivity = async (
  logType: LogType,
  message: string,
  options: LogOptions = {}
): Promise<void> => {
  try {
    const {
      category = 'system',
      details = {},
      userType = 'guest',
      pageUrl = typeof window !== 'undefined' ? window.location.href : undefined,
      requestMethod,
      requestPath,
      responseStatus,
      errorStack
    } = options;

    // Get user agent and other browser info
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined;

    // Try to get IP (may not always be available client-side)
    let ipAddress: string | undefined;
    try {
      // This is a best-effort attempt - real IP would come from server
      if (typeof window !== 'undefined') {
        // For client-side, we can't reliably get IP, so we'll leave it null
        ipAddress = undefined;
      }
    } catch (e) {
      // Ignore IP fetching errors
    }

    // Sanitize all data before logging
    const sanitizedMessage = sanitizeString(message);
    const sanitizedDetails = Object.keys(details).length > 0 ? sanitizeObject(details) : null;
    const sanitizedPageUrl = pageUrl ? sanitizeString(pageUrl) : undefined;
    const sanitizedRequestPath = requestPath ? sanitizeString(requestPath) : undefined;
    const sanitizedErrorStack = errorStack ? sanitizeString(errorStack) : undefined;
    
    // Insert log into database (all sensitive data sanitized)
    const { error } = await supabase
      .from('site_logs')
      .insert({
        log_type: logType,
        category,
        message: sanitizedMessage,
        details: sanitizedDetails,
        user_type: userType,
        ip_address: ipAddress,
        user_agent: userAgent,
        page_url: sanitizedPageUrl,
        request_method: requestMethod,
        request_path: sanitizedRequestPath,
        response_status: responseStatus,
        error_stack: sanitizedErrorStack
      });

    if (error) {
      // Don't throw error to avoid infinite loops - just log to console
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    // Silently fail logging to prevent logging errors from breaking the app
    console.error('Error in logActivity:', error);
  }
};

/**
 * Helper functions for different log types
 */
export const logger = {
  info: (message: string, options?: LogOptions) => 
    logActivity('info', message, options),
  
  warning: (message: string, options?: LogOptions) => 
    logActivity('warning', message, options),
  
  error: (message: string, error?: Error | unknown, options?: LogOptions) => {
    const errorStack = error instanceof Error ? sanitizeString(error.stack || '') : sanitizeString(String(error));
    return logActivity('error', message, {
      ...options,
      errorStack,
      category: options?.category || 'error',
      details: options?.details ? sanitizeObject(options.details) : undefined
    });
  },
  
  success: (message: string, options?: LogOptions) => 
    logActivity('success', message, options),
  
  action: (message: string, options?: LogOptions) => 
    logActivity('action', message, { ...options, category: options?.category || 'user_action' })
};

/**
 * Log page views
 */
export const logPageView = (page: string, userType: 'admin' | 'ambassador' | 'guest' = 'guest') => {
  logger.info(`Page viewed: ${page}`, {
    category: 'page_view',
    userType,
    details: { page }
  });
};

/**
 * Log form submissions
 */
export const logFormSubmission = (
  formName: string, 
  success: boolean, 
  details?: LogDetails,
  userType: 'admin' | 'ambassador' | 'guest' = 'guest'
) => {
  const logType = success ? 'success' : 'error';
  logger[logType](`Form submission: ${formName}`, {
    category: 'form_submission',
    userType,
    details: { formName, success, ...details }
  });
};

/**
 * Log API calls
 */
export const logApiCall = (
  method: string,
  path: string,
  status: number,
  details?: LogDetails,
  startTime?: number
) => {
  const logType = status >= 200 && status < 300 ? 'success' : 'error';
  const duration = startTime ? Date.now() - startTime : undefined;
  
  logger[logType](`API ${method} ${path} - ${status}${duration ? ` (${duration}ms)` : ''}`, {
    category: 'api_call',
    details: { 
      method, 
      path, 
      status, 
      duration,
      ...details 
    },
    requestMethod: method,
    requestPath: path,
    responseStatus: status
  });
};

/**
 * Log performance metrics
 */
export const logPerformance = (
  operation: string,
  duration: number,
  details?: LogDetails,
  userType: 'admin' | 'ambassador' | 'guest' = 'guest'
) => {
  const logType = duration > 1000 ? 'warning' : duration > 3000 ? 'error' : 'info';
  logger[logType](`Performance: ${operation} took ${duration}ms`, {
    category: 'system',
    userType,
    details: {
      operation,
      duration,
      isSlow: duration > 1000,
      ...details
    }
  });
};

/**
 * Log database operations
 */
export const logDatabaseOperation = (
  operation: string,
  table: string,
  success: boolean,
  duration?: number,
  error?: Error | unknown
) => {
  const logType = success ? 'success' : 'error';
  const errorStack = error instanceof Error ? error.stack : String(error);
  
  logger[logType](`Database ${operation} on ${table}${duration ? ` (${duration}ms)` : ''}`, {
    category: 'database',
    details: {
      operation,
      table,
      success,
      duration,
      ...(error && { error: errorStack })
    },
    errorStack: success ? undefined : errorStack
  });
};

/**
 * Log security events
 */
export const logSecurityEvent = (
  event: string,
  details?: LogDetails,
  suspicious: boolean = false
) => {
  const logType = suspicious ? 'warning' : 'info';
  logger[logType](`Security: ${event}`, {
    category: 'system',
    details: {
      event,
      suspicious,
      ...details
    }
  });
};


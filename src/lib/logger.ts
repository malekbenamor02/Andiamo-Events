import { supabase } from "@/integrations/supabase/client";

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

    // Insert log into database
    const { error } = await supabase
      .from('site_logs')
      .insert({
        log_type: logType,
        category,
        message,
        details: Object.keys(details).length > 0 ? details : null,
        user_type: userType,
        ip_address: ipAddress,
        user_agent: userAgent,
        page_url: pageUrl,
        request_method: requestMethod,
        request_path: requestPath,
        response_status: responseStatus,
        error_stack: errorStack
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
    const errorStack = error instanceof Error ? error.stack : String(error);
    return logActivity('error', message, {
      ...options,
      errorStack,
      category: options?.category || 'error'
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


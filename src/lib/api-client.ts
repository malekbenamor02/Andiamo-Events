/**
 * Centralized API client for handling authenticated requests
 * Automatically handles 401 errors by clearing tokens and redirecting to login
 * Prevents console errors from appearing for expired tokens
 * Handles 404 errors gracefully with user-friendly messages
 */

// Flag to prevent multiple redirects
let isRedirecting = false;

/**
 * Handles 401 Unauthorized errors by:
 * 1. Clearing any stored tokens from localStorage
 * 2. Redirecting to login page
 * 3. Preventing console errors
 */
const handleUnauthorized = (loginPath = '/admin/login') => {
  if (isRedirecting) {
    return;
  }
  isRedirecting = true;

  setTimeout(() => {
    window.location.href = loginPath;
  }, 100);
};

/**
 * Wrapper around fetch that automatically handles 401 errors
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options (same as native fetch)
 * @returns Promise<Response> - The fetch response
 */
export const apiFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  // Ensure credentials are included for cookie-based auth
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
  };

  try {
    const response = await fetch(url, fetchOptions);

    // Handle 401 Unauthorized responses - STRICT: immediate redirect
    // This happens when JWT 'exp' field has passed or token is invalid
    // BUT: Only redirect for admin endpoints, not for ambassador/login endpoints
    if (response.status === 401) {
      const isAdminEndpoint =
        url.includes('/api/admin-') ||
        url.includes('/api/verify-admin') ||
        url.includes('/api/send-email') ||
        url.includes('/api/resend-order-completion-email') ||
        url.includes('/api/email-delivery-logs');

      const isAmbassadorSessionEndpoint =
        url.includes('/api/ambassador/me') ||
        url.includes('/api/ambassador/orders') ||
        url.includes('/api/ambassador/performance') ||
        url.includes('/api/ambassador/confirm-cash') ||
        url.includes('/api/ambassador/cancel-order') ||
        url.includes('/api/ambassador-update-password') ||
        url.includes('/api/ambassador-logout');
      
      if (isAdminEndpoint) {
        handleUnauthorized('/admin/login');
        
        return new Response(
          JSON.stringify({ 
            error: 'Unauthorized', 
            valid: false,
            reason: 'Token expired or invalid - session ended'
          }),
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      if (isAmbassadorSessionEndpoint && !window.location.pathname.startsWith('/ambassador/auth')) {
        handleUnauthorized('/ambassador/auth');
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            valid: false,
            reason: 'Ambassador session expired or invalid',
          }),
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Handle 404: unknown routes vs valid JSON errors (e.g. "Order not found")
    if (response.status === 404) {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return response;
      }
      return new Response(
        JSON.stringify({
          error: 'API endpoint not found',
          message: 'The requested API endpoint does not exist. Please check the route configuration.',
          status: 404,
        }),
        {
          status: 404,
          statusText: 'Not Found',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return response;
  } catch (error) {
    // Only log non-401 errors to console
    // Network errors and other issues should still be logged
    // 401 errors are handled above and won't reach this catch block
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network error - this is fine to log
      console.error('Network error:', error);
    }
    
    // Re-throw the error so calling code can handle it
    throw error;
  }
};

/**
 * Reset the redirect flag (useful for testing or manual resets)
 */
export const resetApiClient = () => {
  isRedirecting = false;
};

/**
 * Safe API response handler
 * Checks response.ok and provides user-friendly error messages
 * Prevents console errors and provides graceful error handling
 * 
 * @param response - The API response
 * @param defaultErrorMessage - Default error message if response doesn't contain one
 * @returns Promise with parsed JSON data or throws error
 */
export const handleApiResponse = async <T = any>(
  response: Response,
  defaultErrorMessage: string = 'An error occurred while processing your request'
): Promise<T> => {
  if (!response.ok) {
    let errorMessage = defaultErrorMessage;
    let errorData: any = null;

    try {
      errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = response.statusText || defaultErrorMessage;
    }

    // Handle specific error cases
    if (response.status === 404) {
      errorMessage = errorData?.error || errorData?.message || 'The requested resource was not found. Please check the API endpoint.';
    } else if (response.status === 500) {
      errorMessage = errorData?.error || errorData?.message || 'A server error occurred. Please try again later.';
    } else if (response.status === 400) {
      errorMessage = errorData?.error || errorData?.message || errorData?.details || 'Invalid request. Please check your input.';
    }

    // Create a user-friendly error object
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).data = errorData;
    
    // Don't log 401/404 errors to console (they're handled silently)
    if (response.status !== 401 && response.status !== 404) {
      console.error(`API Error (${response.status}):`, errorMessage);
    }
    
    throw error;
  }

  // Parse and return JSON response
  try {
    return await response.json();
  } catch (e) {
    // If response is not JSON, return empty object
    return {} as T;
  }
};

/**
 * Safe API call wrapper
 * Combines apiFetch and handleApiResponse for complete error handling
 * 
 * @param url - The API URL (use API_ROUTES constants)
 * @param options - Fetch options
 * @param defaultErrorMessage - Custom error message
 * @returns Promise with parsed JSON data
 * 
 * @example
 * ```ts
 * try {
 *   const data = await safeApiCall(API_ROUTES.VERIFY_ADMIN);
 *   console.log(data);
 * } catch (error) {
 *   // Error is already handled, just show user-friendly message
 *   toast.error(error.message);
 * }
 * ```
 */
export const safeApiCall = async <T = any>(
  url: string,
  options: RequestInit = {},
  defaultErrorMessage?: string
): Promise<T> => {
  const response = await apiFetch(url, options);
  return handleApiResponse<T>(response, defaultErrorMessage);
};


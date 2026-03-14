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
const handleUnauthorized = () => {
  // Prevent multiple redirects
  if (isRedirecting) {
    return;
  }
  isRedirecting = true;

  // No localStorage cleanup needed - session is managed by server token only

  // Redirect to login page
  // Use a small delay to ensure cleanup happens first
  setTimeout(() => {
    window.location.href = '/admin/login';
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
      // Check if this is an admin endpoint that requires token-based auth
      const isAdminEndpoint = url.includes('/api/admin-') || 
                              url.includes('/api/verify-admin') ||
                              url.includes('/api/send-email');
      
      // Only redirect for admin endpoints (token expiration)
      // For ambassador/login endpoints, 401 just means invalid credentials - don't redirect
      if (isAdminEndpoint) {
        // STRICT: Token expired or invalid - redirect immediately
        // No token refresh, no extension - session is over
        handleUnauthorized();
        
        // Return a response that won't cause console errors
        // Create a mock response that indicates unauthorized
        // This prevents the browser from logging the 401 error
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
      // For non-admin endpoints (like ambassador-login), just return the original response
      // so the error message can be displayed to the user
    }

    // Handle 404 Not Found responses gracefully
    if (response.status === 404) {
      // Don't log 404 errors to console - handle them silently
      // Return a response with a user-friendly error message
      return new Response(
        JSON.stringify({ 
          error: 'API endpoint not found', 
          message: 'The requested API endpoint does not exist. Please check the route configuration.',
          status: 404
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


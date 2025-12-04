/**
 * API Configuration
 * Handles API base URL for development vs production
 */

/**
 * Get the API base URL based on environment
 * - Development: Uses Vite proxy (relative URLs work)
 * - Production on Vercel: Uses relative URLs (backend is on same domain as serverless functions)
 * - Production with separate backend: Uses VITE_API_URL if set
 */
export const getApiBaseUrl = (): string => {
  // If VITE_API_URL is explicitly set, use it (for separate backend deployment)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Otherwise, use relative URLs:
  // - Development: Vite proxy handles it
  // - Production on Vercel: Serverless functions on same domain
  return '';
};

/**
 * Build a full API URL
 * @param route - API route (e.g., '/api/admin-login')
 * @returns Full URL or relative URL depending on environment
 */
export const buildApiUrl = (route: string): string => {
  const baseUrl = getApiBaseUrl();
  
  if (baseUrl) {
    // Remove trailing slash from base URL if present
    const cleanBase = baseUrl.replace(/\/$/, '');
    // Ensure route starts with /
    const cleanRoute = route.startsWith('/') ? route : `/${route}`;
    return `${cleanBase}${cleanRoute}`;
  }
  
  // Return relative URL (works with Vite proxy in dev, or same domain in prod)
  return route;
};


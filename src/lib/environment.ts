/**
 * Environment detection utilities
 * Helps determine if we're in development, preview, or production
 */

/**
 * Check if we're in a development/preview environment
 * Returns true for:
 * - localhost
 * - Vercel preview deployments (*.vercel.app)
 * - Development environments
 */
export const isDevelopmentOrPreview = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Check for localhost
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.0.')
  ) {
    return true;
  }
  
  // Check for Vercel preview deployments
  // Vercel preview URLs look like: https://your-app-abc123.vercel.app
  // Production would typically have a custom domain
  if (hostname.endsWith('.vercel.app')) {
    return true;
  }
  
  // Check for Vercel branch preview URLs (if available in environment)
  // Vercel sets VERCEL_ENV environment variable
  if (import.meta.env.VERCEL_ENV === 'preview') {
    return true;
  }
  
  return false;
};

/**
 * Check if we're in production
 */
export const isProduction = (): boolean => {
  return !isDevelopmentOrPreview();
};

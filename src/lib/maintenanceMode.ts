/**
 * Maintenance Mode Utility
 * 
 * Provides utilities for checking if a route should be excluded from maintenance mode.
 * Admin, Scanner, and Ambassador dashboard routes are always accessible during maintenance.
 */

/**
 * Checks if the given pathname should be excluded from maintenance mode
 * @param pathname - The current route pathname
 * @param allowAmbassadorApplication - Whether to allow ambassador application page during maintenance
 * @returns true if the route should be excluded from maintenance mode
 */
export const isExcludedFromMaintenance = (pathname: string, allowAmbassadorApplication: boolean = false): boolean => {
  // Allow admin routes (always accessible)
  if (pathname.startsWith('/admin')) {
    return true;
  }
  
  // Allow scanner routes (always accessible)
  if (pathname.startsWith('/scanner')) {
    return true;
  }
  
  // Allow ambassador dashboard routes (always accessible)
  if (pathname.startsWith('/ambassador/dashboard')) {
    return true;
  }
  
  // Allow ambassador application page if enabled in settings
  if (allowAmbassadorApplication && pathname.startsWith('/ambassador')) {
    return true;
  }
  
  return false;
};


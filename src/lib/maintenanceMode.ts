/**
 * Maintenance Mode Utility
 * 
 * Provides utilities for checking if a route should be excluded from maintenance mode.
 * Admin and Ambassador dashboard routes are always accessible during maintenance.
 */

/**
 * Checks if the given pathname should be excluded from maintenance mode
 * @param pathname - The current route pathname
 * @returns true if the route should be excluded from maintenance mode (admin/ambassador dashboard)
 */
export const isExcludedFromMaintenance = (pathname: string): boolean => {
  // Allow admin routes
  if (pathname.startsWith('/admin')) {
    return true;
  }
  
  // Allow ambassador dashboard routes
  if (pathname.startsWith('/ambassador/dashboard')) {
    return true;
  }
  
  return false;
};


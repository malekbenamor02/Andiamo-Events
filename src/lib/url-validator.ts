/**
 * URL Validation and Safety Utilities
 * 
 * Prevents malformed URLs from being generated or used in the application.
 * All dynamic URL generation should use these utilities to ensure valid URLs.
 */

/**
 * Validates if a string is a valid URL
 */
export const isValidUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Check for common malformed patterns
  if (url.includes('undefined') || url.includes('null') || url.includes('NaN')) {
    return false;
  }

  // Check for suspicious patterns that indicate malformed concatenation
  if (url.match(/[a-z]{20,}/i) && !url.includes('://') && !url.startsWith('/')) {
    // Long strings without protocol or leading slash are suspicious
    return false;
  }

  try {
    // Try to create a URL object (works for absolute URLs)
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      new URL(url);
      return true;
    }
    
    // For relative URLs, check basic format
    if (url.startsWith('/')) {
      // Relative URL - check it doesn't have invalid characters
      return !url.includes('undefined') && !url.includes('null');
    }

    // For other strings, check if they look like valid paths
    return url.length > 0 && !url.includes('undefined') && !url.includes('null');
  } catch {
    return false;
  }
};

/**
 * Safely builds a URL by validating all parts
 */
export const buildSafeUrl = (
  base: string | null | undefined,
  ...paths: (string | null | undefined)[]
): string | null => {
  // Validate base URL
  if (!base || typeof base !== 'string') {
    console.warn('buildSafeUrl: Invalid base URL', base);
    return null;
  }

  // Clean and validate base
  const cleanBase = base.trim().replace(/\/+$/, ''); // Remove trailing slashes
  
  // Validate and clean paths
  const validPaths = paths
    .filter((path): path is string => {
      if (!path || typeof path !== 'string') {
        return false;
      }
      // Filter out undefined/null values
      if (path === 'undefined' || path === 'null' || path === 'NaN') {
        return false;
      }
      return true;
    })
    .map(path => path.trim().replace(/^\/+|\/+$/g, '')) // Remove leading/trailing slashes
    .filter(path => path.length > 0);

  // Build URL
  const fullPath = validPaths.length > 0 
    ? `/${validPaths.join('/')}`
    : '';

  const url = `${cleanBase}${fullPath}`;

  // Final validation
  if (!isValidUrl(url)) {
    console.warn('buildSafeUrl: Generated invalid URL', url);
    return null;
  }

  return url;
};

/**
 * Safely builds an API URL using the API routes constants
 */
export const buildApiUrl = (
  route: string,
  baseUrl?: string
): string | null => {
  const apiBase = baseUrl || '';
  
  // Ensure route starts with /api
  if (!route.startsWith('/api')) {
    console.warn('buildApiUrl: Route must start with /api', route);
    return null;
  }

  // If baseUrl is provided, build full URL
  if (apiBase) {
    return buildSafeUrl(apiBase, route);
  }

  // Otherwise, return the route as-is (relative URL)
  if (!isValidUrl(route)) {
    console.warn('buildApiUrl: Invalid route', route);
    return null;
  }

  return route;
};

/**
 * Safely encodes URL parameters
 */
export const buildQueryString = (
  params: Record<string, string | number | boolean | null | undefined>
): string => {
  const validParams: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    // Skip undefined, null, or empty values
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Validate key
    if (!key || typeof key !== 'string' || key === 'undefined' || key === 'null') {
      continue;
    }

    // Encode value
    const encodedValue = encodeURIComponent(String(value));
    validParams.push(`${encodeURIComponent(key)}=${encodedValue}`);
  }

  return validParams.length > 0 ? `?${validParams.join('&')}` : '';
};

/**
 * Safely builds a complete URL with query parameters
 */
export const buildUrlWithParams = (
  base: string,
  params?: Record<string, string | number | boolean | null | undefined>
): string | null => {
  if (!isValidUrl(base)) {
    console.warn('buildUrlWithParams: Invalid base URL', base);
    return null;
  }

  const queryString = params ? buildQueryString(params) : '';
  const fullUrl = `${base}${queryString}`;

  if (!isValidUrl(fullUrl)) {
    console.warn('buildUrlWithParams: Generated invalid URL', fullUrl);
    return null;
  }

  return fullUrl;
};

/**
 * Validates and sanitizes a URL before using it
 * Returns null if URL is invalid, preventing broken requests
 */
export const sanitizeUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Check for common issues
  if (url.includes('undefined') || url.includes('null') || url.includes('NaN')) {
    return null;
  }

  // Check for suspicious patterns
  if (url.length > 2000) {
    // URLs shouldn't be this long
    return null;
  }

  if (!isValidUrl(url)) {
    return null;
  }

  return url.trim();
};


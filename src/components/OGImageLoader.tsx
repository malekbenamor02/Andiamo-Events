import { useEffect } from 'react';

/**
 * Component that dynamically sets Open Graph and Twitter meta tags
 * Uses the og-image.png from public folder (accessible at /og-image.png)
 * 
 * Note: For OG images to work properly with social media crawlers,
 * they need absolute URLs and must be accessible at a static path.
 * Files in the public folder are served as-is at the root URL.
 */
export const OGImageLoader = () => {
  useEffect(() => {
    // Get the base URL for absolute image URL
    const baseUrl = window.location.origin;
    
    // Use the public folder image - accessible at /og-image.png
    // For Facebook and other crawlers, we need a stable URL without cache-busting
    // The cache-busting is only for browser refresh, not for social media crawlers
    // Social media platforms cache based on the URL, so we use a version parameter
    // that only changes when the image actually changes
    const imageUrl = `${baseUrl}/og-image.png?v=2`;
    
    // Update or create OG image meta tags
    const updateMetaTag = (property: string, content: string) => {
      // Remove any existing meta tag with this property first
      const existing = document.querySelector(`meta[property="${property}"]`);
      if (existing) {
        existing.remove();
      }
      
      // Create new meta tag
      const meta = document.createElement('meta');
      meta.setAttribute('property', property);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    };

    const updateNameTag = (name: string, content: string) => {
      // Remove any existing meta tag with this name first
      const existing = document.querySelector(`meta[name="${name}"]`);
      if (existing) {
        existing.remove();
      }
      
      // Create new meta tag
      const meta = document.createElement('meta');
      meta.setAttribute('name', name);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    };

    // Update OG image tags with absolute URL (no cache-busting for crawlers)
    // Use a version parameter that you can increment when you change the image
    updateMetaTag('og:image', imageUrl);
    updateMetaTag('og:image:secure_url', imageUrl);
    updateNameTag('twitter:image', imageUrl);

    // Also update the image alt text if needed
    updateMetaTag('og:image:alt', 'Andiamo Events - Tunisia\'s Premier Nightlife Experience');
    updateNameTag('twitter:image:alt', 'Andiamo Events - Tunisia\'s Premier Nightlife Experience');
    
    console.log('OG Image URL set to:', imageUrl);
  }, []);

  return null;
};

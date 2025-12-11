import { useEffect } from 'react';

/**
 * Component that dynamically sets Open Graph and Twitter meta tags
 * Uses the og_image.png from public folder (accessible at /og_image.png)
 * 
 * Note: For OG images to work properly with social media crawlers,
 * they need absolute URLs and must be accessible at a static path.
 * Files in the public folder are served as-is at the root URL.
 */
export const OGImageLoader = () => {
  useEffect(() => {
    // Get the base URL for absolute image URL
    const baseUrl = window.location.origin;
    
    // Use the public folder image - accessible at /og_image.png
    // Add cache-busting parameter to force refresh
    const imageUrl = `${baseUrl}/og_image.png?t=${Date.now()}`;
    
    // Update or create OG image meta tags
    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    const updateNameTag = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Update OG image tags with absolute URL
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

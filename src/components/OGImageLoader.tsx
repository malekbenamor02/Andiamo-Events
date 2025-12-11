import { useEffect } from 'react';
import ogImage from '@/assets/og_image.png';

/**
 * Component that dynamically sets Open Graph and Twitter meta tags
 * Uses the og_image.png from assets folder
 * 
 * Note: For OG images to work properly with social media crawlers,
 * they need absolute URLs. This component converts the asset path
 * to an absolute URL based on the current origin.
 */
export const OGImageLoader = () => {
  useEffect(() => {
    // Get the base URL for absolute image URL
    const baseUrl = window.location.origin;
    
    // Vite processes assets and returns the processed path
    // We need to convert it to an absolute URL for OG tags
    let imageUrl: string;
    
    if (typeof ogImage === 'string') {
      // If it's already a string (URL), use it directly
      // If it starts with /, it's a relative path, make it absolute
      if (ogImage.startsWith('/')) {
        imageUrl = `${baseUrl}${ogImage}`;
      } else if (ogImage.startsWith('http')) {
        // Already absolute
        imageUrl = ogImage;
      } else {
        // Vite asset path, make it absolute
        imageUrl = `${baseUrl}${ogImage}`;
      }
    } else {
      // Fallback to public folder
      imageUrl = `${baseUrl}/og-image.png`;
    }
    
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

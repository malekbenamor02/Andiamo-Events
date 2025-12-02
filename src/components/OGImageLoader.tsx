import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchOGImageSettings } from '@/lib/og-image';

/**
 * Component that dynamically loads OG image from database and updates meta tags
 * Uses direct Supabase Storage URL with version parameter for automatic cache-busting
 * Listens for real-time changes to update OG image when it's added/removed
 */
export const OGImageLoader = () => {
  useEffect(() => {
    const loadOGImage = async () => {
      try {
        // Fetch OG image URL from API endpoint (gets latest from database with version)
        const response = await fetch('/api/og-image-url');
        
        if (!response.ok) {
          // If no OG image is set, remove any existing OG image tags to prevent errors
          const ogImageTag = document.querySelector('meta[property="og:image"]');
          const ogImageSecureTag = document.querySelector('meta[property="og:image:secure_url"]');
          const twitterImageTag = document.querySelector('meta[name="twitter:image"]');
          
          if (ogImageTag) ogImageTag.remove();
          if (ogImageSecureTag) ogImageSecureTag.remove();
          if (twitterImageTag) twitterImageTag.remove();
          return;
        }

        const data = await response.json();
        const ogImageUrl = data.url; // Already includes version parameter

        // Helper function to update or create meta tag
        const setMetaTag = (property: string, content: string, isName = false) => {
          const selector = isName 
            ? `meta[name="${property}"]` 
            : `meta[property="${property}"]`;
          let meta = document.querySelector(selector) as HTMLMetaElement;
          
          if (!meta) {
            meta = document.createElement('meta');
            if (isName) {
              meta.setAttribute('name', property);
            } else {
              meta.setAttribute('property', property);
            }
            document.head.appendChild(meta);
          }
          meta.setAttribute('content', content);
        };

        // Determine content type from URL
        const getContentType = (url: string): string => {
          if (url.includes('.png')) return 'image/png';
          if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
          if (url.includes('.gif')) return 'image/gif';
          if (url.includes('.webp')) return 'image/webp';
          return 'image/jpeg'; // Default
        };

        const contentType = getContentType(ogImageUrl);
        
        // Update OG tags with direct Supabase Storage URL (includes version parameter for cache-busting)
        setMetaTag('og:image', ogImageUrl);
        setMetaTag('og:image:secure_url', ogImageUrl);
        setMetaTag('og:image:type', contentType);
        setMetaTag('og:image:width', '1200');
        setMetaTag('og:image:height', '630');

        // Add Twitter image meta tag
        setMetaTag('twitter:image', ogImageUrl, true);
        
        console.log('OG image meta tags updated with URL:', ogImageUrl);
      } catch (error) {
        console.error('Error loading OG image from database:', error);
        // Remove OG image tags if there's an error
        const ogImageTag = document.querySelector('meta[property="og:image"]');
        const ogImageSecureTag = document.querySelector('meta[property="og:image:secure_url"]');
        const twitterImageTag = document.querySelector('meta[name="twitter:image"]');
        
        if (ogImageTag) ogImageTag.remove();
        if (ogImageSecureTag) ogImageSecureTag.remove();
        if (twitterImageTag) twitterImageTag.remove();
      }
    };

    // Load OG image on mount
    loadOGImage();

    // Set up real-time subscription to listen for changes
    const channel = supabase
      .channel('og-image-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_content',
          filter: 'key=eq.og_image_settings'
        },
        () => {
          // Reload OG image when settings change
          loadOGImage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
};

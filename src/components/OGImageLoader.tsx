import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchOGImageSettings } from '@/lib/og-image';

/**
 * Component that dynamically loads OG image from database and updates meta tags
 * Listens for real-time changes to update OG image when it's added/removed
 */
export const OGImageLoader = () => {
  useEffect(() => {
    const loadOGImage = async () => {
      try {
        const settings = await fetchOGImageSettings();

        // Remove existing OG image meta tags
        const existingOGImage = document.querySelector('meta[property="og:image"]');
        const existingTwitterImage = document.querySelector('meta[name="twitter:image"]');
        
        if (existingOGImage) existingOGImage.remove();
        if (existingTwitterImage) existingTwitterImage.remove();

        // Helper function to add cache-busting parameter
        const addCacheBuster = (url: string, timestamp?: string) => {
          const separator = url.includes('?') ? '&' : '?';
          const cacheBuster = timestamp || Date.now().toString();
          return `${url}${separator}v=${cacheBuster}`;
        };

        // Only use OG image from database (no fallback to hardcoded images)
        if (settings.og_image) {
          // Ensure the URL is absolute (full URL with protocol)
          let ogImageUrl = settings.og_image;
          if (!ogImageUrl.startsWith('http://') && !ogImageUrl.startsWith('https://')) {
            // If relative URL, make it absolute
            ogImageUrl = ogImageUrl.startsWith('/') 
              ? `${window.location.origin}${ogImageUrl}`
              : `${window.location.origin}/${ogImageUrl}`;
          }
          
          // Add cache-busting timestamp
          ogImageUrl = addCacheBuster(ogImageUrl, settings.updated_at);
          
          // Remove any existing OG image meta tags (including width, height, type)
          const existingOGTags = document.querySelectorAll('meta[property^="og:image"]');
          existingOGTags.forEach(tag => tag.remove());
          
          // Add OG image meta tag
          const ogImageMeta = document.createElement('meta');
          ogImageMeta.setAttribute('property', 'og:image');
          ogImageMeta.setAttribute('content', ogImageUrl);
          document.head.appendChild(ogImageMeta);

          // Add OG image secure URL (required by some platforms)
          const ogImageSecureMeta = document.createElement('meta');
          ogImageSecureMeta.setAttribute('property', 'og:image:secure_url');
          ogImageSecureMeta.setAttribute('content', ogImageUrl);
          document.head.appendChild(ogImageSecureMeta);

          // Add OG image type
          const ogImageTypeMeta = document.createElement('meta');
          ogImageTypeMeta.setAttribute('property', 'og:image:type');
          ogImageTypeMeta.setAttribute('content', 'image/jpeg');
          document.head.appendChild(ogImageTypeMeta);

          // Add Twitter image meta tag
          const twitterImageMeta = document.createElement('meta');
          twitterImageMeta.setAttribute('name', 'twitter:image');
          twitterImageMeta.setAttribute('content', ogImageUrl);
          document.head.appendChild(twitterImageMeta);
        }
        // If no OG image in database, don't add any meta tags
        // Admin can upload one from the dashboard
      } catch (error) {
        console.error('Error loading OG image from database:', error);
        // Don't add fallback - let admin upload from dashboard
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

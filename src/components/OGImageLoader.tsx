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

        // If no OG image in database, use default from public folder
        if (!settings.og_image) {
          // Use default OG image from public folder
          const defaultOGImage = `${window.location.origin}/og-image.jpg`;
          
          // Add OG image meta tag
          const ogImageMeta = document.createElement('meta');
          ogImageMeta.setAttribute('property', 'og:image');
          ogImageMeta.setAttribute('content', defaultOGImage);
          document.head.appendChild(ogImageMeta);

          // Add Twitter image meta tag
          const twitterImageMeta = document.createElement('meta');
          twitterImageMeta.setAttribute('name', 'twitter:image');
          twitterImageMeta.setAttribute('content', defaultOGImage);
          document.head.appendChild(twitterImageMeta);
        } else {
          // Use OG image from database
          const ogImageMeta = document.createElement('meta');
          ogImageMeta.setAttribute('property', 'og:image');
          ogImageMeta.setAttribute('content', settings.og_image);
          document.head.appendChild(ogImageMeta);

          // Add Twitter image meta tag
          const twitterImageMeta = document.createElement('meta');
          twitterImageMeta.setAttribute('name', 'twitter:image');
          twitterImageMeta.setAttribute('content', settings.og_image);
          document.head.appendChild(twitterImageMeta);
        }
      } catch (error) {
        console.error('Error loading OG image from database:', error);
        // Fallback to default OG image
        const defaultOGImage = `${window.location.origin}/og-image.jpg`;
        
        const ogImageMeta = document.createElement('meta');
        ogImageMeta.setAttribute('property', 'og:image');
        ogImageMeta.setAttribute('content', defaultOGImage);
        document.head.appendChild(ogImageMeta);

        const twitterImageMeta = document.createElement('meta');
        twitterImageMeta.setAttribute('name', 'twitter:image');
        twitterImageMeta.setAttribute('content', defaultOGImage);
        document.head.appendChild(twitterImageMeta);
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


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

        // Helper function to add cache-busting parameter
        const addCacheBuster = (url: string, timestamp?: string) => {
          const separator = url.includes('?') ? '&' : '?';
          const cacheBuster = timestamp || Date.now().toString();
          return `${url}${separator}v=${cacheBuster}`;
        };

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
          
          // Add all required OpenGraph image tags (will update existing or create new)
          setMetaTag('og:image', ogImageUrl);
          setMetaTag('og:image:secure_url', ogImageUrl);
          setMetaTag('og:image:type', 'image/jpeg');
          setMetaTag('og:image:width', '1200');
          setMetaTag('og:image:height', '630');

          // Add Twitter image meta tag
          setMetaTag('twitter:image', ogImageUrl, true);
        } else {
          // If no OG image in database, ensure no empty OG image tags exist
          // Facebook crawler requires og:image to have a valid URL or be absent
          const emptyOGTags = document.querySelectorAll('meta[property^="og:image"]');
          emptyOGTags.forEach(tag => {
            const content = tag.getAttribute('content');
            if (!content || content.trim() === '') {
              tag.remove();
            }
          });
          
          // Also remove empty Twitter image tag
          const emptyTwitterTag = document.querySelector('meta[name="twitter:image"]');
          if (emptyTwitterTag) {
            const content = emptyTwitterTag.getAttribute('content');
            if (!content || content.trim() === '') {
              emptyTwitterTag.remove();
            }
          }
        }
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

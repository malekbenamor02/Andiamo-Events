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

        // Use server-side route /api/og-image which handles the redirect to Supabase Storage
        // This ensures Facebook/Instagram crawlers always see the correct image via server-side rendering
        // The route will automatically add version parameters for cache-busting
        const ogImageRoute = '/api/og-image';
        const absoluteOgImageUrl = `${window.location.origin}${ogImageRoute}`;
        
        // Update server-side OG tags with absolute URL (for crawlers)
        // The /api/og-image route will redirect to the actual Supabase Storage URL with versioning
        setMetaTag('og:image', absoluteOgImageUrl);
        setMetaTag('og:image:secure_url', absoluteOgImageUrl);
        setMetaTag('og:image:type', 'image/jpeg');
        setMetaTag('og:image:width', '1200');
        setMetaTag('og:image:height', '630');

        // Add Twitter image meta tag
        setMetaTag('twitter:image', absoluteOgImageUrl, true);
        
        // Note: The /api/og-image route will return 404 if no image is uploaded
        // But we keep the tags pointing to the route so crawlers can see the structure
        // Admin can upload image from dashboard and it will work immediately
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

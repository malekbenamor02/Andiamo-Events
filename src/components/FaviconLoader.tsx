import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchFaviconSettings } from '@/lib/favicon';

/**
 * Component that dynamically loads favicon from database
 * Listens for real-time changes to update favicons when they're added/removed
 */
export const FaviconLoader = () => {
  useEffect(() => {
    const loadFavicons = async () => {
      try {
        const settings = await fetchFaviconSettings();

        // If no settings found, don't remove default favicons
        if (!settings || Object.keys(settings).length === 0) {
          return;
        }

        // Remove ALL existing favicon links first (including default ones from index.html)
        const existingLinks = document.querySelectorAll('link[rel*="icon"], link[rel*="apple-touch-icon"]');
        existingLinks.forEach(link => link.remove());

        // Helper function to add cache-busting parameter
        const addCacheBuster = (url: string, timestamp?: string) => {
          if (!url) return url;
          const separator = url.includes('?') ? '&' : '?';
          const cacheBuster = timestamp || Date.now().toString();
          return `${url}${separator}v=${cacheBuster}`;
        };

        // Add favicon links from database (only if they exist) with cache-busting
        if (settings.favicon_ico) {
          const link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/x-icon';
          link.href = addCacheBuster(settings.favicon_ico, settings.updated_at);
          document.head.appendChild(link);
        }

        if (settings.favicon_32x32) {
          const link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/png';
          link.sizes = '32x32';
          link.href = addCacheBuster(settings.favicon_32x32, settings.updated_at);
          document.head.appendChild(link);
        }

        if (settings.favicon_16x16) {
          const link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/png';
          link.sizes = '16x16';
          link.href = addCacheBuster(settings.favicon_16x16, settings.updated_at);
          document.head.appendChild(link);
        }

        if (settings.apple_touch_icon) {
          const link = document.createElement('link');
          link.rel = 'apple-touch-icon';
          link.sizes = '180x180';
          link.href = addCacheBuster(settings.apple_touch_icon, settings.updated_at);
          document.head.appendChild(link);
        }
      } catch (error) {
        console.error('Error loading favicon from database:', error);
      }
    };

    // Load favicon on mount
    loadFavicons();

    // Set up real-time subscription to listen for changes
    const channel = supabase
      .channel('favicon-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_content',
          filter: 'key=eq.favicon_settings'
        },
        () => {
          // Reload favicons when settings change
          loadFavicons();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
};


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
        const existingLinks = document.querySelectorAll('link[rel*="icon"], link[rel*="apple-touch-icon"], link[rel="shortcut icon"]');
        existingLinks.forEach(link => {
          // Force removal by setting href to empty first
          (link as HTMLLinkElement).href = '';
          link.remove();
        });

        // Small delay to ensure DOM is updated
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        // Helper function to add cache-busting parameter with multiple strategies
        const addCacheBuster = (url: string, timestamp?: string) => {
          if (!url) return url;
          const separator = url.includes('?') ? '&' : '?';
          const cacheBuster = timestamp || Date.now().toString();
          // Use multiple cache-busting parameters
          return `${url}${separator}v=${cacheBuster}&t=${Date.now()}&cb=${Math.random().toString(36).substring(7)}`;
        };

        // Add favicon links from database (only if they exist) with cache-busting
        // Add them in reverse order so the most specific ones come first
        if (settings.apple_touch_icon) {
          const link = document.createElement('link');
          link.rel = 'apple-touch-icon';
          link.sizes = '180x180';
          link.href = addCacheBuster(settings.apple_touch_icon, settings.updated_at);
          // Force reload by creating new link element
          link.setAttribute('data-favicon-loader', 'true');
          document.head.insertBefore(link, document.head.firstChild);
        }

        if (settings.favicon_32x32) {
          const link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/png';
          link.sizes = '32x32';
          link.href = addCacheBuster(settings.favicon_32x32, settings.updated_at);
          link.setAttribute('data-favicon-loader', 'true');
          document.head.insertBefore(link, document.head.firstChild);
        }

        if (settings.favicon_16x16) {
          const link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/png';
          link.sizes = '16x16';
          link.href = addCacheBuster(settings.favicon_16x16, settings.updated_at);
          link.setAttribute('data-favicon-loader', 'true');
          document.head.insertBefore(link, document.head.firstChild);
        }

        if (settings.favicon_ico) {
          const link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/x-icon';
          link.href = addCacheBuster(settings.favicon_ico, settings.updated_at);
          link.setAttribute('data-favicon-loader', 'true');
          document.head.insertBefore(link, document.head.firstChild);
        }

        // Force browser to reload favicon by temporarily changing document title
        const originalTitle = document.title;
        document.title = originalTitle + ' ';
        setTimeout(() => {
          document.title = originalTitle;
        }, 10);
      } catch (error) {
        console.error('Error loading favicon from database:', error);
      }
    };

    // Load favicon on mount
    loadFavicons();

    // Listen for custom favicon-updated event
    const handleFaviconUpdate = () => {
      loadFavicons();
    };
    window.addEventListener('favicon-updated', handleFaviconUpdate);

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
      window.removeEventListener('favicon-updated', handleFaviconUpdate);
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
};


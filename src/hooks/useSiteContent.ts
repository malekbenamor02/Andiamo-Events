import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch site content (navigation, contact info, etc.)
 * Cache: 1 hour (static content that rarely changes)
 */
export const useSiteContent = (keys: string[]) => {
  return useQuery({
    queryKey: ['site_content', keys],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .in('key', keys);

      if (error) {
        console.error('Error fetching site content:', error);
        throw error;
      }

      // Return as object with key as property
      const contentMap: Record<string, any> = {};
      data?.forEach(item => {
        contentMap[item.key] = item.content;
      });

      return contentMap;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - static content is fresh for 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in cache for 24 hours
  });
};

/**
 * Fetch navigation content
 * Cache: 1 hour
 */
export const useNavigationContent = () => {
  return useQuery({
    queryKey: ['site_content', 'navigation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .in('key', ['navigation', 'contact_info']);

      if (error) {
        console.error('Error fetching navigation content:', error);
        throw error;
      }

      const result: { navigation?: any; contact_info?: any } = {};
      data?.forEach(item => {
        if (item.key === 'navigation') {
          result.navigation = item.content;
        } else if (item.key === 'contact_info') {
          result.contact_info = item.content;
        }
      });

      return result;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
};

/**
 * Invalidate site content cache (call this when admin updates site content)
 */
export const useInvalidateSiteContent = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['site_content'] });
  };
};


import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EventPass {
  id?: string;
  name: string;
  price: number;
  description: string;
  is_primary: boolean;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  city: string;
  poster_url: string;
  instagram_link?: string;
  whatsapp_link?: string;
  featured: boolean;
  passes?: EventPass[];
  event_type?: 'upcoming' | 'gallery';
  gallery_images?: string[];
  gallery_videos?: string[];
  event_status?: 'active' | 'cancelled' | 'completed';
  age_restriction?: number;
  dress_code?: string;
  special_notes?: string;
  organizer_contact?: string;
  event_category?: string;
}

/**
 * Fetch all events with passes
 * Cache: 30 minutes (events don't change frequently)
 */
export const useEvents = () => {
  return useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: async () => {
      console.log('🔍 Fetching events from Supabase...');
      
      // Check if we're on localhost (for testing) or production
      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.0.')
      );
      
      // Fetch events
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('❌ Error fetching events:', error);
        throw error;
      }

      // Filter out test events if on production (not localhost)
      // On localhost, show all events including test events for full testing
      const filteredData = isLocalhost 
        ? data 
        : (data || []).filter((event: any) => !event.is_test);

      console.log('✅ Events fetched successfully:', filteredData?.length || 0, isLocalhost ? '(including test events)' : '(production - test events hidden)');

      // Fetch passes for all events
      const mappedEvents = await Promise.all(
        (filteredData || []).map(async (e: any) => {
          // Fetch passes for this event
          const { data: passesData, error: passesError } = await supabase
            .from('event_passes')
            .select('*')
            .eq('event_id', e.id)
            .order('is_primary', { ascending: false })
            .order('price', { ascending: true })
            .order('created_at', { ascending: true });

          // Handle 404 errors gracefully
          if (passesError && passesError.code !== 'PGRST116' && passesError.message !== 'relation "public.event_passes" does not exist') {
            console.error(`Error fetching passes for event ${e.id}:`, passesError);
          }

          // Map passes to EventPass format
          const passes = (passesData || []).map((p: any) => ({
            id: p.id,
            name: p.name || '',
            price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
            description: p.description || '',
            is_primary: p.is_primary || false
          }));

          return {
            ...e,
            instagram_link: e.whatsapp_link, // Map database field to UI field
            passes: passes
          };
        })
      );

      return mappedEvents;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - events are fresh for 30 min
    gcTime: 60 * 60 * 1000, // 60 minutes - keep in cache for 1 hour
  });
};

/**
 * Fetch featured/upcoming events only
 * Cache: 30 minutes
 */
export const useFeaturedEvents = () => {
  return useQuery<Event[]>({
    queryKey: ['events', 'featured'],
    queryFn: async () => {
      // Check if we're on localhost (for testing) or production
      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.0.')
      );
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_type', 'upcoming')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching featured events:', error);
        throw error;
      }

      // Filter out test events if on production (not localhost)
      const filteredData = isLocalhost 
        ? data 
        : (data || []).filter((event: any) => !event.is_test);

      // Map database whatsapp_link to instagram_link for UI
      const mappedEvents = (filteredData || []).map((e: any) => ({
        ...e,
        instagram_link: e.whatsapp_link
      }));

      return mappedEvents;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 60 minutes
  });
};

/**
 * Fetch single event by slug
 * Cache: 30 minutes
 */
export const useEventBySlug = (eventSlug: string | undefined) => {
  return useQuery<Event | null>({
    queryKey: ['events', 'slug', eventSlug],
    queryFn: async () => {
      if (!eventSlug) return null;

      // Check if we're on localhost (for testing) or production
      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.0.')
      );

      // Fetch all events and find by slug
      const { data, error } = await supabase
        .from('events')
        .select('*');

      if (error) {
        console.error('Error fetching event:', error);
        throw error;
      }

      // Filter out test events if on production (not localhost)
      const filteredData = isLocalhost 
        ? data 
        : (data || []).filter((event: any) => !event.is_test);

      // Find event by matching slug
      const event = (filteredData || []).find((e: any) => {
        const slug = e.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        return slug === eventSlug;
      });

      if (!event) return null;

      // Fetch passes for this event
      const { data: passesData } = await supabase
        .from('event_passes')
        .select('*')
        .eq('event_id', event.id)
        .order('is_primary', { ascending: false })
        .order('price', { ascending: true });

      const passes = (passesData || []).map((p: any) => ({
        id: p.id,
        name: p.name || '',
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        description: p.description || '',
        is_primary: p.is_primary || false
      }));

      return {
        ...event,
        instagram_link: event.whatsapp_link,
        passes: passes
      } as Event;
    },
    enabled: !!eventSlug, // Only run if eventSlug exists
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 60 minutes
  });
};

/**
 * Invalidate events cache (call this when admin updates events)
 */
export const useInvalidateEvents = () => {
  const queryClient = useQueryClient();
  
  return () => {
    // Invalidate all event-related queries
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };
};


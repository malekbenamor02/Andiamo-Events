/**
 * useActiveAmbassadors Hook
 * Fetches active ambassadors filtered by city/ville
 */

import { useQuery } from '@tanstack/react-query';
import { Ambassador } from '@/types/orders';
import { API_ROUTES } from '@/lib/api-routes';

interface ActiveAmbassadorsResponse {
  success: boolean;
  data: Ambassador[];
}

export function useActiveAmbassadors(city: string, ville?: string) {
  return useQuery<Ambassador[]>({
    queryKey: ['active-ambassadors', city, ville],
    queryFn: async () => {
      const params = new URLSearchParams({ city });
      if (ville) {
        params.append('ville', ville);
      }
      
      const response = await fetch(`${API_ROUTES.ACTIVE_AMBASSADORS}?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch active ambassadors');
      }
      const result: ActiveAmbassadorsResponse = await response.json();
      return result.data;
    },
    enabled: !!city, // Only fetch if city is provided
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}


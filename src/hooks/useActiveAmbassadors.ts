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
      
      try {
        const response = await fetch(`${API_ROUTES.ACTIVE_AMBASSADORS}?${params.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          // Try to parse error message from response
          let errorMessage = 'Failed to fetch active ambassadors';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If response is not JSON, use status text
            errorMessage = response.statusText || errorMessage;
          }
          
          throw new Error(errorMessage);
        }
        
        const result: ActiveAmbassadorsResponse = await response.json();
        
        // Handle both response formats: { data: [...] } or { success: true, data: [...] }
        if (result.data) {
          return result.data;
        }
        
        // If data is directly in result (for backward compatibility)
        if (Array.isArray(result)) {
          return result as Ambassador[];
        }
        
        throw new Error('Invalid response format from server');
      } catch (error) {
        // Handle network errors (connection refused, etc.)
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('Unable to connect to server. Please ensure the backend server is running.');
        }
        throw error;
      }
    },
    enabled: !!city, // Only fetch if city is provided
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx), but retry on server errors (5xx) and network errors
      if (error instanceof Error && error.message.includes('Unable to connect')) {
        // Retry connection errors up to 2 times
        return failureCount < 2;
      }
      // Retry other errors once
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}


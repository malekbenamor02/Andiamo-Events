/**
 * Ambassador Service
 * Fetches active ambassadors via the public ACTIVE_AMBASSADORS API (no direct Supabase client).
 */

import { Ambassador } from '@/types/orders';
import { API_ROUTES } from '@/lib/api-routes';

interface ActiveAmbassadorsResponse {
  success?: boolean;
  data?: Ambassador[];
}

async function fetchActiveAmbassadors(city: string, ville?: string): Promise<Ambassador[]> {
  const params = new URLSearchParams({ city });
  if (ville) params.append('ville', ville);

  const response = await fetch(`${API_ROUTES.ACTIVE_AMBASSADORS}?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to fetch active ambassadors';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const result: ActiveAmbassadorsResponse | Ambassador[] = await response.json();
  if (Array.isArray(result)) return result;
  if (result.data) return result.data;
  throw new Error('Invalid response format from server');
}

/**
 * Get active ambassadors filtered by city and ville
 */
export async function getActiveAmbassadorsByLocation(
  city: string,
  ville?: string,
): Promise<Ambassador[]> {
  return fetchActiveAmbassadors(city, ville);
}

/**
 * Get all active ambassadors (admin) — uses active API without city filter when possible
 */
export async function getAllActiveAmbassadors(): Promise<Ambassador[]> {
  const response = await fetch(API_ROUTES.ACTIVE_AMBASSADORS, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch active ambassadors');
  }
  const result: ActiveAmbassadorsResponse | Ambassador[] = await response.json();
  if (Array.isArray(result)) return result;
  return result.data || [];
}

/**
 * Get ambassador by ID — resolved from active ambassadors list (no direct table read)
 */
export async function getAmbassadorById(ambassadorId: string): Promise<Ambassador | null> {
  const response = await fetch(API_ROUTES.ACTIVE_AMBASSADORS, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch ambassadors');
  }
  const result: ActiveAmbassadorsResponse | Ambassador[] = await response.json();
  const list = Array.isArray(result) ? result : result.data || [];
  return list.find((a) => a.id === ambassadorId) || null;
}

/**
 * Check if there are active ambassadors for a city/ville
 */
export async function hasActiveAmbassadors(city: string, ville?: string): Promise<boolean> {
  const list = await fetchActiveAmbassadors(city, ville);
  return list.length > 0;
}

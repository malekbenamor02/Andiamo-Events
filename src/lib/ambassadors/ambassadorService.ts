/**
 * Ambassador Service
 * Handles ambassador queries and filtering
 */

import { supabase } from '@/integrations/supabase/client';
import { Ambassador } from '@/types/orders';
import { AmbassadorStatus } from '@/lib/constants/orderStatuses';

/**
 * Fisher-Yates shuffle algorithm for randomizing array order
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get active ambassadors filtered by city and ville
 * Used for user selection during order creation
 * Returns ambassadors in random order for fair distribution
 */
export async function getActiveAmbassadorsByLocation(
  city: string,
  ville?: string
): Promise<Ambassador[]> {
  let query = supabase
    .from('ambassadors')
    .select('id, full_name, phone, email, city, ville, status, commission_rate')
    .eq('status', 'approved')
    .eq('city', city);
    // Removed .order('full_name') - now using random order
  
  if (ville) {
    query = query.eq('ville', ville);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch active ambassadors: ${error.message}`);
  }
  
  // Shuffle the results for random display order
  const shuffled = shuffleArray(data || []);
  
  return shuffled as Ambassador[];
}

/**
 * Get all active ambassadors (admin)
 */
export async function getAllActiveAmbassadors(): Promise<Ambassador[]> {
  const { data, error } = await supabase
    .from('ambassadors')
    .select('id, full_name, phone, email, city, ville, status, commission_rate, created_at')
    .eq('status', 'approved')
    .order('full_name');
  
  if (error) {
    throw new Error(`Failed to fetch active ambassadors: ${error.message}`);
  }
  
  return (data || []) as Ambassador[];
}

/**
 * Get ambassador by ID
 */
export async function getAmbassadorById(ambassadorId: string): Promise<Ambassador | null> {
  const { data, error } = await supabase
    .from('ambassadors')
    .select('*')
    .eq('id', ambassadorId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch ambassador: ${error.message}`);
  }
  
  return data as Ambassador;
}

/**
 * Check if there are active ambassadors for a city/ville
 */
export async function hasActiveAmbassadors(city: string, ville?: string): Promise<boolean> {
  let query = supabase
    .from('ambassadors')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .eq('city', city);
  
  if (ville) {
    query = query.eq('ville', ville);
  }
  
  const { count, error } = await query;
  
  if (error) {
    throw new Error(`Failed to check active ambassadors: ${error.message}`);
  }
  
  return (count || 0) > 0;
}


/**
 * Sales Settings Utility
 * 
 * Provides utilities for checking if sales are enabled for ambassadors.
 * This is used to control whether ambassadors can create manual orders.
 */

import { supabase } from "@/integrations/supabase/client";

export interface SalesSettings {
  enabled: boolean;
}

/**
 * Fetches the current sales settings from the database
 * @returns Promise<SalesSettings> - The sales settings (defaults to enabled if not set)
 */
export const fetchSalesSettings = async (): Promise<SalesSettings> => {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'sales_settings')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching sales settings:', error);
      // Default to enabled if there's an error
      return { enabled: true };
    }

    if (data && data.content) {
      const settings = data.content as { enabled?: boolean };
      // Default to true if not set
      return { enabled: settings.enabled !== false };
    }

    // Default to enabled if no setting exists
    return { enabled: true };
  } catch (error) {
    console.error('Error fetching sales settings:', error);
    // Default to enabled on error
    return { enabled: true };
  }
};

/**
 * Updates the sales settings in the database
 * @param enabled - Whether sales should be enabled
 * @returns Promise<void>
 */
export const updateSalesSettings = async (enabled: boolean): Promise<void> => {
  const { error } = await supabase
    .from('site_content')
    .upsert({
      key: 'sales_settings',
      content: { enabled },
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'key'
    });

  if (error) {
    if (error.code === '42501' || error.message?.includes('policy')) {
      throw new Error('Permission denied. Please run the sales settings migration in Supabase SQL Editor to enable admin updates.');
    }
    throw error;
  }
};

/**
 * Sets up a real-time subscription to listen for sales settings changes
 * @param callback - Function to call when settings change
 * @returns Function to unsubscribe from the channel
 */
export const subscribeToSalesSettings = (
  callback: (settings: SalesSettings) => void
): (() => void) => {
  const channel = supabase
    .channel('sales-settings-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'site_content',
        filter: 'key=eq.sales_settings'
      },
      async () => {
        const settings = await fetchSalesSettings();
        callback(settings);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};


/**
 * Payment Service
 * Handles payment option validation and external app redirect
 */

import { supabase } from '@/integrations/supabase/client';
import { PaymentOption } from '@/types/orders';
import { OrderStatus, PaymentMethod, PaymentOptionType } from '@/lib/constants/orderStatuses';

/**
 * Fetch all payment options (admin)
 */
export async function fetchAllPaymentOptions(): Promise<PaymentOption[]> {
  const { data, error } = await supabase
    .from('payment_options')
    .select('*')
    .order('option_type');
  
  if (error) {
    throw new Error(`Failed to fetch payment options: ${error.message}`);
  }
  
  return (data || []) as PaymentOption[];
}

/**
 * Fetch enabled payment options (public)
 */
export async function fetchEnabledPaymentOptions(): Promise<PaymentOption[]> {
  const { data, error } = await supabase
    .from('payment_options')
    .select('*')
    .eq('enabled', true)
    .order('option_type');
  
  if (error) {
    throw new Error(`Failed to fetch enabled payment options: ${error.message}`);
  }
  
  return (data || []) as PaymentOption[];
}

/**
 * Check if a payment option is enabled
 */
export async function isPaymentOptionEnabled(optionType: PaymentOptionType): Promise<boolean> {
  const { data, error } = await supabase
    .from('payment_options')
    .select('enabled')
    .eq('option_type', optionType)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return data.enabled;
}

/**
 * Update payment option configuration (admin only)
 */
export async function updatePaymentOption(
  optionType: PaymentOptionType,
  config: {
    enabled?: boolean;
    app_name?: string;
    external_link?: string;
    app_image?: string;
  }
): Promise<PaymentOption> {
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (config.enabled !== undefined) {
    updateData.enabled = config.enabled;
  }
  
  if (optionType === PaymentOptionType.EXTERNAL_APP) {
    if (config.app_name !== undefined) {
      updateData.app_name = config.app_name;
    }
    if (config.external_link !== undefined) {
      updateData.external_link = config.external_link;
    }
    if (config.app_image !== undefined) {
      updateData.app_image = config.app_image;
    }
  }
  
  const { data, error } = await supabase
    .from('payment_options')
    .update(updateData)
    .eq('option_type', optionType)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update payment option: ${error.message}`);
  }
  
  return data as PaymentOption;
}

/**
 * Validate external app configuration
 */
export function validateExternalAppConfig(config: {
  app_name?: string;
  external_link?: string;
}): { valid: boolean; error?: string } {
  if (!config.app_name || config.app_name.trim().length === 0) {
    return { valid: false, error: 'App name is required' };
  }
  
  if (!config.external_link || config.external_link.trim().length === 0) {
    return { valid: false, error: 'External link is required' };
  }
  
  // Validate URL format
  try {
    new URL(config.external_link);
  } catch {
    return { valid: false, error: 'External link must be a valid URL' };
  }
  
  return { valid: true };
}

/**
 * Get payment method from option type
 */
export function getPaymentMethodFromOptionType(optionType: PaymentOptionType): PaymentMethod {
  switch (optionType) {
    case PaymentOptionType.ONLINE:
      return PaymentMethod.ONLINE;
    case PaymentOptionType.EXTERNAL_APP:
      return PaymentMethod.EXTERNAL_APP;
    case PaymentOptionType.AMBASSADOR_CASH:
      return PaymentMethod.AMBASSADOR_CASH;
    default:
      throw new Error(`Invalid payment option type: ${optionType}`);
  }
}


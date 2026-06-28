/**
 * Payment Service
 * Handles payment option validation and external app redirect
 */

import { supabase } from '@/integrations/supabase/client';
import { PaymentOption } from '@/types/orders';
import { PaymentMethod, PaymentOptionType } from '@/lib/constants/orderStatuses';
import { API_ROUTES } from '@/lib/api-routes';
import { apiFetch, handleApiResponse } from '@/lib/api-client';

/**
 * Fetch all payment options (admin) — server API with settings:manage gate.
 */
export async function fetchAllPaymentOptions(): Promise<PaymentOption[]> {
  const response = await apiFetch(API_ROUTES.ADMIN_PAYMENT_OPTIONS, {
    credentials: 'include',
  });
  const payload = await handleApiResponse<{ success: boolean; data: PaymentOption[] }>(response);
  return payload.data || [];
}

/**
 * Fetch enabled payment options (public checkout).
 * RLS allows anon SELECT only where enabled = true.
 */
export async function fetchEnabledPaymentOptions(): Promise<PaymentOption[]> {
  const { data, error } = await supabase
    .from('payment_options')
    .select('option_type, enabled, app_name, external_link, app_image, updated_at')
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
    .eq('enabled', true)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.enabled === true;
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

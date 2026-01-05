/**
 * usePaymentOptions Hook
 * Fetches and caches enabled payment options
 */

import { useQuery } from '@tanstack/react-query';
import { PaymentOption } from '@/types/orders';
import { fetchEnabledPaymentOptions } from '@/lib/orders/paymentService';

export function usePaymentOptions() {
  return useQuery<PaymentOption[]>({
    queryKey: ['payment-options'],
    queryFn: async () => {
      return await fetchEnabledPaymentOptions();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}


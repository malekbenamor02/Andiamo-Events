/**
 * useAdminRole Hook — reads verify-admin including permissions and allowedTabs.
 */

import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/api-routes';

export interface VerifyAdminResponse {
  valid: boolean;
  admin?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  permissions?: string[];
  allowedTabs?: string[];
  sessionExpiresAt?: number;
  sessionTimeRemaining?: number;
}

export function useAdminRole() {
  return useQuery({
    queryKey: ['admin-role'],
    queryFn: async () => {
      const response = await fetch(API_ROUTES.VERIFY_ADMIN, {
        credentials: 'include',
      });
      if (!response.ok) {
        return {
          isSuperAdmin: false,
          role: null as string | null,
          permissions: [] as string[],
          allowedTabs: [] as string[],
          canAccessTab: () => false,
          valid: false,
        };
      }
      const data = (await response.json()) as VerifyAdminResponse;
      const role = data.admin?.role || null;
      return {
        isSuperAdmin: role === 'super_admin' || (data.permissions || []).includes('*'),
        role,
        permissions: data.permissions || [],
        allowedTabs: data.allowedTabs || [],
        canAccessTab: (tab: string) => (data.allowedTabs || []).includes(tab),
        valid: !!data.valid,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}

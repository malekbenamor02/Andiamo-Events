/**
 * useAdminRole Hook
 * Checks if current admin is super admin
 */

import { useQuery } from '@tanstack/react-query';

interface AdminRoleResponse {
  role: string;
}

export function useAdminRole() {
  return useQuery<{ isSuperAdmin: boolean; role: string | null }>({
    queryKey: ['admin-role'],
    queryFn: async () => {
      // Fetch admin role from verify-admin endpoint or similar
      const response = await fetch('/api/verify-admin', {
        credentials: 'include'
      });
      if (!response.ok) {
        return { isSuperAdmin: false, role: null };
      }
      const data = await response.json();
      const role = data.role || data.data?.role || null;
      return {
        isSuperAdmin: role === 'super_admin',
        role
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: false, // Don't retry on auth failures
  });
}


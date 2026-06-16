export type AdminPermission = string;

export type AdminRole = 'admin' | 'super_admin';

export {
  hasPermission,
  resolvePermissions,
  getDefaultTabKey,
} from '@shared/admin/permissions.mjs';

export type { AdminTabDefinition } from '@shared/admin/tabDefinitions.mjs';

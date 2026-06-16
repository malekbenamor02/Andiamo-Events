/**
 * ESM re-export of permissions (shared with frontend via Vite alias).
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const perms = require('./permissions.cjs');

export const {
  ADMIN_ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  resolvePermissions,
  resolveEffectivePermissions,
  resolveAllowedTabs,
  getDefaultTabKey,
} = perms;

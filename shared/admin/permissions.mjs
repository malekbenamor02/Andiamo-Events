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
  hasEffectivePermission,
  resolvePermissions,
  resolveEffectivePermissions,
  resolveAllowedTabs,
  getDefaultTabKey,
} = perms;

export {
  SENSITIVE_TAB_KEYS,
  TAB_ACCESS_PRESETS,
  resolveAdminEffectiveAccess,
} from './tabAccess.mjs';

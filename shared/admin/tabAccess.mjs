/**
 * ESM re-export of tab access helpers (shared with frontend via Vite alias).
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const tabAccess = require('./tabAccess.cjs');

export const {
  SENSITIVE_TAB_KEYS,
  TAB_ACCESS_PRESETS,
  isExplicitTabConfig,
  resolveAllowedTabsForAdmin,
  resolveMobileTabsForAdmin,
  permissionsFromTabs,
  validateAdminTabAccessPayload,
  rowsFromPayload,
  tabAccessSummaryFromRows,
  resolveAdminEffectiveAccess,
} = tabAccess;

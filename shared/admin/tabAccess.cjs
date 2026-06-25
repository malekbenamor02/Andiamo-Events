'use strict';

const { resolveAllowedTabs, resolvePermissions } = require('./permissions.cjs');
const tabAccessPresets = require('./tabAccessPresets.data.json');

const SENSITIVE_TAB_KEYS = tabAccessPresets.sensitiveTabKeys;

/** Preset allowed tab keys for the AdminsTab UI. */
const TAB_ACCESS_PRESETS = tabAccessPresets.presets;

function validTabKeySet(tabDefinitions) {
  return new Set(tabDefinitions.map((t) => t.key));
}

function isExplicitTabConfig(tabRows) {
  return Array.isArray(tabRows) && tabRows.length > 0;
}

function sortTabsByRegistryOrder(tabKeys, tabDefinitions) {
  const orderMap = new Map(tabDefinitions.map((t) => [t.key, t.order ?? 99]));
  return [...tabKeys].sort((a, b) => (orderMap.get(a) ?? 99) - (orderMap.get(b) ?? 99));
}

function filterKnownTabKeys(tabKeys, tabDefinitions) {
  const valid = validTabKeySet(tabDefinitions);
  return tabKeys.filter((k) => valid.has(k));
}

function resolveAllowedTabsForAdmin({ role, tabRows }, tabDefinitions) {
  if (!role) return [];

  if (role === 'super_admin') {
    return tabDefinitions.map((t) => t.key);
  }

  if (isExplicitTabConfig(tabRows)) {
    const keys = tabRows.map((r) => r.tab_key);
    return sortTabsByRegistryOrder(filterKnownTabKeys(keys, tabDefinitions), tabDefinitions);
  }

  return resolveAllowedTabs(role, tabDefinitions);
}

function resolveGlobalMobileTabs(allowedTabs, tabDefinitions) {
  const allowed = new Set(allowedTabs);
  return tabDefinitions
    .filter((t) => t.showInMobileBottomNav && allowed.has(t.key))
    .sort((a, b) => (a.mobileOrder ?? 99) - (b.mobileOrder ?? 99))
    .map((t) => t.key);
}

function resolveMobileTabsForAdmin({ role, allowedTabs, tabRows }, tabDefinitions) {
  if (!role) return [];

  if (role === 'super_admin') {
    return resolveGlobalMobileTabs(allowedTabs, tabDefinitions);
  }

  if (isExplicitTabConfig(tabRows)) {
    const allowed = new Set(allowedTabs);
    const mobileRows = tabRows
      .filter((r) => r.show_in_mobile && allowed.has(r.tab_key))
      .sort((a, b) => {
        const ao = a.mobile_order ?? 99;
        const bo = b.mobile_order ?? 99;
        if (ao !== bo) return ao - bo;
        const defA = tabDefinitions.find((t) => t.key === a.tab_key);
        const defB = tabDefinitions.find((t) => t.key === b.tab_key);
        return (defA?.mobileOrder ?? 99) - (defB?.mobileOrder ?? 99);
      });
    return mobileRows.map((r) => r.tab_key);
  }

  return resolveGlobalMobileTabs(allowedTabs, tabDefinitions);
}

function permissionsFromTabs(role, allowedTabs, tabDefinitions) {
  if (role === 'super_admin') return ['*'];

  const allowed = new Set(allowedTabs);
  const perms = tabDefinitions
    .filter((t) => allowed.has(t.key))
    .map((t) => t.requiredPermission)
    .filter(Boolean);

  return [...new Set(perms)];
}

function tabAccessSummaryFromRows(tabRows, tabDefinitions) {
  if (!isExplicitTabConfig(tabRows)) {
    return {
      is_explicit: false,
      allowed_tab_keys: null,
      mobile_tab_keys: null,
    };
  }

  const allowed = sortTabsByRegistryOrder(
    filterKnownTabKeys(
      tabRows.map((r) => r.tab_key),
      tabDefinitions
    ),
    tabDefinitions
  );

  const mobile = tabRows
    .filter((r) => r.show_in_mobile && allowed.includes(r.tab_key))
    .sort((a, b) => (a.mobile_order ?? 99) - (b.mobile_order ?? 99))
    .map((r) => r.tab_key);

  return {
    is_explicit: true,
    allowed_tab_keys: allowed,
    mobile_tab_keys: mobile,
  };
}

function detectDuplicateKeys(keys) {
  const seen = new Set();
  for (const k of keys) {
    if (seen.has(k)) return k;
    seen.add(k);
  }
  return null;
}

/**
 * Validate tab access payload for create/update admin.
 * @returns {{ ok: true, clearConfig?: boolean, rows?: object[], allowed?: string[], mobile?: string[] } | { ok: false, error: string }}
 */
function validateAdminTabAccessPayload(payload, tabDefinitions) {
  const { role, allowed_tab_keys, mobile_tab_keys } = payload || {};

  if (role === 'super_admin') {
    if (allowed_tab_keys !== undefined || mobile_tab_keys !== undefined) {
      return { ok: false, error: 'Tab access cannot be configured for super_admin accounts' };
    }
    return { ok: true };
  }

  const hasAllowed = allowed_tab_keys !== undefined;
  const hasMobile = mobile_tab_keys !== undefined;

  if (!hasAllowed && !hasMobile) {
    return { ok: true, unchanged: true };
  }

  if (hasAllowed && allowed_tab_keys === null) {
    return { ok: true, clearConfig: true, rows: [], allowed: [], mobile: [] };
  }

  if (!hasAllowed && hasMobile) {
    return { ok: false, error: 'mobile_tab_keys requires allowed_tab_keys when setting explicit config' };
  }

  if (!Array.isArray(allowed_tab_keys)) {
    return { ok: false, error: 'allowed_tab_keys must be an array or null' };
  }

  const dup = detectDuplicateKeys(allowed_tab_keys);
  if (dup) {
    return { ok: false, error: `Duplicate tab key: ${dup}` };
  }

  const valid = validTabKeySet(tabDefinitions);
  for (const key of allowed_tab_keys) {
    if (!valid.has(key)) {
      return { ok: false, error: `Unknown tab key: ${key}` };
    }
    if (SENSITIVE_TAB_KEYS.includes(key)) {
      return { ok: false, error: `Sensitive tab cannot be granted to admin role: ${key}` };
    }
  }

  const mobileKeys = hasMobile ? mobile_tab_keys : [];
  if (hasMobile) {
    if (!Array.isArray(mobileKeys)) {
      return { ok: false, error: 'mobile_tab_keys must be an array' };
    }
    const mobileDup = detectDuplicateKeys(mobileKeys);
    if (mobileDup) {
      return { ok: false, error: `Duplicate mobile tab key: ${mobileDup}` };
    }
    for (const key of mobileKeys) {
      if (!valid.has(key)) {
        return { ok: false, error: `Unknown mobile tab key: ${key}` };
      }
      if (!allowed_tab_keys.includes(key)) {
        return { ok: false, error: `Mobile tab must be included in allowed tabs: ${key}` };
      }
    }
  }

  const rows = rowsFromPayload(allowed_tab_keys, mobileKeys, tabDefinitions);
  return {
    ok: true,
    rows,
    allowed: allowed_tab_keys,
    mobile: mobileKeys,
  };
}

function rowsFromPayload(allowedTabKeys, mobileTabKeys, tabDefinitions) {
  const mobileSet = new Set(mobileTabKeys || []);
  return allowedTabKeys.map((tab_key) => {
    const def = tabDefinitions.find((t) => t.key === tab_key);
    const row = {
      tab_key,
      show_in_mobile: mobileSet.has(tab_key),
    };
    const order = def?.mobileOrder ?? def?.order;
    if (order != null) {
      row.mobile_order = order;
    }
    return row;
  });
}

/**
 * Single entry point for session verification and middleware.
 */
function resolveAdminEffectiveAccess({ role, tabRows }, tabDefinitions) {
  const allowedTabs = resolveAllowedTabsForAdmin({ role, tabRows }, tabDefinitions);
  const mobileTabs = resolveMobileTabsForAdmin({ role, allowedTabs, tabRows }, tabDefinitions);
  const permissions =
    role === 'super_admin'
      ? ['*']
      : isExplicitTabConfig(tabRows)
        ? permissionsFromTabs(role, allowedTabs, tabDefinitions)
        : resolvePermissions(role);

  return {
    allowedTabs,
    mobileTabs,
    permissions,
    isExplicit: role !== 'super_admin' && isExplicitTabConfig(tabRows),
  };
}

module.exports = {
  SENSITIVE_TAB_KEYS,
  TAB_ACCESS_PRESETS,
  isExplicitTabConfig,
  resolveAllowedTabsForAdmin,
  resolveMobileTabsForAdmin,
  resolveGlobalMobileTabs,
  permissionsFromTabs,
  validateAdminTabAccessPayload,
  rowsFromPayload,
  tabAccessSummaryFromRows,
  resolveAdminEffectiveAccess,
};

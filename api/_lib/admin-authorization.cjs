'use strict';

/** CommonJS bridge to ESM admin-authorization module. */
let cached = null;

async function loadModule() {
  if (!cached) {
    cached = await import('./admin-authorization.mjs');
  }
  return cached;
}

async function verifyAdminSession(req, opts) {
  const mod = await loadModule();
  return mod.verifyAdminSession(req, opts);
}

async function hasPermission(role, permission) {
  const mod = await loadModule();
  return mod.hasPermission(role, permission);
}

async function resolveEffectivePermissions(role, dbClient) {
  const mod = await loadModule();
  return mod.resolveEffectivePermissions(role, dbClient);
}

async function resolveAllowedTabs(role, tabDefinitions) {
  const mod = await loadModule();
  return mod.resolveAllowedTabs(role, tabDefinitions);
}

module.exports = {
  verifyAdminSession,
  hasPermission,
  resolveEffectivePermissions,
  resolveAllowedTabs,
};

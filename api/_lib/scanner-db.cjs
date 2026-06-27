'use strict';

const { createClient } = require('@supabase/supabase-js');
const { ensureSupabaseServerEnv, getSupabaseEnv } = require('./supabase-env.cjs');

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_URL
  );
}

function allowDevAnonFallback() {
  const v = process.env.ALLOW_DEV_ANON_FALLBACK;
  return v === '1' || v === 'true' || String(v).toLowerCase() === 'yes';
}

/**
 * Scanner/POS privileged DB client — service role required in production.
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
function createScannerDbClient() {
  ensureSupabaseServerEnv();
  const { url, serviceRoleKey, anonKey } = getSupabaseEnv();
  if (!url) return null;

  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey);
  }

  if (isProductionRuntime()) {
    return null;
  }

  if (allowDevAnonFallback() && anonKey) {
    return createClient(url, anonKey);
  }

  return null;
}

function dbConfigErrorResponse() {
  return {
    statusCode: 503,
    body: {
      error: 'Service configuration error',
      message: 'Database not configured for privileged scanner operations',
    },
  };
}

module.exports = {
  createScannerDbClient,
  dbConfigErrorResponse,
  isProductionRuntime,
  allowDevAnonFallback,
};

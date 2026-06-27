/**
 * Service-role Supabase client for server routes (bypasses RLS safely).
 */
import { createRequire } from 'module';

const requireCjs = createRequire(import.meta.url);
const { ensureSupabaseServerEnv, getSupabaseEnv } = requireCjs('./supabase-env.cjs');

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_URL
  );
}

export function requireServiceRoleClient(res) {
  ensureSupabaseServerEnv();
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) {
    if (isProductionRuntime()) {
      res.status(503).json({
        error: 'Server configuration error',
        details: 'SUPABASE_SERVICE_ROLE_KEY is required in production.',
      });
      return null;
    }
    res.status(503).json({
      error: 'Server configuration error',
      details: 'SUPABASE_SERVICE_ROLE_KEY is not configured.',
    });
    return null;
  }
  return { url, serviceRoleKey };
}

export async function createServiceRoleClient() {
  ensureSupabaseServerEnv();
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, serviceRoleKey);
}

export { isProductionRuntime };

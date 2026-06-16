'use strict';

/** Trim quotes/whitespace from env vars (common when pasted into Vercel). */
function trimEnvValue(v) {
  if (v == null || typeof v !== 'string') return v;
  return v.trim().replace(/^["']|["']$/g, '');
}

let ensured = false;

/**
 * Mirror server.cjs: serverless handlers may only have VITE_SUPABASE_* on Preview.
 * Mutates process.env so existing SUPABASE_URL checks keep working.
 */
function ensureSupabaseServerEnv() {
  if (ensured) return getSupabaseEnv();
  ensured = true;

  if (!process.env.SUPABASE_URL) {
    const url = trimEnvValue(process.env.VITE_SUPABASE_URL);
    if (url) process.env.SUPABASE_URL = url;
  }
  if (!process.env.SUPABASE_ANON_KEY) {
    const anon = trimEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
    if (anon) process.env.SUPABASE_ANON_KEY = anon;
  }

  return getSupabaseEnv();
}

function getSupabaseEnv() {
  return {
    url: trimEnvValue(process.env.SUPABASE_URL),
    anonKey: trimEnvValue(process.env.SUPABASE_ANON_KEY),
    serviceRoleKey: trimEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function isSupabaseConfigured(requireServiceRole = false) {
  const { url, anonKey, serviceRoleKey } = ensureSupabaseServerEnv();
  if (!url || !anonKey) return false;
  if (requireServiceRole && !serviceRoleKey) return false;
  return true;
}

module.exports = {
  trimEnvValue,
  ensureSupabaseServerEnv,
  getSupabaseEnv,
  isSupabaseConfigured,
};

/**
 * Supabase client initialization
 * Centralized Supabase client setup for the entire backend
 */

const { createClient } = require('@supabase/supabase-js');

let supabase = null;
let supabaseService = null;

/**
 * Initialize Supabase clients
 * @returns {Object} { supabase, supabaseService }
 */
function initializeSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn('Warning: Supabase environment variables not configured.');
    return { supabase: null, supabaseService: null };
  }

  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabaseService = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      console.log('Supabase service role client initialized');
    } else {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set - storage operations may fail');
    }
  }

  return { supabase, supabaseService };
}

/**
 * Get Supabase client (anon key)
 */
function getSupabase() {
  if (!supabase) {
    initializeSupabase();
  }
  return supabase;
}

/**
 * Get Supabase service client (service role key)
 */
function getSupabaseService() {
  if (!supabaseService) {
    initializeSupabase();
  }
  return supabaseService || supabase; // Fallback to anon key if service key not available
}

module.exports = {
  initializeSupabase,
  getSupabase,
  getSupabaseService
};


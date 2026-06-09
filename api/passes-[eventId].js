// GET /api/passes/:eventId - Get active passes for an event with stock information
// Vercel serverless function - dynamic route

import { createClient } from '@supabase/supabase-js';
import {
  publicApiError,
  PUBLIC_ERROR_CODES,
} from './_lib/public-api-error.js';

// Import shared CORS utility (using dynamic import for ES modules)
let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../lib/cors.js');
  }
  return corsUtils;
}

export default async (req, res) => {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  
  // Handle preflight requests (credentials when presale gate may apply)
  if (handlePreflight(req, res, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
    return; // Preflight handled
  }
  
  if (!setCORSHeaders(res, req, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
    if (req.headers.origin) {
      return publicApiError(res, 403, PUBLIC_ERROR_CODES.INVALID_ACCESS, undefined, {
        logDetails: 'CORS origin not allowed',
      });
    }
  }
  
  // Only allow GET
  if (req.method !== 'GET') {
    return publicApiError(res, 405, PUBLIC_ERROR_CODES.INVALID_REQUEST, undefined, {
      logDetails: 'Method not allowed',
    });
  }

  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return publicApiError(res, 500, PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE, undefined, {
        logDetails: 'Supabase not configured',
      });
    }

    // Get eventId from Vercel dynamic route parameter
    // In Vercel, [eventId] becomes available as req.query.eventId
    // Also check req.url for fallback (in case rewrite is used)
    let eventId = req.query.eventId;
    
    // Fallback: extract from URL if query param is not available
    if (!eventId && req.url) {
      const urlMatch = req.url.match(/\/api\/passes\/([^/?]+)/);
      if (urlMatch) {
        eventId = urlMatch[1];
      }
    }

    if (!eventId) {
      console.error('❌ Event ID missing from request:', { 
        query: req.query, 
        url: req.url,
        method: req.method 
      });
      return publicApiError(res, 400, PUBLIC_ERROR_CODES.INVALID_REQUEST, undefined, {
        logDetails: 'Event ID is required',
      });
    }
    
    // Clean eventId (remove any trailing colons or source map references)
    eventId = String(eventId).split(':')[0].trim();

    // Initialize Supabase clients
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Use service role key if available for better access
    let dbClient = supabase;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      dbClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }

    const { data: eventData, error: eventError } = await dbClient
      .from('events')
      .select('id, presale_enabled')
      .eq('id', eventId)
      .single();
    if (eventError || !eventData) {
      return publicApiError(res, 404, PUBLIC_ERROR_CODES.EVENT_NOT_FOUND, undefined, {
        logDetails: { eventId, eventError },
      });
    }

    const presaleRequired = !!eventData.presale_enabled;
    if (eventData.presale_enabled) {
      const { parseCookie, PRESALE_COOKIE_NAME, fetchValidPresaleSessionRow } = await import('./_lib/presale-server.js');
      const sessionId = parseCookie(req, PRESALE_COOKIE_NAME);
      const sessionRow = await fetchValidPresaleSessionRow(dbClient, sessionId, eventId);
      if (!sessionRow) {
        return publicApiError(res, 403, PUBLIC_ERROR_CODES.PRESALE_ACCESS_REQUIRED, undefined, {
          extra: { presale_required: true },
          logDetails: 'Presale session required',
        });
      }
    }

    // Fetch only active passes with stock information
    const { data: passes, error: passesError } = await dbClient
      .from('event_passes')
      .select('id, name, price, description, is_primary, is_active, max_quantity, sold_quantity, release_version, allowed_payment_methods')
      .eq('event_id', eventId)
      .eq('is_active', true)  // Only active passes
      .order('is_primary', { ascending: false })
      .order('price', { ascending: true })
      .order('release_version', { ascending: false });

    if (passesError) {
      console.error('❌ Error fetching passes for event:', eventId, passesError);
      return publicApiError(res, 500, PUBLIC_ERROR_CODES.PASSES_UNAVAILABLE, undefined, {
        logDetails: passesError,
      });
    }

    // Calculate stock information for each pass
    const passesWithStock = (passes || []).map(pass => {
      const maxQty = pass.max_quantity != null ? pass.max_quantity : 0;
      const remainingQuantity = Math.max(0, maxQty - (pass.sold_quantity || 0));
      const isSoldOut = remainingQuantity <= 0;

      return {
        id: pass.id,
        name: pass.name,
        price: parseFloat(pass.price),
        description: pass.description || '',
        is_primary: pass.is_primary || false,
        is_active: pass.is_active,
        release_version: pass.release_version || 1,
        // Stock information (max_quantity always required)
        max_quantity: maxQty,
        sold_quantity: pass.sold_quantity || 0,
        remaining_quantity: remainingQuantity,
        is_unlimited: false,
        is_sold_out: isSoldOut,
        // Payment method restrictions
        allowed_payment_methods: pass.allowed_payment_methods || null
      };
    });

    res.status(200).json({
      success: true,
      presale_required: presaleRequired,
      passes: passesWithStock
    });

  } catch (error) {
    console.error('❌ Error in /api/passes/:eventId:', error);
    return publicApiError(res, 500, PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE, undefined, {
      logDetails: error,
    });
  }
};

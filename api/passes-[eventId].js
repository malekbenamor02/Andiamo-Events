// GET /api/passes/:eventId - Get active passes for an event with stock information
// Vercel serverless function - dynamic route

import { createClient } from '@supabase/supabase-js';

export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
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
      return res.status(400).json({ error: 'Event ID is required' });
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
      return res.status(500).json({
        error: 'Failed to fetch passes',
        details: passesError.message,
        code: passesError.code
      });
    }

    // Calculate stock information for each pass
    const passesWithStock = (passes || []).map(pass => {
      const isUnlimited = pass.max_quantity === null;
      const remainingQuantity = isUnlimited ? null : (pass.max_quantity - pass.sold_quantity);
      const isSoldOut = !isUnlimited && remainingQuantity <= 0;

      return {
        id: pass.id,
        name: pass.name,
        price: parseFloat(pass.price),
        description: pass.description || '',
        is_primary: pass.is_primary || false,
        is_active: pass.is_active,
        release_version: pass.release_version || 1,
        // Stock information
        max_quantity: pass.max_quantity,
        sold_quantity: pass.sold_quantity || 0,
        remaining_quantity: remainingQuantity,
        is_unlimited: isUnlimited,
        is_sold_out: isSoldOut,
        // Payment method restrictions
        allowed_payment_methods: pass.allowed_payment_methods || null
      };
    });

    res.status(200).json({
      success: true,
      passes: passesWithStock
    });

  } catch (error) {
    console.error('❌ Error in /api/passes/:eventId:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

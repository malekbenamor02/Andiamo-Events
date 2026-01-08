// GET /api/ambassadors/active - Get active ambassadors filtered by city/ville (public)
// Vercel serverless function

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
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get query parameters
    const { city, ville } = req.query;
    
    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }
    
    // Normalize city and ville (trim whitespace)
    const normalizedCity = String(city).trim();
    const normalizedVille = ville && String(ville).trim() !== '' ? String(ville).trim() : null;
    
    // Build query
    let query = supabase
      .from('ambassadors')
      .select('id, full_name, phone, email, city, ville, status, commission_rate')
      .eq('status', 'approved')
      .eq('city', normalizedCity);
    
    // If ville is provided, also filter by ville (match city AND ville)
    // If ville is NOT provided, show all ambassadors in the city
    if (normalizedVille) {
      query = query.eq('ville', normalizedVille);
    }
    
    query = query.order('full_name');
    
    const { data: ambassadors, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching active ambassadors:', error);
      return res.status(500).json({ error: error.message });
    }
    
    // Fetch social_link from ambassador_applications for each ambassador
    const ambassadorsWithSocial = await Promise.all(
      (ambassadors || []).map(async (ambassador) => {
        // Try to find matching application by phone
        const { data: application } = await supabase
          .from('ambassador_applications')
          .select('social_link')
          .eq('phone_number', ambassador.phone)
          .single();
        
        return {
          ...ambassador,
          social_link: application?.social_link || null
        };
      })
    );
    
    res.json({ success: true, data: ambassadorsWithSocial || [] });
  } catch (error) {
    console.error('Error in ambassadors/active endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch active ambassadors' });
  }
};

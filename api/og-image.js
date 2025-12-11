// OG Image API endpoint for Vercel
// Serves the OG image from Supabase Storage at fixed path: images/og-image/current.png
// This endpoint always returns the latest image and never changes URL

import { createClient } from '@supabase/supabase-js';

export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    // In Vercel, use SUPABASE_URL and SUPABASE_ANON_KEY (without VITE_ prefix)
    // VITE_ prefix is only for client-side code
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to get the image - check PNG first, then JPG
    const extensions = ['png', 'jpg'];
    let imageData = null;
    let contentType = 'image/png';
    
    for (const ext of extensions) {
      const filePath = `og-image/current.${ext}`;
      
      try {
        const { data, error } = await supabase.storage
          .from('images')
          .download(filePath);
        
        if (!error && data) {
          imageData = await data.arrayBuffer();
          contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
          break;
        }
      } catch (err) {
        // Continue to next extension
        console.warn(`Failed to load ${ext} image:`, err.message);
      }
    }
    
    // If no image found, return 404
    if (!imageData) {
      return res.status(404).json({ 
        error: 'OG image not found',
        message: 'Please upload an OG image from the admin dashboard'
      });
    }
    
    // Set headers for image response
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Content-Length', imageData.byteLength);
    
    // Return the image binary data
    return res.status(200).send(Buffer.from(imageData));
    
  } catch (error) {
    console.error('OG image API error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message
    });
  }
};


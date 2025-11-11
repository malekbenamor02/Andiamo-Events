import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ambassador_id, email_type } = req.query;
    
    if (!ambassador_id || !email_type) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Check if Supabase is configured
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      // Still return the pixel even if tracking fails
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.status(200).send(pixel);
      return;
    }

    // Initialize Supabase client (initialize here to ensure env vars are available)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Record email open in database
    const { error } = await supabase
      .from('email_tracking')
      .insert({
        ambassador_id,
        email_type,
        opened_at: new Date().toISOString(),
        user_agent: req.headers['user-agent'] || '',
        ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || ''
      });

    if (error) {
      console.error('Error recording email open:', error);
    }

    // Return a 1x1 transparent GIF pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.status(200).send(pixel);
  } catch (error) {
    console.error('Email tracking error:', error);
    // Still return the pixel even if tracking fails
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.status(200).send(pixel);
  }
} 
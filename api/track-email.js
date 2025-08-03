import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ambassador_id, email_type } = req.query;
    
    if (!ambassador_id || !email_type) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Record email open in database
    const { error } = await supabase
      .from('email_tracking')
      .insert({
        ambassador_id,
        email_type,
        opened_at: new Date().toISOString(),
        user_agent: req.headers['user-agent'] || '',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress || ''
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
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // Enable CORS
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication
    const cookies = {};
    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        cookies[parts[0].trim()] = parts[1]?.trim();
      });
    }

    const adminToken = cookies.adminToken;
    if (!adminToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    let decoded;
    try {
      decoded = jwt.verify(adminToken, jwtSecret);
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if environment variables are set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Verify admin exists
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, email')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .single();

    if (adminError || !admin) {
      return res.status(401).json({ error: 'Invalid admin' });
    }

    // Get the enabled value from request body
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request: enabled must be a boolean' });
    }

    // Update or insert sales settings
    const { data, error } = await supabase
      .from('site_content')
      .upsert({
        key: 'sales_settings',
        content: { enabled },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating sales settings:', error);
      return res.status(500).json({ 
        error: 'Failed to update settings',
        details: error.message 
      });
    }

    res.status(200).json({ 
      success: true, 
      settings: data 
    });
  } catch (error) {
    console.error('Error in update-sales-settings:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}






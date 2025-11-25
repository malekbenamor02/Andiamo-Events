import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Enable CORS - for credentials, we must use a specific origin, not '*'
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse cookies manually from the Cookie header
    const cookies = {};
    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        cookies[parts[0].trim()] = parts[1]?.trim();
      });
    }
    
    // Get the admin token from cookies
    const adminToken = cookies.adminToken;

    if (!adminToken) {
      return res.status(401).json({ valid: false, error: 'No token provided' });
    }

    // Verify the JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('WARNING: JWT_SECRET is not set! Using fallback secret. This is insecure in production.');
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
        return res.status(500).json({ valid: false, error: 'Server configuration error' });
      }
    }
    const decoded = jwt.verify(adminToken, jwtSecret || 'fallback-secret-dev-only');
    
    // Check if environment variables are set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ valid: false, error: 'Server configuration error' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Verify admin exists in database and is active
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({ valid: false, error: 'Invalid admin' });
    }

    res.status(200).json({ valid: true, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
} 
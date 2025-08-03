import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import cookieParser from 'cookie-parser';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse cookies
    cookieParser()(req, res, () => {});
    
    // Get the admin token from cookies
    const adminToken = req.cookies?.adminToken;

    if (!adminToken) {
      return res.status(401).json({ valid: false, error: 'No token provided' });
    }

    // Verify the JWT token
    const decoded = jwt.verify(adminToken, process.env.JWT_SECRET || 'fallback-secret');
    
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
      .select('id, email, name, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({ valid: false, error: 'Invalid admin' });
    }

    res.status(200).json({ valid: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
} 
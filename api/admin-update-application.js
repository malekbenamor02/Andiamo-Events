// API route to update ambassador application status (bypasses RLS)
// This is needed because the frontend uses anon key which is subject to RLS policies
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // Enable CORS
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://andiamo-events.vercel.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin JWT token
    const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify admin exists and is active
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Missing Supabase environment variables'
      });
    }

    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify admin exists
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();

    if (adminError || !admin) {
      return res.status(401).json({ error: 'Invalid admin' });
    }

    // Get request body
    const { applicationId, status } = req.body;

    if (!applicationId || !status) {
      return res.status(400).json({ error: 'applicationId and status are required' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
    }

    // Update application status using service role (bypasses RLS)
    const { data: updateData, error: updateError } = await supabase
      .from('ambassador_applications')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select();

    if (updateError) {
      console.error('Error updating application:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update application',
        details: updateError.message,
        code: updateError.code
      });
    }

    if (!updateData || updateData.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.status(200).json({ 
      success: true, 
      data: updateData[0],
      message: `Application ${status} successfully`
    });

  } catch (error) {
    console.error('Admin update application error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


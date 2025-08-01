import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  console.log('API Route called:', req.method, req.url);
      console.log('Environment variables check:');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Request body:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if environment variables are set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('Creating Supabase client...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    console.log('Fetching admin from database...');
    // Fetch admin by email
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!admin) {
      console.log('Admin not found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Admin found, checking password...');
    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log('Password mismatch for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Password match, generating JWT...');
    // Generate JWT
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '2h' }
    );

    console.log('Setting cookie...');
    // Set cookie
    res.setHeader('Set-Cookie', `adminToken=${token}; HttpOnly; Path=/; Max-Age=7200; SameSite=Lax`);

    console.log('Login successful for:', email);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
} 
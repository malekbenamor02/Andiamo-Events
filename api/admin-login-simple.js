// Simplified admin-login endpoint to debug the issue
// This bypasses the full Express app to isolate the problem

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const serverless = require('serverless-http');

console.log('🔵 [SIMPLE-LOGIN] Initializing simplified admin-login...');

const app = express();

// Basic middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Admin login endpoint
app.post('/admin-login', async (req, res) => {
  console.log('🔵 [SIMPLE-LOGIN] Login request received');
  
  try {
    const { email, password, recaptchaToken } = req.body;
    
    console.log('🔵 [SIMPLE-LOGIN] Request body:', { 
      email, 
      hasPassword: !!password,
      hasRecaptcha: !!recaptchaToken 
    });
    
    // Check Supabase
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('❌ [SIMPLE-LOGIN] Supabase not configured');
      return res.status(500).json({ 
        error: 'Supabase not configured',
        hasUrl: !!process.env.SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_ANON_KEY
      });
    }
    
    console.log('🔵 [SIMPLE-LOGIN] Supabase configured, initializing client...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    console.log('🔵 [SIMPLE-LOGIN] Fetching admin from Supabase...');
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();
      
    if (error) {
      console.error('❌ [SIMPLE-LOGIN] Supabase error:', error);
      return res.status(401).json({ 
        error: 'Invalid credentials', 
        details: error.message 
      });
    }
    
    if (!admin) {
      console.error('❌ [SIMPLE-LOGIN] Admin not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('🔵 [SIMPLE-LOGIN] Admin found, comparing password...');
    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
      console.error('❌ [SIMPLE-LOGIN] Password does not match');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('🔵 [SIMPLE-LOGIN] Password verified, generating JWT...');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000
    };
    
    console.log('🔵 [SIMPLE-LOGIN] Setting cookie and sending response...');
    res.cookie('adminToken', token, cookieOptions);
    res.json({ success: true });
    console.log('✅ [SIMPLE-LOGIN] Login successful');
    
  } catch (error) {
    console.error('❌ [SIMPLE-LOGIN] Error:', error);
    console.error('❌ [SIMPLE-LOGIN] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Server error', 
      details: error.message 
    });
  }
});

console.log('✅ [SIMPLE-LOGIN] Express app configured');

// Wrap with serverless-http
const handler = serverless(app);
console.log('✅ [SIMPLE-LOGIN] Handler created');

module.exports = handler;


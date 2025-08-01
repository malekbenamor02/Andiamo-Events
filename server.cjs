const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config();

// Initialize Supabase client only if environment variables are available
let supabase = null;
if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
} else {
  console.warn('Supabase environment variables not found. Admin login functionality will be disabled.');
}

const app = express();

app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000', 'http://192.168.1.*', 'http://10.0.*'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Configure Gmail SMTP transporter using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'fmalekbenamorf@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || 'gdwf jvzu olih ktep',
  },
});

// Rate limiting: 10 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/send-email', limiter);

app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    
    await transporter.sendMail({
      from: process.env.GMAIL_FROM || 'Andiamo Events <fmalekbenamorf@gmail.com>',
      to,
      subject,
      html,
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Email sending failed:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

// Admin login endpoint
app.post('/api/admin-login', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  
  const { email, password } = req.body;
  // Fetch admin by email
  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Compare password
  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Generate JWT
  const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '2h' });
  res.cookie('adminToken', token, { 
    httpOnly: true, 
    secure: false, // Allow HTTP for localhost
    sameSite: 'lax', // More permissive for mobile
    maxAge: 2 * 60 * 60 * 1000 
  });
  res.json({ success: true });
});

// Admin logout endpoint
app.post('/api/admin-logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});

// JWT middleware for protected admin routes
function requireAdminAuth(req, res, next) {
  const token = req.cookies.adminToken;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.listen(process.env.PORT || 8080, () => console.log('API server running'));
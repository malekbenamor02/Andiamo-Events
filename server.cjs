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

// Debug: Log environment variables
console.log('Environment variables check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Found' : 'Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Found' : 'Missing');

// Initialize Supabase client only if environment variables are available
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  console.log('Supabase client initialized successfully');
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
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
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
      from: process.env.GMAIL_FROM,
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
  // Generate JWT (24 hours for session cookie)
  const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
  res.cookie('adminToken', token, { 
    httpOnly: true, 
    secure: false, // Allow HTTP for localhost
    sameSite: 'lax', // More permissive for mobile
    path: '/', // Ensure cookie is available for all paths
    domain: 'localhost' // Set domain explicitly
    // Remove maxAge to make it a session cookie (expires when browser closes)
  });
  res.json({ success: true });
});

// Admin logout endpoint
app.post('/api/admin-logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});

// Admin verify endpoint
app.get('/api/verify-admin', requireAdminAuth, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ valid: false, error: 'Supabase not configured' });
  }
  
  try {
    // Verify admin exists in database and is active
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, name, is_active')
      .eq('id', req.admin.id)
      .eq('email', req.admin.email)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({ valid: false, error: 'Invalid admin' });
    }

    res.json({ valid: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
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

// Ticket validation endpoint
app.post('/api/validate-ticket', async (req, res) => {
  try {
    const { qrCode, eventId, ambassadorId, deviceInfo, scanLocation } = req.body;

    if (!qrCode || !eventId || !ambassadorId) {
      return res.status(400).json({ 
        error: 'Missing required fields: qrCode, eventId, ambassadorId' 
      });
    }

    // Find the ticket by QR code
    const { data: ticket, error: ticketError } = await supabase
      .from('pass_purchases')
      .select(`
        *,
        events (
          id,
          name,
          date,
          venue,
          city
        )
      `)
      .eq('qr_code', qrCode)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({
        success: false,
        result: 'invalid',
        message: 'Ticket not found'
      });
    }

    // Check if ticket is for the correct event
    if (ticket.event_id !== eventId) {
      return res.status(400).json({
        success: false,
        result: 'invalid',
        message: 'Ticket is not valid for this event'
      });
    }

    // Check if ticket is already scanned
    const { data: existingScan, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('ticket_id', ticket.id)
      .eq('scan_result', 'valid')
      .single();

    if (existingScan) {
      // Record the duplicate scan attempt
      await supabase.from('scans').insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'already_scanned',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Duplicate scan attempt'
      });

      return res.status(200).json({
        success: false,
        result: 'already_scanned',
        message: 'Ticket already scanned',
        ticket: {
          id: ticket.id,
          customer_name: ticket.customer_name,
          event_name: ticket.events.name,
          ticket_type: ticket.pass_type,
          scan_time: existingScan.scan_time
        }
      });
    }

    // Check if event date has passed
    const eventDate = new Date(ticket.events.date);
    const now = new Date();
    
    if (eventDate < now) {
      // Record the expired scan attempt
      await supabase.from('scans').insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'expired',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Event date has passed'
      });

      return res.status(200).json({
        success: false,
        result: 'expired',
        message: 'Event date has passed',
        ticket: {
          id: ticket.id,
          customer_name: ticket.customer_name,
          event_name: ticket.events.name,
          ticket_type: ticket.pass_type
        }
      });
    }

    // Record the valid scan
    const { data: scanRecord, error: recordError } = await supabase
      .from('scans')
      .insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'valid',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Valid ticket scan'
      })
      .select()
      .single();

    if (recordError) {
      console.error('Error recording scan:', recordError);
      return res.status(500).json({
        success: false,
        result: 'error',
        message: 'Failed to record scan'
      });
    }

    return res.status(200).json({
      success: true,
      result: 'valid',
      message: 'Ticket validated successfully',
      ticket: {
        id: ticket.id,
        customer_name: ticket.customer_name,
        event_name: ticket.events.name,
        ticket_type: ticket.pass_type,
        scan_time: scanRecord.scan_time
      }
    });

  } catch (error) {
    console.error('Ticket validation error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

app.listen(process.env.PORT || 8082, () => console.log('API server running on port', process.env.PORT || 8082));
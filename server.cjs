const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const https = require('https');
const querystring = require('querystring');

// Load environment variables
require('dotenv').config();

// Debug: Log environment variables
// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn('Warning: Supabase environment variables not configured. Admin login functionality will be disabled.');
}
if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not configured. Using fallback (insecure for production).');
}

// Initialize Supabase client only if environment variables are available
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  // Supabase client initialized
} else {
  // Supabase client not initialized - admin login disabled
}

const app = express();

app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000', 'http://192.168.1.*', 'http://10.0.*', 'http://127.0.0.1:3000'],
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
  try {
    if (!supabase) {
      console.error('Supabase not configured');
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
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
    
    if (!admin.password) {
      console.error('Admin has no password field');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Compare password
    let isMatch;
    try {
      isMatch = await bcrypt.compare(password, admin.password);
    } catch (bcryptError) {
      console.error('Bcrypt comparison error:', bcryptError);
      return res.status(500).json({ error: 'Server error', details: 'Password verification failed' });
    }
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT (24 hours for session cookie)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn('WARNING: JWT_SECRET is not set! Using fallback secret. This is insecure in production.');
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Server configuration error: JWT_SECRET is required in production.' });
      }
    }
    
    let token;
    try {
      token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, jwtSecret || 'fallback-secret-dev-only', { expiresIn: '24h' });
    } catch (jwtError) {
      console.error('JWT signing error:', jwtError);
      return res.status(500).json({ error: 'Server error', details: 'Failed to generate token' });
    }
    
    res.cookie('adminToken', token, { 
      httpOnly: true, 
      secure: false, // Allow HTTP for localhost
      sameSite: 'lax', // More permissive for mobile
      path: '/', // Ensure cookie is available for all paths
      domain: 'localhost' // Set domain explicitly
      // Remove maxAge to make it a session cookie (expires when browser closes)
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Update sales settings endpoint
app.post('/api/update-sales-settings', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Verify admin authentication
    const token = req.cookies.adminToken;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

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
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('WARNING: JWT_SECRET is not set! Using fallback secret. This is insecure in production.');
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Server configuration error: JWT_SECRET is required in production.' });
      }
    }
    const decoded = jwt.verify(token, jwtSecret || 'fallback-secret-dev-only');
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

// ==================== SMS Marketing Routes ====================
// Test endpoint to verify SMS routes are working
app.get('/api/sms-test', (req, res) => {
  res.json({ success: true, message: 'SMS API routes are working!' });
});

// WinSMS API configuration
const WINSMS_API_KEY = process.env.WINSMS_API_KEY || "iUOh18YaJE1Ea1keZgW72qg451g713r722EqWe9q1zS0kSAXcuL5lm3JWDFi";
const WINSMS_API_HOST = "www.winsmspro.com";
const WINSMS_API_PATH = "/sms/sms/api";
const WINSMS_SENDER = "Andiamo"; // Your sender ID

// Helper function to format Tunisian phone number
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('216')) {
    cleaned = cleaned.substring(3);
  }
  cleaned = cleaned.replace(/^0+/, '');
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
    return '216' + cleaned;
  }
  return null;
}

// POST /api/send-sms - Send SMS broadcast
app.post('/api/send-sms', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { phoneNumbers, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'Phone numbers array is required' });
    }

    const results = [];
    const errors = [];

    for (const phoneNumber of phoneNumbers) {
      const formattedNumber = formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        errors.push({ phoneNumber, error: `Invalid phone number format: ${phoneNumber}` });
        
        // Log invalid number
        await supabase.from('sms_logs').insert({
          phone_number: phoneNumber,
          message: message.trim(),
          status: 'failed',
          error_message: `Invalid phone number format: ${phoneNumber}`
        });
        continue;
      }

      try {
        // Format parameters according to WinSMS documentation
        const postData = querystring.stringify({
          'action': 'send-sms',
          'api_key': WINSMS_API_KEY,
          'to': formattedNumber,
          'sms': message.trim(),
          'from': WINSMS_SENDER
        });

        // Create HTTPS request options (as per WinSMS documentation)
        const options = {
          hostname: WINSMS_API_HOST,
          port: 443,
          path: WINSMS_API_PATH + '?' + postData,
          method: 'GET',
          timeout: 10000
        };

        // Make HTTPS request using native https module
        const responseData = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              try {
                // Try to parse JSON response
                const parsed = JSON.parse(data);
                resolve({ status: res.statusCode, data: parsed, raw: data });
              } catch (e) {
                // If not JSON, return raw string
                resolve({ status: res.statusCode, data: data, raw: data });
              }
            });
          });

          req.on('error', (e) => {
            reject(e);
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });

          req.end();
        });
        
        // Check API response for errors
        const responseText = typeof responseData.data === 'string' 
          ? responseData.data 
          : JSON.stringify(responseData.data);
        
        // Check for WinSMS error codes (e.g., "102" = Authentication Failed)
        const isError = responseData.status !== 200 ||
                       (responseData.data && responseData.data.code && responseData.data.code !== '200') ||
                       responseText.includes('error') || 
                       responseText.includes('Error') || 
                       responseText.includes('ERROR') ||
                       responseText.includes('Authentication Failed') ||
                       responseText.includes('Failed') ||
                       responseText.includes('insufficient') ||
                       responseText.includes('Insufficient') ||
                       responseText.includes('balance') && responseText.includes('0') ||
                       responseText.toLowerCase().includes('solde insuffisant') ||
                       responseText.toLowerCase().includes('solde') && responseText.includes('0');
        
        if (isError) {
          // Extract error message
          let errorMessage = 'SMS sending failed';
          if (responseData.data && responseData.data.message) {
            errorMessage = responseData.data.message;
          } else if (responseData.data && responseData.data.code) {
            errorMessage = `Error code ${responseData.data.code}: ${responseData.data.message || 'Unknown error'}`;
          } else {
            errorMessage = responseText || 'Unknown error';
          }
          
          await supabase.from('sms_logs').insert({
            phone_number: phoneNumber,
            message: message.trim(),
            status: 'failed',
            error_message: errorMessage,
            api_response: JSON.stringify(responseData.data || responseData.raw)
          });
          
          errors.push({ phoneNumber, error: errorMessage });
        } else {
          // Success
          await supabase.from('sms_logs').insert({
            phone_number: phoneNumber,
            message: message.trim(),
            status: 'sent',
            api_response: JSON.stringify(responseData.data || responseData.raw),
            sent_at: new Date().toISOString()
          });
          
          results.push({ phoneNumber, success: true, response: responseData.data || responseData.raw });
        }
      } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        
        // Check if it's a balance-related error
        const isBalanceError = errorMessage.toString().includes('insufficient') ||
                              errorMessage.toString().includes('balance') ||
                              errorMessage.toString().includes('solde');
        
        const finalErrorMessage = isBalanceError 
          ? `Insufficient balance: ${errorMessage}` 
          : errorMessage.toString();
        
        await supabase.from('sms_logs').insert({
          phone_number: phoneNumber,
          message: message.trim(),
          status: 'failed',
          error_message: finalErrorMessage,
          api_response: null
        });

        errors.push({ phoneNumber, error: finalErrorMessage });
      }

      // Small delay to avoid overwhelming the API (100ms between requests)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      total: phoneNumbers.length,
      sent: results.length,
      failed: errors.length,
      results,
      errors
    });

  } catch (error) {
    console.error('Error sending SMS broadcast:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send SMS broadcast'
    });
  }
});

// GET /api/sms-balance - Check SMS balance (as per WinSMS documentation)
app.get('/api/sms-balance', async (req, res) => {
  try {
    // Build URL according to WinSMS documentation
    const url = `${WINSMS_API_PATH}?action=check-balance&api_key=${WINSMS_API_KEY}&response=json`;

    // Create HTTPS request options
    const options = {
      hostname: WINSMS_API_HOST,
      port: 443,
      path: url,
      method: 'GET',
      timeout: 10000
    };

    // Make HTTPS request using native https module (as per WinSMS documentation)
    const responseData = await new Promise((resolve, reject) => {
      const req = https.get(options, (res) => {
        let data = '';
        
        console.log('Balance check - HTTP Status:', res.statusCode);
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            // Try to parse JSON response
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed, raw: data });
          } catch (e) {
            // If not JSON, return raw string
            resolve({ status: res.statusCode, data: data, raw: data });
          }
        });
      });

      req.on('error', (e) => {
        console.error('Balance check error:', e);
        reject(e);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });

    // Parse the response - WinSMS might return different formats
    let balanceData = responseData.data;
    
    // If response is a string, try to parse it
    if (typeof balanceData === 'string') {
      try {
        balanceData = JSON.parse(balanceData);
      } catch (e) {
        // Keep as string if JSON parse fails
      }
    }

    // Check for error codes (e.g., "102" = Authentication Failed)
    if (balanceData && balanceData.code && balanceData.code !== '200') {
      // Return 200 status with error details instead of 500
      return res.status(200).json({
        success: true,
        balance: null,
        currency: null,
        message: 'Unable to fetch balance from SMS provider',
        configured: true,
        error: balanceData.message || `Error code ${balanceData.code}`,
        rawResponse: balanceData
      });
    }

    res.json({
      success: true,
      balance: balanceData,
      rawResponse: responseData.raw,
      // Try to extract balance value from common formats
      balanceValue: balanceData?.balance || balanceData?.solde || balanceData?.credit || balanceData?.amount || null
    });
  } catch (error) {
    console.error('Error checking SMS balance:', error);
    // Return 200 status with error details instead of 500
    // This prevents the UI from breaking if SMS service is unavailable
    res.status(200).json({
      success: true,
      balance: null,
      currency: null,
      message: 'SMS service unavailable',
      configured: false,
      error: error.message || 'Failed to check SMS balance',
      rawResponse: null
    });
  }
});

// POST /api/bulk-phones - Add bulk phone numbers
app.post('/api/bulk-phones', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { phoneNumbers } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'Phone numbers array is required' });
    }

    const validNumbers = [];
    const invalidNumbers = [];
    const duplicateNumbers = [];

    for (const phone of phoneNumbers) {
      const formatted = formatPhoneNumber(phone);
      
      if (!formatted) {
        invalidNumbers.push(phone);
        continue;
      }

      const localNumber = formatted.substring(3);

      // Check if number already exists
      const { data: existing } = await supabase
        .from('phone_subscribers')
        .select('phone_number')
        .eq('phone_number', localNumber)
        .single();

      if (existing) {
        duplicateNumbers.push(phone);
        continue;
      }

      validNumbers.push({
        phone_number: localNumber,
        language: 'en'
      });
    }

    let insertedCount = 0;
    if (validNumbers.length > 0) {
      const { data, error } = await supabase
        .from('phone_subscribers')
        .insert(validNumbers)
        .select();

      if (error && error.code !== '23505') {
        throw error;
      }

      insertedCount = data?.length || 0;
    }

    res.json({
      success: true,
      total: phoneNumbers.length,
      inserted: insertedCount,
      duplicates: duplicateNumbers.length,
      invalid: invalidNumbers.length,
      duplicateNumbers,
      invalidNumbers
    });

  } catch (error) {
    console.error('Error adding bulk phone numbers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add phone numbers'
    });
  }
});

app.listen(process.env.PORT || 8082, () => console.log('API server running on port', process.env.PORT || 8082));
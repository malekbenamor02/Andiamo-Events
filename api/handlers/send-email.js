// Email sending endpoint for Vercel
// Using ES module syntax because package.json has "type": "module"

export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Verify admin authentication - REQUIRED for all admin actions
    const { verifyAdminAuth } = await import('./authAdminMiddleware.js');
    const authResult = await verifyAdminAuth(req);
    
    if (!authResult.valid) {
      // Clear invalid token
      res.clearCookie('adminToken', { path: '/' });
      return res.status(authResult.statusCode || 401).json({
        error: authResult.error,
        reason: authResult.reason || 'Authentication required',
        valid: false
      });
    }
    
    // Parse request body - Vercel provides body directly or as stream
    let bodyData;
    
    if (req.body) {
      // Body already parsed (Vercel does this automatically)
      bodyData = req.body;
    } else {
      // Need to read from stream
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      bodyData = JSON.parse(body);
    }
    
    const { to, subject, html, from } = bodyData;
    
    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'to, subject, and html are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Invalid email address', 
        details: `The email address "${to}" is not valid. Please verify the email address and try again.` 
      });
    }
    
    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Email configuration missing: EMAIL_USER or EMAIL_PASS not set');
      return res.status(500).json({ 
        error: 'Email service not configured', 
        details: 'Email server configuration is missing. Please contact the administrator.' 
      });
    }
    
    // Initialize nodemailer - use dynamic import for ES modules
    const nodemailer = await import('nodemailer');
    
    // Configure SMTP transporter using environment variables
    const transporter = nodemailer.default.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    
    // Send email
    await transporter.sendMail({
      from: from || `Andiamo Events <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Email sending failed:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to send email';
    let errorDetails = error.message || 'Unknown error occurred';
    
    // Check for common SMTP errors
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = 'Email authentication failed';
      errorDetails = 'The email server credentials are invalid. Please contact the administrator.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Email server connection failed';
      errorDetails = 'Unable to connect to the email server. Please try again later.';
    } else if (error.responseCode === 550 || error.message?.includes('550')) {
      errorMessage = 'Email address rejected';
      errorDetails = `The email address "${req.body?.to || 'unknown'}" was rejected by the email server. Please verify the email address and try again.`;
    } else if (error.responseCode === 553 || error.message?.includes('553')) {
      errorMessage = 'Invalid email address';
      errorDetails = `The email address "${req.body?.to || 'unknown'}" is invalid. Please verify the email address and try again.`;
    }
    
    return res.status(500).json({ 
      error: errorMessage, 
      details: errorDetails 
    });
  }
};


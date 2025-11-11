export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test if environment variables are available
    const hasGmailUser = !!process.env.GMAIL_USER;
    const hasGmailPassword = !!process.env.GMAIL_APP_PASSWORD;
    const hasGmailFrom = !!process.env.GMAIL_FROM;

    // Debug: Log all environment variables
    console.log('Environment variables:', {
      GMAIL_USER: process.env.GMAIL_USER ? 'SET' : 'NOT SET',
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? 'SET' : 'NOT SET',
      GMAIL_FROM: process.env.GMAIL_FROM ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    });

    res.status(200).json({ 
      success: true,
      message: 'Email API is working',
      method: req.method,
      env: {
        hasGmailUser,
        hasGmailPassword,
        hasGmailFrom,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test email API error:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
} 
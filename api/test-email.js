export default async function handler(req, res) {
  try {
    // Test if environment variables are available
    const hasGmailUser = !!process.env.GMAIL_USER;
    const hasGmailPassword = !!process.env.GMAIL_APP_PASSWORD;
    const hasGmailFrom = !!process.env.GMAIL_FROM;

    res.status(200).json({ 
      success: true,
      message: 'Email API is working',
      method: req.method,
      env: {
        hasGmailUser,
        hasGmailPassword,
        hasGmailFrom
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test email API error:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
} 
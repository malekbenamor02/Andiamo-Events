export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test if environment variables are available
    const hasGmailUser = !!process.env.GMAIL_USER;
    const hasGmailPassword = !!process.env.GMAIL_APP_PASSWORD;
    const hasGmailFrom = !!process.env.GMAIL_FROM;

    res.status(200).json({ 
      success: true,
      message: 'Email API is working',
      env: {
        hasGmailUser,
        hasGmailPassword,
        hasGmailFrom
      }
    });
  } catch (error) {
    console.error('Test email API error:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
} 
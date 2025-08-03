export default async function handler(req, res) {
  res.status(200).json({ 
    success: true,
    message: 'API is working',
    method: req.method,
    timestamp: new Date().toISOString(),
    env: {
      hasGmailUser: !!process.env.GMAIL_USER,
      hasGmailPassword: !!process.env.GMAIL_APP_PASSWORD,
      hasGmailFrom: !!process.env.GMAIL_FROM,
      hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
      hasSupabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
      hasJwtSecret: !!process.env.JWT_SECRET
    }
  });
} 
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

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
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer re_KMKERW52_HE9fGYFDw6HpTF9kpQzfTYzf',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
      to,
      subject,
      html,
      }),
    });
    if (response.ok) {
      res.status(200).json({ success: true });
    } else {
      const error = await response.text();
      console.error('Resend API Error:', error);
      res.status(500).json({ error: 'Failed to send email', details: error });
    }
  } catch (e) {
    console.error('CRASH IN /api/send-email:', e);
    res.status(500).send('Server crashed');
  }
});

// Admin login endpoint
app.post('/api/admin-login', async (req, res) => {
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
  const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.cookie('adminToken', token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 2 * 60 * 60 * 1000 });
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
// Example protected route:
// app.get('/api/admin-protected', requireAdminAuth, (req, res) => {
//   res.json({ message: 'You are authenticated as admin', admin: req.admin });
// });

app.listen(8081, () => console.log('API server running on http://localhost:8081'));
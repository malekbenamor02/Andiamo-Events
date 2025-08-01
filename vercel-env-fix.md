# Fix Vercel Environment Variables

## The Problem:
Vercel functions don't automatically get `VITE_` prefixed variables. We need to add them without the prefix.

## Solution:

### Add These Environment Variables in Vercel:

**Remove the VITE_ prefix for server-side variables:**

```
SUPABASE_URL=https://ykeryyraxmtjunnotoep.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM
JWT_SECRET=your-secret-jwt-key-here
GMAIL_USER=fmalekbenamorf@gmail.com
GMAIL_APP_PASSWORD=gdwf jvzu olih ktep
GMAIL_FROM=Andiamo Events <fmalekbenamorf@gmail.com>
```

### Keep These for Frontend:
```
VITE_SUPABASE_URL=https://ykeryyraxmtjunnotoep.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM
```

## Steps:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add the variables WITHOUT VITE_ prefix for server-side
3. Keep the VITE_ prefixed ones for frontend
4. Redeploy your project 
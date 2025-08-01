# Vercel Environment Variables

Add these to your Vercel project settings:

## Required Environment Variables:

```
VITE_SUPABASE_URL=https://ykeryyraxmtjunnotoep.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM
JWT_SECRET=your-secret-jwt-key-here
GMAIL_USER=fmalekbenamorf@gmail.com
GMAIL_APP_PASSWORD=gdwf jvzu olih ktep
GMAIL_FROM=Andiamo Events <fmalekbenamorf@gmail.com>
```

## How to Add in Vercel:

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable above
5. Redeploy your project

## Install Dependencies:

Add these to your `package.json`:

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3"
  }
}
```

Then run:
```bash
npm install
``` 
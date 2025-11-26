# Fix Database Connection Issues

## Quick Fix Steps

### Step 1: Verify .env File Exists
- Check if `.env` file exists in project root
- If missing, copy from `env.example`:
  ```bash
  cp env.example .env
  ```

### Step 2: Check Environment Variables
Your `.env` file should contain:
```
VITE_SUPABASE_URL=https://ykeryyraxmtjunnotoep.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Step 3: Verify Supabase Project Status
1. Go to https://supabase.com/dashboard
2. Select your project
3. Check if project is:
   - **Active** (not paused)
   - **Accessible** (no errors in project status)

### Step 4: Get Correct Credentials
If credentials are wrong:
1. Go to Supabase Dashboard → Your Project → Settings → API
2. Copy:
   - **Project URL** → Paste in `VITE_SUPABASE_URL`
   - **anon public key** → Paste in `VITE_SUPABASE_ANON_KEY`

### Step 5: Restart Dev Server
**IMPORTANT**: Environment variables are only loaded when the server starts!
1. Stop your dev server (Ctrl+C)
2. Start it again: `npm run dev`
3. Refresh your browser

### Step 6: Clear Browser Cache
1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Or clear cache in browser settings

## Test Connection

Open browser console (F12) and run:
```javascript
import('@/integrations/supabase/client').then(m => {
  console.log('Supabase client:', m.supabase);
  // Test connection
  m.supabase.from('events').select('count').then(({data, error}) => {
    if (error) {
      console.error('Connection error:', error);
    } else {
      console.log('✓ Connection successful!');
    }
  });
});
```

## Common Issues

### 1. "Missing Supabase environment variables"
- **Fix**: Make sure `.env` file exists and has correct variables
- **Fix**: Restart dev server after changing `.env`

### 2. "Invalid API key"
- **Fix**: Check if you copied the correct `anon/public` key (not the `service_role` key)
- **Fix**: Get fresh key from Supabase Dashboard → Settings → API

### 3. "Project not found"
- **Fix**: Check if Supabase project is paused
- **Fix**: Verify URL is correct (should end with `.supabase.co`)

### 4. "Network error"
- **Fix**: Check internet connection
- **Fix**: Check if Supabase service is down (check status.supabase.com)

### 5. All queries fail
- **Fix**: Check RLS policies in Supabase
- **Fix**: Verify table exists
- **Fix**: Check browser console for specific error messages

## After Fixing

Once connection is restored:
1. All database operations should work
2. Logs will start appearing in logs tab
3. Forms will submit successfully
4. Admin dashboard will load data













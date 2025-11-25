# Test Database Connection

## Quick Test Steps

1. **Check if .env file exists**
   - Look for `.env` file in project root
   - If missing, copy from `env.example` and fill in your Supabase credentials

2. **Verify Supabase credentials**
   - Go to Supabase Dashboard: https://supabase.com/dashboard
   - Select your project
   - Go to Settings → API
   - Copy:
     - Project URL → `VITE_SUPABASE_URL`
     - anon/public key → `VITE_SUPABASE_ANON_KEY`

3. **Check your .env file contains:**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

4. **Restart your dev server**
   - Stop the server (Ctrl+C)
   - Run `npm run dev` again
   - Environment variables are only loaded on server start

5. **Test the connection**
   - Open browser console (F12)
   - Type: `import('@/integrations/supabase/client').then(m => console.log(m.supabase))`
   - Should show the Supabase client object (not an error)

## If Still Not Working

1. **Check Supabase project status**
   - Go to Supabase Dashboard
   - Make sure project is not paused
   - Check if you have access

2. **Check browser console**
   - Look for any errors related to Supabase
   - Check Network tab for failed requests

3. **Verify credentials are correct**
   - Double-check URL and key are correct
   - No extra spaces or quotes

4. **Clear browser cache**
   - Hard refresh: Ctrl+Shift+R
   - Or clear cache and reload











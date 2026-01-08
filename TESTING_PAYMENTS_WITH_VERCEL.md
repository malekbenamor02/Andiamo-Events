# Testing Payments with Vercel Preview Deployments

## ✅ Quick Answer: Yes, Vercel Preview URLs Work Perfectly!

Vercel automatically provides **HTTPS URLs** for all deployments (preview and production), which is exactly what Flouci requires for payment callbacks.

## How It Works

The payment system automatically detects Vercel URLs and uses them for payment callbacks. **No configuration needed!**

### Automatic Detection

The code automatically detects:
- ✅ **Vercel preview deployments** (e.g., `https://your-app-abc123.vercel.app`)
- ✅ **Vercel production** (e.g., `https://yourdomain.com`)
- ✅ **Any HTTPS URL** (automatic)

### Manual Override (Optional)

If you need to override the auto-detected URL, set `VITE_PUBLIC_URL` in your environment variables:

```env
VITE_PUBLIC_URL=https://your-custom-url.com
```

## Testing Steps

### 1. Deploy to Vercel

Push your code to GitHub and Vercel will automatically create a preview deployment:

```bash
git push origin your-branch-name
```

### 2. Get Your Preview URL

After deployment, Vercel will provide you with:
- **Preview URL**: `https://your-app-abc123.vercel.app` (unique for each branch/PR)
- **Production URL**: `https://yourdomain.com` (if configured)

### 3. Configure Environment Variables in Vercel

Make sure these are set in your Vercel project settings:

**Required:**
- `FLOUCI_PUBLIC_KEY` - Your Flouci public key
- `FLOUCI_SECRET_KEY` - Your Flouci secret key
- `SUPABASE_URL` - Your Supabase URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

**Optional (for manual override):**
- `VITE_PUBLIC_URL` - Only if you need to override the auto-detected URL

### 4. Test the Payment Flow

1. Visit your Vercel preview URL (e.g., `https://your-app-abc123.vercel.app`)
2. Create an order and proceed to payment
3. The payment system will automatically use the HTTPS preview URL for callbacks
4. Complete the payment test

## Localhost Development

For local development, you have two options:

### Option 1: Use Vercel Preview (Recommended)

Just deploy to Vercel and test on the preview URL. This is the easiest way!

### Option 2: Use a Tunnel Service

If you need to test locally:

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   # or
   brew install ngrok
   ```

2. **Start your local server:**
   ```bash
   npm run dev:full
   ```

3. **Start ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Add to your `.env` file:**
   ```env
   VITE_PUBLIC_URL=https://abc123.ngrok.io
   ```

6. **Restart your dev server**

## Troubleshooting

### Error: "HTTPS URL required for payment callbacks"

**Solution:** Make sure you're using:
- ✅ Vercel preview/production URL (automatic HTTPS)
- ✅ ngrok or similar tunnel for localhost
- ✅ Set `VITE_PUBLIC_URL` if needed

### Error: "SMT operation failed" (code: 1, status: 412)

This usually means:
- ❌ Using HTTP instead of HTTPS
- ❌ Invalid API keys
- ❌ Amount too small (< 1 TND)

**Check:**
1. Verify your URLs are HTTPS (check browser console logs)
2. Verify Flouci API keys are correct in Vercel environment variables
3. Verify payment amount is at least 1 TND

### Payment callbacks not working

**Check:**
1. The preview URL is accessible (not expired)
2. Environment variables are set correctly in Vercel
3. Check Vercel function logs for errors

## Vercel Environment Variables Setup

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add all required variables:
   - `FLOUCI_PUBLIC_KEY`
   - `FLOUCI_SECRET_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (Optional) `VITE_PUBLIC_URL`

4. **Important:** Make sure to add them for:
   - ✅ **Production**
   - ✅ **Preview** (for testing)
   - ✅ **Development** (if you deploy dev builds)

5. Redeploy after adding environment variables

## Summary

✅ **Vercel preview deployments automatically provide HTTPS URLs**  
✅ **No configuration needed** - the code auto-detects Vercel URLs  
✅ **Perfect for testing** - each branch/PR gets its own preview URL  
✅ **Production-ready** - same code works for production deployments  

Just deploy to Vercel and test! 🚀

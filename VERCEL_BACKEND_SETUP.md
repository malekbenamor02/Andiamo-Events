# 🚀 Deploy Backend on Vercel (Serverless Functions)

## Great News! ✅

You can deploy your **entire app** (frontend + backend) on Vercel using **Serverless Functions**. No need for Railway or other services!

## How It Works

1. **Frontend**: Static files served by Vercel
2. **Backend**: Express app wrapped as Vercel Serverless Functions
3. **Same Domain**: Everything runs on `your-domain.vercel.app` or your custom domain

## What I've Set Up

### ✅ Created `api/index.js`
- Wraps your Express app for Vercel serverless functions
- Uses `serverless-http` (already in your dependencies)
- Handles all `/api/*` routes

### ✅ Updated `vercel.json`
- Configured serverless function with 30s timeout
- Routes `/api/*` to the serverless function

### ✅ Updated API Config
- Uses relative URLs (works on same domain)
- No `VITE_API_URL` needed when backend is on Vercel

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Add Vercel serverless function for backend API"
git push origin main
```

### 2. Vercel Auto-Deploys
- Vercel will automatically detect the `api/` directory
- It will create serverless functions for your backend
- No additional configuration needed!

### 3. Set Environment Variables in Vercel

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add all your backend environment variables:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email
EMAIL_PASS=your_password
EMAIL_HOST=mail.routing.net
EMAIL_PORT=587
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
```

**Important:** 
- Add these for **Production**, **Preview**, and **Development** environments
- These are the same variables you have in your `.env` file

### 4. That's It! 🎉

After deployment:
- Frontend: `https://your-domain.vercel.app`
- Backend API: `https://your-domain.vercel.app/api/*`
- Everything works on the same domain!

## How to Test

1. Deploy to Vercel
2. Visit: `https://your-domain.vercel.app/api/test`
3. Should see: `{"success":true,"message":"API is working",...}`
4. Try admin login - it should work!

## Benefits

✅ **Everything on one platform** (Vercel)  
✅ **Same domain** (no CORS issues)  
✅ **Automatic scaling** (serverless)  
✅ **No separate backend deployment** needed  
✅ **Free tier** for most use cases  

## Troubleshooting

### API returns 404?
- Check Vercel deployment logs
- Verify `api/index.js` exists
- Check function logs in Vercel dashboard

### Environment variables not working?
- Make sure they're set in Vercel dashboard
- Redeploy after adding variables
- Check variable names match exactly

### Timeout errors?
- Increase `maxDuration` in `vercel.json` (max 60s on Pro plan)
- Optimize slow database queries

---

**You're all set! Just push to GitHub and Vercel will handle the rest.** 🚀


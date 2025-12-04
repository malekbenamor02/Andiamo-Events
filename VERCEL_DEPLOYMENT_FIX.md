# 🔧 Vercel Deployment Fix - API URL Configuration

## Problem
After deploying to Vercel, admin login fails with 404 errors because:
- Frontend is deployed on Vercel (static files)
- Backend API is NOT on Vercel (separate Express server)
- API calls use relative URLs (`/api/admin-login`) which don't exist on Vercel

## Solution Applied ✅

### 1. Created API Configuration Helper
- **File:** `src/lib/api-config.ts`
- Automatically uses `VITE_API_URL` in production
- Falls back to relative URLs in development (Vite proxy handles it)

### 2. Updated API Client
- **File:** `src/lib/api-client.ts`
- `apiFetch()` now automatically builds full URLs for API routes
- No need to update individual API calls

## Next Steps - Required for Production

### Step 1: Deploy Your Backend

You need to deploy your Express backend (`server/` directory) to one of these services:

**Option A: Railway (Recommended)**
1. Go to [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub
3. Select your repository
4. Add environment variables (see below)
5. Set root directory to project root
6. Set start command: `npm run server`

**Option B: Heroku**
1. Create `Procfile` with: `web: node server/index.cjs`
2. Deploy via Heroku CLI or GitHub integration

**Option C: DigitalOcean App Platform**
1. Create new app → GitHub repository
2. Configure build/run commands
3. Add environment variables

### Step 2: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add the following:

```
VITE_API_URL = https://your-backend-url.com
```

**Important:** 
- Replace `https://your-backend-url.com` with your actual backend URL
- Example: `https://andiamo-api.railway.app` or `https://api.andiamoevents.com`
- **Do NOT include trailing slash**

### Step 3: Redeploy on Vercel

After adding `VITE_API_URL`:
1. Vercel will automatically trigger a new deployment
2. Or manually trigger: Deployments → Redeploy

## How It Works

### Development (localhost)
- Uses relative URLs: `/api/admin-login`
- Vite proxy forwards to `http://localhost:8081`
- No `VITE_API_URL` needed

### Production (Vercel)
- Uses full URL: `https://your-backend-url.com/api/admin-login`
- Reads from `VITE_API_URL` environment variable
- All API calls automatically use the correct base URL

## Verification

After deployment, check browser console:
- ✅ Should see: `API Base URL: https://your-backend-url.com`
- ✅ API calls should go to your backend URL
- ✅ No more 404 errors

## Troubleshooting

### Still getting 404 errors?
1. Check `VITE_API_URL` is set in Vercel
2. Verify backend is running and accessible
3. Check CORS settings on backend (should allow your Vercel domain)
4. Check browser console for actual API URLs being called

### CORS errors?
Update backend CORS to allow your Vercel domain:
```javascript
// In server/index.cjs
const allowedOrigins = [
  'https://www.andiamoevents.com',
  'https://andiamoevents.vercel.app',
  // Add your Vercel preview URLs
];
```

### Backend not responding?
1. Check backend logs
2. Verify environment variables on backend
3. Test backend directly: `curl https://your-backend-url.com/api/test`

---

**The code is now ready. You just need to:**
1. Deploy backend to Railway/Heroku/etc.
2. Set `VITE_API_URL` in Vercel
3. Redeploy frontend


# Vercel Deployment Troubleshooting Guide

## Current Status
- ✅ Build works locally (`npm run build` succeeds)
- ❌ Deployment fails on Vercel

## Common Vercel Deployment Issues & Solutions

### 1. Check Vercel Build Logs
**CRITICAL**: You must check the actual error message in Vercel logs.

1. Go to https://vercel.com/dashboard
2. Click on your "Andiamo-Events" project
3. Go to "Deployments" tab
4. Click on the failed deployment (red X)
5. Click "Build Logs" or "Function Logs"
6. **Copy the error message** and share it

### 2. Environment Variables
Make sure these are set in Vercel Dashboard → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL` (for API routes)
- `SUPABASE_ANON_KEY` (for API routes)
- `JWT_SECRET`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `GMAIL_FROM`

**Important**: Set them for **Production**, **Preview**, and **Development** environments.

### 3. Node Version
We've added `engines` field to `package.json`:
```json
"engines": {
  "node": ">=18.0.0",
  "npm": ">=9.0.0"
}
```

If this doesn't work, try:
- Go to Vercel Dashboard → Settings → General
- Set "Node.js Version" to `18.x` or `20.x`

### 4. Build Command
Current build command: `npm run build`

If it fails, try:
- In Vercel Dashboard → Settings → General
- Override Build Command: `npm ci && npm run build`

### 5. Framework Detection
Vercel should auto-detect Vite. If not:
- Go to Vercel Dashboard → Settings → General
- Set "Framework Preset" to "Vite" or "Other"

### 6. API Routes Configuration
The `vercel.json` has API routes configured. Make sure:
- API routes are in `/api` folder
- They export default async function handler
- They're using ES modules (`.js` files with `export default`)

### 7. Common Error Messages & Fixes

#### "Module not found"
- Check if all dependencies are in `package.json`
- Run `npm install` locally and commit `package-lock.json`

#### "Build timeout"
- Increase build timeout in Vercel settings
- Or optimize build (code splitting, etc.)

#### "Out of memory"
- Vercel has memory limits
- Try optimizing the build or contact Vercel support

#### "Type error" or "Syntax error"
- Check TypeScript configuration
- Run `npm run lint` locally and fix errors

#### "Command failed"
- Check if build command is correct
- Verify Node version compatibility

### 8. Manual Redeploy
1. Go to Vercel Dashboard → Deployments
2. Click "..." on latest deployment
3. Click "Redeploy"
4. Or click "Redeploy" button

### 9. Clear Vercel Cache
1. Go to Vercel Dashboard → Settings → General
2. Scroll to "Build & Development Settings"
3. Click "Clear Build Cache"
4. Redeploy

### 10. Check GitHub Integration
1. Go to Vercel Dashboard → Settings → Git
2. Verify GitHub repository is connected
3. Check "Production Branch" is set to `main`
4. Verify webhook is active

## Next Steps
1. **Check the actual error message** in Vercel build logs
2. Share the error message so we can fix it
3. Try the solutions above based on the error type

## Quick Test
To verify the build works:
```bash
npm ci          # Clean install
npm run build   # Build
```

If this works locally but fails on Vercel, it's likely:
- Environment variable issue
- Node version mismatch
- Vercel-specific configuration issue


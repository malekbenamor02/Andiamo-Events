# Step-by-Step: Deploy to Vercel Preview (Not Production)

This guide will walk you through deploying your app to Vercel **preview** deployments, which are perfect for testing payments without affecting production.

## Prerequisites

- ✅ GitHub account
- ✅ Vercel account (sign up at [vercel.com](https://vercel.com) if needed)
- ✅ Your code pushed to a GitHub repository

---

## Step 1: Connect Your GitHub Repository to Vercel

### 1.1. Sign in to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** or **"Log In"**
3. Choose **"Continue with GitHub"** (recommended)

### 1.2. Import Your Project

1. After logging in, click **"Add New..."** → **"Project"**
2. You'll see a list of your GitHub repositories
3. Find your `Andiamo-Events` repository
4. Click **"Import"** next to it

---

## Step 2: Configure Project Settings

### 2.1. Project Configuration

Vercel will auto-detect your project settings. Verify:

- **Framework Preset**: Should be `Vite` (auto-detected)
- **Root Directory**: Leave as `./` (unless your project is in a subfolder)
- **Build Command**: Should be `npm run build` (auto-detected)
- **Output Directory**: Should be `dist` (auto-detected)
- **Install Command**: Should be `npm install` (auto-detected)

### 2.2. Environment Variables (IMPORTANT!)

**DO NOT click "Deploy" yet!** First, add your environment variables:

1. Click **"Environment Variables"** section (or expand it)
2. Click **"Add"** for each variable below

Add these variables one by one:

#### Required Variables:

```
Name: FLOUCI_PUBLIC_KEY
Value: [Your Flouci public key]
Environment: Production, Preview, Development (check all three)
```

```
Name: FLOUCI_SECRET_KEY
Value: [Your Flouci secret key]
Environment: Production, Preview, Development (check all three)
```

```
Name: SUPABASE_URL
Value: [Your Supabase URL]
Environment: Production, Preview, Development (check all three)
```

```
Name: SUPABASE_ANON_KEY
Value: [Your Supabase anon key]
Environment: Production, Preview, Development (check all three)
```

```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Your Supabase service role key]
Environment: Production, Preview, Development (check all three)
```

```
Name: JWT_SECRET
Value: [Your JWT secret]
Environment: Production, Preview, Development (check all three)
```

#### Optional Variables (if you use them):

```
Name: VITE_RECAPTCHA_SITE_KEY
Value: [Your reCAPTCHA site key]
Environment: Production, Preview, Development (check all three)
```

```
Name: RECAPTCHA_SECRET_KEY
Value: [Your reCAPTCHA secret key]
Environment: Production, Preview, Development (check all three)
```

```
Name: EMAIL_USER
Value: [Your email]
Environment: Production, Preview, Development (check all three)
```

```
Name: EMAIL_PASS
Value: [Your email password]
Environment: Production, Preview, Development (check all three)
```

```
Name: EMAIL_HOST
Value: [Your email host]
Environment: Production, Preview, Development (check all three)
```

```
Name: EMAIL_PORT
Value: 587
Environment: Production, Preview, Development (check all three)
```

**Important:** Make sure to check **all three environments** (Production, Preview, Development) for each variable!

### 2.3. Skip Production Domain (For Now)

- **DO NOT** add a custom domain yet
- We're only deploying to preview, not production
- You can add a custom domain later if needed

---

## Step 3: Deploy to Preview

### 3.1. Create a New Branch (Recommended)

To ensure you're deploying to preview (not production), create a new branch:

1. In your terminal, navigate to your project:
   ```bash
   cd Andiamo-Events
   ```

2. Create a new branch:
   ```bash
   git checkout -b preview-deployment
   ```
   Or use any branch name you prefer (e.g., `test-payment`, `preview-test`)

3. Push the branch to GitHub:
   ```bash
   git push origin preview-deployment
   ```

### 3.2. Deploy from Vercel Dashboard

**Option A: Deploy from Vercel Dashboard**

1. Go back to Vercel dashboard
2. Click **"Deploy"** button
3. Vercel will build and deploy your project
4. Wait for the deployment to complete (usually 2-5 minutes)

**Option B: Auto-Deploy from GitHub (Recommended)**

1. After connecting your repo, Vercel automatically deploys when you push to GitHub
2. Just push your branch:
   ```bash
   git push origin preview-deployment
   ```
3. Vercel will automatically start a deployment
4. Go to your Vercel dashboard to see the deployment progress

---

## Step 4: Get Your Preview URL

### 4.1. Find Your Preview URL

1. After deployment completes, go to your Vercel project dashboard
2. You'll see a list of deployments
3. Find your latest deployment (should show your branch name, e.g., `preview-deployment`)
4. Click on the deployment
5. You'll see the **Preview URL** at the top, something like:
   ```
   https://andiamo-events-abc123.vercel.app
   ```

### 4.2. Verify It's a Preview Deployment

- ✅ Preview deployments show your branch name
- ✅ URL contains `.vercel.app` (not your custom domain)
- ✅ Status shows "Ready" with a green checkmark

---

## Step 5: Test Your Payment Flow

### 5.1. Visit Your Preview URL

1. Open your preview URL in a browser:
   ```
   https://andiamo-events-abc123.vercel.app
   ```

2. The app should load normally

### 5.2. Test Payment

1. Navigate to an event or pass purchase page
2. Fill in the order form
3. Select "Online Payment" as payment method
4. Submit the order
5. You should be redirected to Flouci payment page
6. Complete the test payment

### 5.3. Verify HTTPS URLs

The payment system should automatically detect and use the HTTPS preview URL. Check the browser console (F12) to see:
```
✅ Detected Vercel deployment, using HTTPS URL: https://andiamo-events-abc123.vercel.app
```

---

## Step 6: Make Changes and Redeploy

### 6.1. Make Code Changes

1. Make your code changes locally
2. Commit your changes:
   ```bash
   git add .
   git commit -m "Your commit message"
   ```

### 6.2. Push to Preview Branch

```bash
git push origin preview-deployment
```

### 6.3. Vercel Auto-Deploys

- Vercel will automatically detect the push
- A new preview deployment will start
- You'll get a new preview URL (or the same one, depending on Vercel's configuration)

---

## Important Notes

### ✅ Preview vs Production

- **Preview Deployments**: Created from any branch (except main/master)
- **Production Deployments**: Only from `main` or `master` branch (or your configured production branch)

### ✅ To Keep It as Preview Only

- **DO NOT** merge your preview branch to `main`/`master`
- **DO NOT** set a custom domain for preview deployments
- Keep working on your preview branch

### ✅ Multiple Preview Deployments

- Each branch gets its own preview URL
- You can have multiple preview deployments at once
- Perfect for testing different features

### ✅ Environment Variables

- Preview deployments use **Preview** environment variables
- Production deployments use **Production** environment variables
- Make sure you've set variables for **Preview** environment!

---

## Troubleshooting

### Deployment Fails

**Check:**
1. Build logs in Vercel dashboard
2. Make sure all dependencies are in `package.json`
3. Verify build command is correct
4. Check for TypeScript/ESLint errors

### Environment Variables Not Working

**Check:**
1. Variables are set for **Preview** environment (not just Production)
2. Variable names match exactly (case-sensitive)
3. No extra spaces in variable values
4. Redeploy after adding variables

### Payment Still Shows HTTP Error

**Check:**
1. Browser console for the detected URL
2. Make sure you're visiting the HTTPS preview URL (not localhost)
3. Check Vercel deployment logs

### Preview URL Not Accessible

**Check:**
1. Deployment status is "Ready"
2. No errors in deployment logs
3. Try accessing the URL in an incognito window

---

## Quick Reference Commands

```bash
# Create preview branch
git checkout -b preview-deployment

# Make changes and commit
git add .
git commit -m "Test payment flow"

# Push to preview (triggers Vercel deployment)
git push origin preview-deployment

# Check deployment status
# (Go to Vercel dashboard)
```

---

## Summary

1. ✅ Connect GitHub repo to Vercel
2. ✅ Add environment variables (check Preview environment!)
3. ✅ Create a preview branch (not main/master)
4. ✅ Push to preview branch
5. ✅ Get preview URL from Vercel dashboard
6. ✅ Test payment flow on preview URL
7. ✅ Make changes and push again for new preview deployment

**Remember:** As long as you don't push to `main`/`master` and don't set a custom domain, you'll only create preview deployments! 🚀

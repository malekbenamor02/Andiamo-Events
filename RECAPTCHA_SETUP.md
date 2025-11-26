# reCAPTCHA Setup Guide

This document explains how reCAPTCHA is configured for the admin and ambassador login pages.

## Environment Variables

Add these environment variables to your `.env` file and Vercel project settings:

### Frontend (Vite)
```
VITE_RECAPTCHA_SITE_KEY=your_site_key_here
```

### Backend (Server/Vercel)
```
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

**Note:** Replace `your_site_key_here` and `your_secret_key_here` with your actual reCAPTCHA keys from Google reCAPTCHA console.

## Vercel Configuration

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add the following variables:
   - `VITE_RECAPTCHA_SITE_KEY` (for frontend)
   - `RECAPTCHA_SECRET_KEY` (for backend API routes)

## How It Works

### Admin Login
1. User completes reCAPTCHA on the login page
2. reCAPTCHA token is sent to `/api/admin-login` along with credentials
3. Server verifies the reCAPTCHA token with Google's API
4. If verification succeeds, login proceeds

### Ambassador Login
1. User completes reCAPTCHA on the login page
2. reCAPTCHA token is first verified via `/api/verify-recaptcha`
3. If verification succeeds, login proceeds with credentials

## API Routes

### `/api/admin-login`
- **Method**: POST
- **Body**: `{ email, password, recaptchaToken }`
- **Verifies**: reCAPTCHA token server-side before processing login

### `/api/verify-recaptcha`
- **Method**: POST
- **Body**: `{ recaptchaToken }`
- **Returns**: `{ success: true/false, message/error }`
- **Used by**: Ambassador login page

## Notes

- The reCAPTCHA keys are hardcoded as fallbacks in the code, but you should use environment variables in production
- reCAPTCHA uses dark theme to match the login page design
- If reCAPTCHA verification fails, the user will see an error message and must complete it again
- The reCAPTCHA widget resets after each login attempt


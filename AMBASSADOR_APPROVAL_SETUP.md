# 🎯 Ambassador Approval System Setup Guide

## Overview
This system allows ambassadors to apply, admins to review applications, and automatically generates credentials with email notifications.

## 🔧 Database Setup

### 1. Run the Email Field Migration
Execute this SQL in your Supabase SQL Editor:

```sql
-- Add email field to ambassador_applications table
ALTER TABLE ambassador_applications 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing applications to have a default email if needed
UPDATE ambassador_applications 
SET email = 'noreply@andiamo.com' 
WHERE email IS NULL;

-- Make email required for new applications
ALTER TABLE ambassador_applications 
ALTER COLUMN email SET NOT NULL;
```

### 2. Verify Database Structure
Your tables should have these fields:

**ambassador_applications:**
- id (UUID)
- full_name (TEXT)
- age (INTEGER)
- phone_number (TEXT)
- email (TEXT) ← NEW
- city (TEXT)
- social_link (TEXT)
- motivation (TEXT)
- status (TEXT)
- created_at (TIMESTAMP)

**ambassadors:**
- id (UUID)
- full_name (TEXT)
- phone (TEXT)
- email (TEXT)
- city (TEXT)
- password (TEXT)
- status (TEXT)
- commission_rate (DECIMAL)
- created_at (TIMESTAMP)

## 📧 Email Configuration

### 1. Set up Email Service
You have several options:

**Option A: EmailJS (Recommended for frontend)**
```bash
npm install @emailjs/browser
```

**Option B: Backend API with Nodemailer**
```bash
npm install nodemailer
```

**Option C: Supabase Edge Functions**
Create a Supabase Edge Function for email sending.

### 2. Environment Variables
Add to your `.env` file:
```env
# Email Configuration
GMAIL_FROM=andiamo@yourdomain.com
GMAIL_PASSWORD=your-app-password
EMAILJS_PUBLIC_KEY=your-emailjs-key
EMAILJS_SERVICE_ID=your-service-id
EMAILJS_TEMPLATE_ID=your-template-id
```

## 🚀 How the System Works

### 1. Ambassador Application Flow
1. **User fills application form** → Data saved to `ambassador_applications`
2. **Admin reviews application** → In admin dashboard
3. **Admin approves/rejects** → Updates status and sends email
4. **If approved** → Creates ambassador account + sends credentials

### 2. Approval Process
When admin clicks "Approve":
- ✅ Generates secure password
- ✅ Creates ambassador account in `ambassadors` table
- ✅ Updates application status to "approved"
- ✅ Sends email with login credentials
- ✅ Shows success notification

### 3. Rejection Process
When admin clicks "Reject":
- ✅ Updates application status to "rejected"
- ✅ Sends rejection email
- ✅ Shows success notification

## 📱 Generated Credentials

### Username
- **Format:** Phone number (e.g., +21612345678)
- **Used for:** Login to ambassador dashboard

### Password
- **Format:** 8-character random string
- **Example:** `Kj9#mN2p`
- **Security:** Contains uppercase, lowercase, numbers, symbols

## 📧 Email Templates

### Approval Email Includes:
- ✅ Congratulations message
- ✅ Login credentials (username + password)
- ✅ Dashboard login link
- ✅ Security notice
- ✅ Commission structure
- ✅ Next steps guide

### Rejection Email Includes:
- ✅ Professional rejection message
- ✅ Thank you for interest
- ✅ Future opportunities mention

## 🔐 Security Features

### Password Generation
- 8 characters minimum
- Mix of uppercase, lowercase, numbers, symbols
- Random generation for each ambassador

### Email Security
- Credentials sent only to verified email
- Security warning about password change
- Professional email templates

## 🎯 Admin Dashboard Features

### Application Management
- ✅ View all pending applications
- ✅ See applicant details (name, age, phone, email, city)
- ✅ Review motivation and social links
- ✅ One-click approve/reject
- ✅ Email notification status

### Ambassador Management
- ✅ View all approved ambassadors
- ✅ Edit ambassador details
- ✅ Manage commission rates
- ✅ Track performance

## 🛠️ Troubleshooting

### Common Issues:

**1. Email not sending**
- Check email service configuration
- Verify environment variables
- Test email service separately

**2. Database errors**
- Run the migration SQL
- Check table structure
- Verify RLS policies

**3. Password generation issues**
- Check `generatePassword()` function
- Verify character set

### Testing the System:

1. **Submit test application**
2. **Login as admin**
3. **Review application**
4. **Approve application**
5. **Check email delivery**
6. **Test ambassador login**

## 📋 Checklist

### Database Setup
- [ ] Run email field migration
- [ ] Verify table structure
- [ ] Test RLS policies

### Email Setup
- [ ] Configure email service
- [ ] Set environment variables
- [ ] Test email sending

### Frontend Setup
- [ ] Update application form (email field)
- [ ] Update admin dashboard
- [ ] Test approval flow

### Security
- [ ] Test password generation
- [ ] Verify email templates
- [ ] Check credential security

## 🎉 Benefits

### For Ambassadors:
- ✅ Professional application process
- ✅ Clear approval/rejection communication
- ✅ Secure credential delivery
- ✅ Detailed onboarding information

### For Admins:
- ✅ Centralized application management
- ✅ Automated credential generation
- ✅ Email notification system
- ✅ Professional communication

### For Business:
- ✅ Streamlined ambassador onboarding
- ✅ Professional brand image
- ✅ Automated processes
- ✅ Better ambassador retention

---

**Need Help?** Check the troubleshooting section or contact support. 